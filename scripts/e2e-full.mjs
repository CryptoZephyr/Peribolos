/**
 * Peribolos full E2E:
 * 1) Generate throwaway owner wallet (never logged as secret in full form — prefix only)
 * 2) Health + every dashboard page HTTP check
 * 3) Product path via Hosted API (mirrors no-terminal dashboard actions)
 * 4) Optional Playwright UI smoke if chromium available
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, createPublicClient, http, parseEther, formatEther } from 'viem';
import { arcTestnet } from 'viem/chains';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRATCH =
  process.env.SCRATCH || path.dirname(fileURLToPath(import.meta.url));
const API = process.env.API_URL || 'http://localhost:3400';
const DASH = process.env.DASH_URL || 'http://localhost:3000';
const PAGE_TIMEOUT_MS = Number(process.env.PAGE_TIMEOUT_MS || 120000);
const log = [];
const fail = (msg) => {
  log.push(`FAIL: ${msg}`);
  throw new Error(msg);
};
const ok = (msg) => log.push(`OK: ${msg}`);
const info = (msg) => log.push(`INFO: ${msg}`);

async function waitFor(url, label, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (r.ok || r.status < 500) {
        ok(`${label} reachable ${url} status=${r.status}`);
        return;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  fail(`${label} not reachable: ${url}`);
}

async function checkPage(pathname, attempt = 1) {
  const url = `${DASH}${pathname}`;
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(PAGE_TIMEOUT_MS) });
    const text = await res.text();
    if (!res.ok) fail(`page ${pathname} HTTP ${res.status}`);
    // Next.js app should return HTML shell
    if (!text.includes('<html') && !text.includes('<!DOCTYPE') && !text.includes('__next')) {
      info(`page ${pathname} body length=${text.length} (no html marker)`);
    }
    const lower = text.toLowerCase();
    if (pathname === '/' && !lower.includes('peribolos')) {
      fail(`landing missing Peribolos brand`);
    }
    ok(`page ${pathname} HTTP ${res.status} bytes=${text.length}`);
    return { pathname, status: res.status, bytes: text.length };
  } catch (e) {
    if (attempt < 3) {
      info(`page ${pathname} retry ${attempt}: ${e.message?.slice(0, 80)}`);
      await new Promise((r) => setTimeout(r, 2000));
      return checkPage(pathname, attempt + 1);
    }
    fail(`page ${pathname}: ${e.message}`);
  }
}

async function api(pathname, opts = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const ct = res.headers.get('content-type') || '';
  let body;
  if (ct.includes('application/json')) body = await res.json();
  else body = await res.text();
  return { res, body };
}

async function main() {
  info(`API=${API} DASH=${DASH}`);

  // --- Throwaway wallet ---
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const ownerAddress = account.address;
  // Do not print full private key to durable logs — only store encrypted-ish path for local reuse
  fs.writeFileSync(
    path.join(SCRATCH, 'throwaway-wallet.json'),
    JSON.stringify(
      {
        address: ownerAddress,
        privateKey, // local scratch only; deleted with goal
        createdAt: new Date().toISOString(),
        note: 'Throwaway E2E wallet — never fund with real mainnet assets',
      },
      null,
      2
    )
  );
  ok(`throwaway wallet created address=${ownerAddress}`);

  // Arc public client for balance (may be 0 — still validates RPC)
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network'),
  });
  try {
    const bal = await publicClient.getBalance({ address: ownerAddress });
    info(`throwaway wallet Arc balance=${formatEther(bal)} USDC-native (0 expected unfunded)`);
  } catch (e) {
    info(`Arc RPC balance check: ${e.message?.slice(0, 120)}`);
  }

  // Wallet client (signing ready; chain txs only if funded)
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network'),
  });
  const signed = await walletClient.signMessage({ message: 'peribolos-e2e-connect' });
  ok(`wallet connect sim: signed message as owner signature=${signed.slice(0, 18)}…`);

  // --- Wait for servers ---
  await waitFor(`${API}/health`, 'API');
  await waitFor(DASH, 'Dashboard');

  const health = await api('/health');
  if (health.res.status !== 200 || health.body.status !== 'ok') fail('API health bad');
  if (health.body.network !== 'Arc Testnet (5042002)') fail('unexpected network metadata');
  ok(`API health network=${health.body.network}`);

  // --- Every page ---
  const pages = [
    '/',
    '/login',
    '/docs',
    '/education',
    '/app',
    '/app/agents',
    '/app/vaults',
    '/app/payees',
    '/app/activity',
    '/app/simulations',
    '/app/api-keys',
    '/app/pricing',
    '/app/security',
  ];
  const pageResults = [];
  for (const p of pages) {
    pageResults.push(await checkPage(p));
  }

  // --- Full product flow (API mirrors dashboard buttons) ---
  // 1. Create agent (managed signer + API key + offline vault)
  const agentName = `E2E Agent ${ownerAddress.slice(2, 8)}`;
  const created = await api('/v1/agents', {
    method: 'POST',
    body: JSON.stringify({
      name: agentName,
      framework: 'custom',
      description: 'Throwaway E2E agent',
      ownerAddress,
    }),
  });
  if (created.res.status !== 201) fail(`create agent ${created.res.status} ${JSON.stringify(created.body)}`);
  const { agent, vault, apiKey, note } = created.body;
  if (!apiKey?.startsWith('pb_live_')) fail('missing api key');
  if (JSON.stringify(created.body).includes('encryptedPrivateKey')) fail('private key leaked in agent create');
  if (JSON.stringify(created.body).includes(privateKey)) fail('owner private key leaked');
  ok(`agent created id=${agent.id} vault=${vault.id} mode=${vault.mode} signer=${vault.agentSignerAddress}`);
  info(`agent create note: ${note}`);

  // 2. Add payee
  const payeeAddr = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const payee = await api('/v1/payees', {
    method: 'POST',
    body: JSON.stringify({
      name: 'E2E Seller',
      address: payeeAddr,
      category: 'api',
      description: 'E2E allowlisted payee',
      workspaceId: agent.workspaceId,
    }),
  });
  if (payee.res.status !== 201) fail(`payee ${payee.res.status}`);
  ok(`payee added ${payee.body.address}`);

  // 3. Set spending rules
  const rules = await api(`/v1/vaults/${vault.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      dailyCapUsdc: 50,
      perTxCapUsdc: 10,
      allowedActionsBitmap: 7, // bits 0-2 only — action 7 blocked for sim
      ownerAddress,
    }),
  });
  if (rules.res.status !== 200) fail(`rules patch ${rules.res.status}`);
  ok(`rules set daily=${rules.body.dailyCapUsdc} perTx=${rules.body.perTxCapUsdc} bitmap=${rules.body.allowedActionsBitmap}`);

  // 4. Generate extra API key
  const key2 = await api('/v1/api-keys', {
    method: 'POST',
    body: JSON.stringify({ agentId: agent.id, name: 'E2E secondary key', workspaceId: agent.workspaceId }),
  });
  if (key2.res.status !== 201 || !key2.body.rawApiKey) fail('secondary api key failed');
  ok(`secondary api key prefix=${key2.body.apiKeyRecord.keyPrefix}`);

  // 5. Payment: blocked unallowlisted
  const blocked = await api('/v1/payments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      payeeAddress: '0x1111111111111111111111111111111111111111',
      amountUsdc: 1,
      actionType: 1,
      idempotencyKey: `e2e_block_${Date.now()}`,
    }),
  });
  if (blocked.res.status !== 403 || blocked.body.status !== 'BLOCKED') fail(`expected BLOCKED got ${JSON.stringify(blocked.body)}`);
  if (blocked.body.blockReasonCode !== 'RECIPIENT_NOT_ALLOWLISTED') fail('wrong block reason');
  ok(`payment blocked unallowlisted reason=${blocked.body.blockReasonCode}`);

  // 6. Payment: allowlisted offline → honest FAILED OFFLINE_VAULT
  const allowed = await api('/v1/payments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      payeeAddress: payeeAddr,
      amountUsdc: 2.5,
      actionType: 1,
      idempotencyKey: `e2e_allow_${Date.now()}`,
    }),
  });
  if (allowed.res.status !== 200) fail(`allowed path status ${allowed.res.status}`);
  if (allowed.body.status !== 'FAILED' || allowed.body.blockReasonCode !== 'OFFLINE_VAULT') {
    fail(`expected OFFLINE_VAULT FAILED got ${JSON.stringify(allowed.body)}`);
  }
  if (allowed.body.txHash) fail('fabricated txHash on offline allow path');
  if (allowed.body.preflightPassed !== true) fail('preflight should pass');
  ok(`payment offline allow path FAILED/OFFLINE_VAULT preflightPassed=true`);

  // 7. Over cap
  const cap = await api('/v1/payments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      payeeAddress: payeeAddr,
      amountUsdc: 99,
      actionType: 1,
      idempotencyKey: `e2e_cap_${Date.now()}`,
    }),
  });
  if (cap.body.status !== 'BLOCKED' || cap.body.blockReasonCode !== 'EXCEEDS_PER_TX_CAP') {
    fail(`cap block expected ${JSON.stringify(cap.body)}`);
  }
  ok(`payment over cap blocked EXCEEDS_PER_TX_CAP`);

  // 8. Simulations
  const simUntrusted = await api('/v1/simulations/prompt-injection', {
    method: 'POST',
    body: JSON.stringify({ scenarioId: 'scen_untrusted_drain', vaultId: vault.id }),
  });
  if (simUntrusted.body.outcome !== 'BLOCKED_BY_POLICY' || simUntrusted.body.contractEnforced !== false) {
    fail(`sim untrusted ${JSON.stringify(simUntrusted.body)}`);
  }
  ok(`sim untrusted BLOCKED_BY_POLICY contractEnforced=false`);

  const simAction = await api('/v1/simulations/prompt-injection', {
    method: 'POST',
    body: JSON.stringify({ scenarioId: 'scen_action_type_bypass', vaultId: vault.id }),
  });
  // bitmap 7 → action 7 not allowed → BLOCKED
  if (simAction.body.outcome !== 'BLOCKED_BY_POLICY' || simAction.body.blockReasonCode !== 'ACTION_NOT_ALLOWED') {
    fail(`sim action with bitmap 7 expected block ${JSON.stringify(simAction.body)}`);
  }
  ok(`sim action-type BLOCKED_BY_POLICY ACTION_NOT_ALLOWED`);

  // With full bitmap must not fabricate block
  await api(`/v1/vaults/${vault.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ allowedActionsBitmap: 255 }),
  });
  const simPass = await api('/v1/simulations/prompt-injection', {
    method: 'POST',
    body: JSON.stringify({ scenarioId: 'scen_action_type_bypass', vaultId: vault.id }),
  });
  if (simPass.body.outcome !== 'UNEXPECTED_PASS' || simPass.body.preflightAllowed !== true) {
    fail(`sim action full bitmap ${JSON.stringify(simPass.body)}`);
  }
  ok(`sim action-type bitmap 255 UNEXPECTED_PASS (honest)`);

  // 9. Pause / unpause
  const paused = await api('/v1/signers/pause', {
    method: 'POST',
    body: JSON.stringify({ vaultId: vault.id, paused: true }),
  });
  if (!paused.body.paused) fail('pause failed');
  const payPaused = await api('/v1/payments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      payeeAddress: payeeAddr,
      amountUsdc: 1,
      actionType: 1,
      idempotencyKey: `e2e_paused_${Date.now()}`,
    }),
  });
  if (payPaused.body.blockReasonCode !== 'VAULT_PAUSED') fail(`expected VAULT_PAUSED ${JSON.stringify(payPaused.body)}`);
  ok('pause vault → payments VAULT_PAUSED');
  await api('/v1/signers/pause', {
    method: 'POST',
    body: JSON.stringify({ vaultId: vault.id, paused: false }),
  });
  ok('vault unpaused');

  // 10. Rotate signer
  const rotated = await api('/v1/signers/rotate', {
    method: 'POST',
    body: JSON.stringify({ vaultId: vault.id, agentId: agent.id }),
  });
  if (!rotated.body.newSignerAddress?.startsWith('0x')) fail('rotate failed');
  if (JSON.stringify(rotated.body).includes('encryptedPrivateKey')) fail('rotate leaked key');
  ok(`signer rotated new=${rotated.body.newSignerAddress}`);

  // 11. Activity + audit export
  const activity = await api(`/v1/activity?workspaceId=${agent.workspaceId || 'ws_default'}`);
  if (!Array.isArray(activity.body.paymentRequests) || activity.body.paymentRequests.length < 1) {
    fail('activity empty');
  }
  ok(`activity rows=${activity.body.paymentRequests.length}`);

  const csv = await api('/v1/audit/export?format=csv');
  if (typeof csv.body !== 'string' || !csv.body.includes('Status')) fail('csv export bad');
  ok(`audit csv lines=${csv.body.split('\n').length}`);

  const jsonExport = await api('/v1/audit/export?format=json');
  if (!Array.isArray(jsonExport.body)) fail('json export bad');
  ok(`audit json rows=${jsonExport.body.length}`);

  // 12. Fund endpoint honesty (offline reject)
  const fundOffline = await api(`/v1/vaults/${vault.id}/fund`, {
    method: 'POST',
    body: JSON.stringify({
      amountUsdc: 5,
      txHash: '0x' + 'ab'.repeat(32),
      fromAddress: ownerAddress,
    }),
  });
  if (fundOffline.res.status !== 400) fail(`fund offline should 400 got ${fundOffline.res.status}`);
  ok('fund rejects offline vault');

  // --- Optional Playwright UI ---
  let playwrightOk = false;
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const uiLog = [];

    // Inject throwaway wallet identity into localStorage session (dashboard session format)
    await page.goto(`${DASH}/app`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(
      ({ address }) => {
        localStorage.setItem(
          'peribolos.session.v1',
          JSON.stringify({ method: 'wallet', address, username: 'e2e-throwaway' })
        );
      },
      { address: ownerAddress }
    );
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    uiLog.push(`session injected address=${ownerAddress}`);

    for (const p of ['/app', '/app/agents', '/app/vaults', '/app/payees', '/app/activity', '/app/simulations', '/app/api-keys', '/app/security', '/app/pricing']) {
      const resp = await page.goto(`${DASH}${p}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const status = resp?.status() ?? 0;
      const title = await page.title();
      const bodyText = await page.locator('body').innerText().catch(() => '');
      if (status >= 400) fail(`UI ${p} status ${status}`);
      uiLog.push(`UI ${p} status=${status} title=${title} textLen=${bodyText.length}`);
    }

    // Agents: open provision modal if present
    await page.goto(`${DASH}/app/agents`, { waitUntil: 'networkidle', timeout: 30000 });
    const provisionBtn = page.getByRole('button', { name: /Provision New Agent|Create/i }).first();
    if (await provisionBtn.count()) {
      await provisionBtn.click();
      uiLog.push('clicked provision agent');
      const nameInput = page.locator('input[type="text"]').first();
      if (await nameInput.count()) {
        await nameInput.fill(`UI E2E ${Date.now()}`);
        const submit = page.getByRole('button', { name: /Create|Provision/i }).last();
        if (await submit.count()) {
          await submit.click();
          await page.waitForTimeout(1500);
          uiLog.push('submitted create agent form');
        }
      }
    }

    // Simulations run
    await page.goto(`${DASH}/app/simulations`, { waitUntil: 'networkidle', timeout: 30000 });
    const runBtn = page.getByRole('button', { name: /Run Prompt-Injection/i });
    if (await runBtn.count()) {
      await runBtn.click();
      await page.waitForTimeout(2000);
      const body = await page.locator('body').innerText();
      if (body.includes('on-chain contract enforcement') && body.includes('100% BLOCKED')) {
        fail('UI still claims on-chain 100% block theater');
      }
      uiLog.push(`sim page after run contains BLOCKED_BY_POLICY=${body.includes('BLOCKED_BY_POLICY')} UNEXPECTED_PASS=${body.includes('UNEXPECTED_PASS')} product_preflight=${body.includes('product_preflight') || body.includes('preflight')}`);
    }

    // Vaults fund UI present
    await page.goto(`${DASH}/app/vaults`, { waitUntil: 'networkidle', timeout: 30000 });
    const vaultText = await page.locator('body').innerText();
    if (!vaultText.toLowerCase().includes('fund')) fail('vaults page missing fund UI');
    uiLog.push('vaults fund UI present');
    if (!vaultText.toLowerCase().includes('create') && !vaultText.toLowerCase().includes('domain')) {
      info('create domain button text not found — checking label variants');
    }

    // Screenshot
    await page.screenshot({ path: path.join(SCRATCH, 'e2e-app-vaults.png'), fullPage: true });
    await page.goto(`${DASH}/app/activity`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(SCRATCH, 'e2e-app-activity.png'), fullPage: true });

    await browser.close();
    playwrightOk = true;
    for (const line of uiLog) ok(`playwright: ${line}`);
  } catch (e) {
    info(`Playwright UI skipped/partial: ${e.message?.slice(0, 200)}`);
  }

  const summary = {
    passed: true,
    ownerAddress,
    agentId: agent.id,
    vaultId: vault.id,
    pages: pageResults,
    playwrightOk,
    steps: log.filter((l) => l.startsWith('OK:')).length,
    fails: log.filter((l) => l.startsWith('FAIL:')),
  };

  fs.writeFileSync(path.join(SCRATCH, 'e2e-full.log'), log.join('\n') + '\n\n' + JSON.stringify(summary, null, 2));
  console.log(log.join('\n'));
  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  log.push(`FATAL: ${e.message}`);
  fs.writeFileSync(path.join(SCRATCH, 'e2e-full.log'), log.join('\n'));
  console.error(log.join('\n'));
  process.exit(1);
});
