/**
 * Browser E2E: inject throwaway wallet session, walk every app page,
 * exercise agent create + simulation + vaults fund UI presence.
 */
import { chromium } from 'playwright';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import fs from 'node:fs';
import path from 'node:path';

const DASH = process.env.DASH_URL || 'http://localhost:3000';
const API = process.env.API_URL || 'http://localhost:3400';
const SCRATCH = process.env.SCRATCH || path.resolve('dogfood-output');
const log = [];
const ok = (m) => log.push(`OK: ${m}`);
const fail = (m) => {
  log.push(`FAIL: ${m}`);
  throw new Error(m);
};
const info = (m) => log.push(`INFO: ${m}`);

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);
const ownerAddress = account.address;
fs.writeFileSync(
  path.join(SCRATCH, 'throwaway-wallet-ui.json'),
  JSON.stringify({ address: ownerAddress, privateKey, createdAt: new Date().toISOString() }, null, 2)
);

const pages = [
  { path: '/', must: ['Peribolos'] },
  { path: '/login', must: ['wallet', 'Passkey'] },
  { path: '/docs', must: ['Hosted', 'Payment', 'API'] },
  { path: '/education', must: [] },
  { path: '/app', must: ['Checklist', 'Agent'] },
  { path: '/app/agents', must: ['Agent', 'Provision'] },
  { path: '/app/vaults', must: ['Vault', 'Fund'] },
  { path: '/app/payees', must: ['Payee'] },
  { path: '/app/activity', must: ['Activity', 'Export'] },
  { path: '/app/simulations', must: ['Prompt', 'Injection'] },
  { path: '/app/api-keys', must: ['API'] },
  { path: '/app/pricing', must: ['Free', 'Pro'] },
  { path: '/app/security', must: ['Security', 'Audit'] },
];

async function main() {
  // health
  const h = await fetch(`${API}/health`);
  if (!h.ok) fail('API down');
  ok(`API health ${h.status}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // Login page first (wallet connect UI)
  await page.goto(`${DASH}/login`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.screenshot({ path: path.join(SCRATCH, 'e2e-login.png'), fullPage: true });
  const loginText = await page.locator('body').innerText();
  if (!/wallet|passkey|connect/i.test(loginText)) fail('login page missing wallet/passkey connect UI');
  ok('login page shows wallet/passkey connect');

  // Inject throwaway session (simulates successful wallet connect)
  await page.evaluate(
    ({ address }) => {
      localStorage.setItem(
        'peribolos.session.v1',
        JSON.stringify({ method: 'wallet', address, username: 'e2e-throwaway' })
      );
    },
    { address: ownerAddress }
  );
  ok(`session injected throwaway wallet ${ownerAddress}`);

  for (const p of pages) {
    const resp = await page.goto(`${DASH}${p.path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const status = resp?.status() ?? 0;
    if (status >= 400) fail(`${p.path} HTTP ${status}`);
    await page.waitForTimeout(800);
    const text = await page.locator('body').innerText();
    for (const m of p.must) {
      if (!text.toLowerCase().includes(m.toLowerCase())) {
        fail(`${p.path} missing visible text "${m}" (got ${text.slice(0, 200).replace(/\n/g, ' ')}…)`);
      }
    }
    ok(`UI page ${p.path} status=${status} textLen=${text.length}`);
  }

  // Agents: create via UI
  await page.goto(`${DASH}/app/agents`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.screenshot({ path: path.join(SCRATCH, 'e2e-agents.png'), fullPage: true });
  const provision = page.getByRole('button', { name: /Provision New Agent/i });
  if ((await provision.count()) === 0) fail('Provision New Agent button missing');
  await provision.click();
  await page.getByPlaceholder(/e\.g\.|LangChain|name/i).first().fill(`UI Throwaway ${ownerAddress.slice(2, 8)}`);
  await page.getByRole('button', { name: /Create & Provision Vault|Create/i }).last().click();
  await page.waitForTimeout(2500);
  const agentsBody = await page.locator('body').innerText();
  if (!/pb_live_|API Key|Managed Signer|Rotate/i.test(agentsBody)) {
    info(`agent create UI body snippet: ${agentsBody.slice(0, 400).replace(/\n/g, ' ')}`);
  }
  ok('agents provision flow clicked');
  await page.screenshot({ path: path.join(SCRATCH, 'e2e-agents-after-create.png'), fullPage: true });

  // Vaults: create/fund UI
  await page.goto(`${DASH}/app/vaults`, { waitUntil: 'networkidle', timeout: 60000 });
  const vaultText = await page.locator('body').innerText();
  if (!/Fund protected vault|Create & fund|Edit Rules|offline|live/i.test(vaultText)) {
    fail(`vaults missing fund/create UI: ${vaultText.slice(0, 300)}`);
  }
  const createBtn = page.getByRole('button', { name: /Create & fund domain|Create/i });
  if (await createBtn.count()) {
    await createBtn.first().click();
    await page.waitForTimeout(1000);
    const after = await page.locator('body').innerText();
    if (!/managed signer|paste|domain|allowlist|fund/i.test(after)) {
      info('create domain panel may need scroll');
    } else {
      ok('create domain wizard opened');
    }
  }
  await page.screenshot({ path: path.join(SCRATCH, 'e2e-vaults.png'), fullPage: true });
  ok('vaults fund/create UI present');

  // Payees
  await page.goto(`${DASH}/app/payees`, { waitUntil: 'networkidle' });
  const addPayee = page.getByRole('button', { name: /Add Approved Payee/i });
  if (await addPayee.count()) {
    await addPayee.click();
    await page.getByPlaceholder(/Weather|name/i).first().fill('E2E UI Payee');
    const addr = page.getByPlaceholder(/0x/i).first();
    if (await addr.count()) await addr.fill('0x3C44CdDDB6a900fa2b585dd299e03d12FA4293BC');
    const submit = page.getByRole('button', { name: /Add|Save|Create/i }).last();
    if (await submit.count()) await submit.click();
    await page.waitForTimeout(1500);
    ok('payee form exercised');
  }
  await page.screenshot({ path: path.join(SCRATCH, 'e2e-payees.png'), fullPage: true });

  // Simulations
  await page.goto(`${DASH}/app/simulations`, { waitUntil: 'networkidle' });
  const run = page.getByRole('button', { name: /Run Prompt-Injection/i });
  if ((await run.count()) === 0) fail('run simulation button missing');
  await run.click();
  await page.waitForTimeout(2500);
  const simText = await page.locator('body').innerText();
  if (/100% BLOCKED.*on-chain contract enforcement/i.test(simText)) {
    fail('simulations UI still claims on-chain 100% block theater');
  }
  if (!/BLOCKED_BY_POLICY|UNEXPECTED_PASS|preflight|policy/i.test(simText)) {
    info(`sim result text: ${simText.slice(0, 500).replace(/\n/g, ' ')}`);
  } else {
    ok('simulation result shows honest policy/preflight wording');
  }
  await page.screenshot({ path: path.join(SCRATCH, 'e2e-simulations.png'), fullPage: true });

  // Activity export links
  await page.goto(`${DASH}/app/activity`, { waitUntil: 'networkidle' });
  const activityText = await page.locator('body').innerText();
  if (!/Export|CSV|JSON|Audit/i.test(activityText)) fail('activity missing export');
  ok('activity export UI present');
  await page.screenshot({ path: path.join(SCRATCH, 'e2e-activity.png'), fullPage: true });

  // Security
  await page.goto(`${DASH}/app/security`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(SCRATCH, 'e2e-security.png'), fullPage: true });
  ok('security page loaded');

  await browser.close();

  const summary = { passed: true, ownerAddress, steps: log.filter((l) => l.startsWith('OK:')).length };
  fs.writeFileSync(path.join(SCRATCH, 'e2e-ui.log'), log.join('\n') + '\n' + JSON.stringify(summary, null, 2));
  console.log(log.join('\n'));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  log.push(`FATAL: ${e.message}`);
  fs.writeFileSync(path.join(SCRATCH, 'e2e-ui.log'), log.join('\n'));
  console.error(log.join('\n'));
  process.exit(1);
});
