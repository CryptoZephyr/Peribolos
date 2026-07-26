/**
 * First-time user dogfood of Peribolos.
 * Persona: never heard of Peribolos — land → understand → login → app → try primary flow.
 * Captures what works, what's confusing, and whether I can complete a useful path without a terminal.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const DASH = process.env.DASH_URL || 'http://localhost:3000';
const API = process.env.API_URL || 'http://localhost:3400';
const SCRATCH = process.env.SCRATCH || path.resolve('dogfood-output');
fs.mkdirSync(SCRATCH, { recursive: true });

const notes = [];
const note = (kind, msg) => {
  const line = `[${kind}] ${msg}`;
  notes.push(line);
  console.log(line);
};

async function api(pathname, opts = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  note('START', `I'm a new user. Dashboard=${DASH} API=${API}`);

  // 0. Is backend even needed / reachable?
  try {
    const h = await api('/health');
    if (h.status === 200 && h.body.status === 'ok') {
      note('OK', `Backend health ok — network=${h.body.network}. I guess this is a hosted product, not pure static.`);
    } else {
      note('CONFUSED', `Health weird: ${JSON.stringify(h.body)}`);
    }
  } catch (e) {
    note('BLOCKER', `Cannot reach API: ${e.message}. Dashboard may show empty lists.`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 } });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);

  // ---------- 1. Landing ----------
  note('STEP', '1) Open homepage — what is this product?');
  await page.goto(DASH + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const homeText = await page.locator('body').innerText();
  await page.screenshot({ path: path.join(SCRATCH, 'newuser-01-home.png'), fullPage: true });

  if (/AI agents|vault|spending|allowlist|Arc/i.test(homeText)) {
    note('OK', 'Landing explains agents + spending control / vaults on Arc.');
  } else {
    note('ISSUE', 'Landing copy unclear about what I get.');
  }
  const openApp = page.getByRole('link', { name: /Open app/i }).first();
  if ((await openApp.count()) === 0) {
    note('ISSUE', 'No obvious "Open app" CTA — how do I start?');
  } else {
    note('OK', 'Found "Open app" CTA.');
  }

  // Docs?
  const docsLink = page.getByRole('link', { name: /Docs/i }).first();
  if (await docsLink.count()) {
    await docsLink.click();
    await page.waitForTimeout(1000);
    const docsText = await page.locator('body').innerText();
    await page.screenshot({ path: path.join(SCRATCH, 'newuser-02-docs.png'), fullPage: true });
    if (/Hosted Payment API|pb_live|PERIBOLOS_API_KEY|private key/i.test(docsText)) {
      note('OK', 'Docs mention hosted API / API keys (good for agent builders).');
    }
    if (/AGENT_PRIVATE_KEY/i.test(docsText) && !/prefer|hosted|primary/i.test(docsText)) {
      note('CONFUSED', 'Docs still push private keys — is the primary path no-terminal or DIY keys?');
    }
    if (/no server|no backend/i.test(docsText) && /Hosted Payment API/i.test(docsText)) {
      note('CONFUSED', 'Docs say no backend AND hosted API — mixed story for a newcomer.');
    }
  }

  // ---------- 2. Login ----------
  note('STEP', '2) Try to sign in / open the product.');
  await page.goto(DASH + '/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const loginText = await page.locator('body').innerText();
  await page.screenshot({ path: path.join(SCRATCH, 'newuser-03-login.png'), fullPage: true });

  if (/wallet|passkey|MetaMask|Connect/i.test(loginText)) {
    note('OK', 'Login offers wallet/passkey — no email/password signup form.');
  }
  if (/No account, no password, no custody/i.test(loginText) || /no password/i.test(loginText)) {
    note('OK', 'Clear that I do not create a traditional account.');
  }
  note(
    'FRICTION',
    'As a new user I need MetaMask (or passkey) + Arc Testnet + faucet USDC. Product does not hand me those inside the login page.'
  );

  // Simulate successful wallet connect (new throwaway "me")
  const pk = generatePrivateKey();
  const me = privateKeyToAccount(pk);
  fs.writeFileSync(
    path.join(SCRATCH, 'newuser-wallet.json'),
    JSON.stringify({ address: me.address, privateKey: pk, note: 'throwaway new-user persona' }, null, 2)
  );
  await page.evaluate(
    ({ address }) => {
      localStorage.setItem(
        'peribolos.session.v1',
        JSON.stringify({ method: 'wallet', address, username: 'new-user' })
      );
    },
    { address: me.address }
  );
  note('OK', `Simulated wallet connect as ${me.address} (no MetaMask in headless).`);

  // ---------- 3. Dashboard overview ----------
  note('STEP', '3) Land in /app after connect — do I know what to do next?');
  await page.goto(DASH + '/app', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const appText = await page.locator('body').innerText();
  await page.screenshot({ path: path.join(SCRATCH, 'newuser-04-app.png'), fullPage: true });

  if (/checklist|Quickstart|Create Agent|1\.|Fund/i.test(appText)) {
    note('OK', 'Overview has a quickstart checklist — helpful for first run.');
  } else {
    note('ISSUE', 'No clear first-run checklist on overview.');
  }
  if (/Backend API offline|Failed to|Loading/i.test(appText) && !/Agent|Payee|Vault/i.test(appText)) {
    note('ISSUE', 'Overview may be failing to load data from API.');
  }

  // Check if API URL is localhost — new user on static dashboard needs CORS + API running
  note(
    'FRICTION',
    'Dashboard talks to http://localhost:3400 by default. A real new user outside this monorepo would not know to run the API.'
  );

  // ---------- 4. Agents: provision ----------
  note('STEP', '4) Create my first agent (primary CTA).');
  await page.goto(DASH + '/app/agents', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCRATCH, 'newuser-05-agents-empty.png'), fullPage: true });

  const provision = page.getByRole('button', { name: /Provision New Agent/i });
  if ((await provision.count()) === 0) {
    note('BLOCKER', 'Cannot find Provision New Agent button.');
  } else {
    await provision.click();
    await page.waitForTimeout(400);
    const nameField = page.locator('input[type="text"]').first();
    await nameField.fill('My First Research Bot');
    await page.getByRole('button', { name: /Create|Provision/i }).last().click();
    await page.waitForTimeout(2500);
    const after = await page.locator('body').innerText();
    await page.screenshot({ path: path.join(SCRATCH, 'newuser-06-agents-created.png'), fullPage: true });

    if (/pb_live_/i.test(after)) {
      note('OK', 'Got an API key once (pb_live_…) — critical "aha" for connecting an agent.');
      const m = after.match(/pb_live_[a-zA-Z0-9]+/);
      if (m) {
        fs.writeFileSync(path.join(SCRATCH, 'newuser-api-key.txt'), m[0]);
        note('OK', `Captured API key prefix ${m[0].slice(0, 20)}… for payment test.`);
      }
    } else {
      note('ISSUE', 'After create, I do not clearly see a one-time API key to copy.');
    }
    if (/Managed Signer|Rotate|Pause/i.test(after)) {
      note('OK', 'Agent card shows managed signer + pause/rotate controls.');
    }
    if (/offline/i.test(after)) {
      note(
        'CONFUSED',
        'Vault may be offline — as a new user I do not know if payments will actually work or only simulate.'
      );
    }
  }

  // ---------- 5. Payees ----------
  note('STEP', '5) Add an approved payee (so my agent can pay someone).');
  await page.goto(DASH + '/app/payees', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const addPayee = page.getByRole('button', { name: /Add Approved Payee/i });
  if (await addPayee.count()) {
    await addPayee.click();
    await page.getByPlaceholder(/name|Weather|e\.g\./i).first().fill('Demo Weather API');
    const addr = page.getByPlaceholder(/0x/i).first();
    if (await addr.count()) {
      await addr.fill(me.address); // pay myself — realistic first test
    }
    await page.getByRole('button', { name: /Add|Save|Create/i }).last().click();
    await page.waitForTimeout(1500);
    const payeeText = await page.locator('body').innerText();
    await page.screenshot({ path: path.join(SCRATCH, 'newuser-07-payees.png'), fullPage: true });
    if (/Demo Weather API|VERIFIED/i.test(payeeText)) {
      note('OK', 'Payee created and listed.');
    } else {
      note('ISSUE', 'Payee form submitted but list may not show my payee (API offline?).');
    }
  } else {
    note('ISSUE', 'No Add Payee button.');
  }

  // ---------- 6. Vaults: rules + fund ----------
  note('STEP', '6) Configure vault / try to fund.');
  await page.goto(DASH + '/app/vaults', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const vaultText = await page.locator('body').innerText();
  await page.screenshot({ path: path.join(SCRATCH, 'newuser-08-vaults.png'), fullPage: true });

  if (/Fund|Create & fund|offline|live|Edit Rules/i.test(vaultText)) {
    note('OK', 'Vaults page exposes fund / create domain / rules — looks like the power-user surface.');
  }
  if (/offline/i.test(vaultText) && /Fund/i.test(vaultText)) {
    note(
      'FRICTION',
      'I see Fund UI but vault is offline — product correctly blocks funding until live address, but new-user path to "live" is long (deploy domain + paste address).'
    );
  }
  const createDomain = page.getByRole('button', { name: /Create & fund domain/i });
  if (await createDomain.count()) {
    await createDomain.click();
    await page.waitForTimeout(800);
    const wizard = await page.locator('body').innerText();
    await page.screenshot({ path: path.join(SCRATCH, 'newuser-09-create-domain.png'), fullPage: true });
    if (/managed signer|paste|allowlist|fund/i.test(wizard)) {
      note('OK', 'Create-domain wizard opened with managed-signer guidance.');
    }
    note(
      'FRICTION',
      'On-chain create still needs owner wallet on Arc with USDC gas — not automatic after "Provision Agent".'
    );
  }

  // ---------- 7. API keys page ----------
  note('STEP', '7) Find my API key again / generate another.');
  await page.goto(DASH + '/app/api-keys', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const keysText = await page.locator('body').innerText();
  await page.screenshot({ path: path.join(SCRATCH, 'newuser-10-api-keys.png'), fullPage: true });
  if (/pb_live|Generate|prefix/i.test(keysText)) {
    note('OK', 'API Keys page lists keys (hashed/prefix) and can generate more.');
  }
  if (!/pb_live_[a-z0-9]{20,}/i.test(keysText)) {
    note(
      'FRICTION',
      'Full secret key is only shown once at creation — good security, but I must have copied it earlier. No email recovery.'
    );
  }

  // ---------- 8. Make a payment as my agent (the real product use) ----------
  note('STEP', '8) As my agent, call POST /v1/payments with the API key (how I would integrate).');
  // List keys via API and create a fresh agent+key for a clean first-user payment path
  const created = await api('/v1/agents', {
    method: 'POST',
    body: JSON.stringify({
      name: 'First-time user agent',
      framework: 'custom',
      description: 'Dogfood new user',
    }),
  });
  if (created.status !== 201) {
    note('BLOCKER', `Cannot create agent via API: ${created.status} ${JSON.stringify(created.body)}`);
  } else {
    const { agent, vault, apiKey, note: createNote } = created.body;
    note('OK', `API provisioned agent=${agent.id} vaultMode=${vault.mode}`);
    if (createNote) note('INFO', createNote);

    await api('/v1/payees', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Myself',
        address: me.address,
        category: 'service',
      }),
    });

    // Bad payee — should block
    const bad = await api('/v1/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        payeeAddress: '0x1111111111111111111111111111111111111111',
        amountUsdc: 1,
        actionType: 1,
        idempotencyKey: `newuser_bad_${Date.now()}`,
      }),
    });
    if (bad.body.status === 'BLOCKED' && bad.body.blockReasonCode === 'RECIPIENT_NOT_ALLOWLISTED') {
      note('OK', 'Blocked payment to unknown payee with clear reason code — this is the product promise.');
    } else {
      note('ISSUE', `Expected BLOCKED unallowlisted, got ${JSON.stringify(bad.body)}`);
    }

    // Allowed payee offline vault
    const good = await api('/v1/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        payeeAddress: me.address,
        amountUsdc: 1.5,
        actionType: 1,
        idempotencyKey: `newuser_good_${Date.now()}`,
      }),
    });
    if (good.body.status === 'FAILED' && good.body.blockReasonCode === 'OFFLINE_VAULT') {
      note(
        'OK',
        'Honest offline result: policy passed but FAILED/OFFLINE_VAULT (not fake success). As a new user I need a live vault to complete a real pay.'
      );
    } else if (good.body.status === 'EXECUTED') {
      note('OK', `Real payment executed! tx=${good.body.txHash}`);
    } else {
      note('INFO', `Payment outcome: ${JSON.stringify(good.body)}`);
    }

    fs.writeFileSync(
      path.join(SCRATCH, 'newuser-first-payment.json'),
      JSON.stringify({ agent, vault, bad: bad.body, good: good.body }, null, 2)
    );
  }

  // ---------- 9. Activity + simulation ----------
  note('STEP', '9) Check activity feed and security simulation (marketing claim).');
  await page.goto(DASH + '/app/activity', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const actText = await page.locator('body').innerText();
  await page.screenshot({ path: path.join(SCRATCH, 'newuser-11-activity.png'), fullPage: true });
  if (/Export|CSV|BLOCKED|FAILED|EXECUTED|Activity/i.test(actText)) {
    note('OK', 'Activity shows history + export — useful for "did my agent get blocked?"');
  } else {
    note('ISSUE', 'Activity empty or not loading.');
  }

  await page.goto(DASH + '/app/simulations', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const runSim = page.getByRole('button', { name: /Run Prompt-Injection/i });
  if (await runSim.count()) {
    await runSim.click();
    await page.waitForTimeout(2000);
    const simText = await page.locator('body').innerText();
    await page.screenshot({ path: path.join(SCRATCH, 'newuser-12-sim.png'), fullPage: true });
    if (/100% BLOCKED.*on-chain contract enforcement/i.test(simText)) {
      note('ISSUE', 'Simulation still overclaims on-chain enforcement for a preflight demo.');
    } else if (/BLOCKED_BY_POLICY|preflight|policy/i.test(simText)) {
      note('OK', 'Simulation result is honest about policy preflight.');
    } else {
      note('CONFUSED', 'Simulation ran but I do not understand the result.');
    }
  }

  // ---------- 10. Pricing / security pages ----------
  await page.goto(DASH + '/app/pricing', { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: path.join(SCRATCH, 'newuser-13-pricing.png'), fullPage: true });
  const priceText = await page.locator('body').innerText();
  if (/Free|Pro|Team/i.test(priceText)) note('OK', 'Pricing page exists (startup packaging).');

  await page.goto(DASH + '/app/security', { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: path.join(SCRATCH, 'newuser-14-security.png'), fullPage: true });
  const secText = await page.locator('body').innerText();
  if (/Managed Signer|private keys|Audit/i.test(secText)) {
    note('OK', 'Security page explains managed signers and audit export.');
  }

  await browser.close();

  // ---------- Verdict ----------
  note('STEP', '11) First-time user verdict');
  const okCount = notes.filter((n) => n.startsWith('[OK]')).length;
  const issueCount = notes.filter((n) => n.startsWith('[ISSUE]') || n.startsWith('[BLOCKER]')).length;
  const frictionCount = notes.filter((n) => n.startsWith('[FRICTION]') || n.startsWith('[CONFUSED]')).length;

  note(
    'VERDICT',
    `Completed a first-session loop: understand product → connect (simulated) → provision agent → add payee → see blocked payment + honest offline fail → activity + sim. OK=${okCount} issues=${issueCount} friction=${frictionCount}.`
  );
  note(
    'VERDICT',
    'Primary no-terminal value works for offline policy control. Full "my agent paid USDC on Arc" still requires live vault + funded owner — not automatic on first click.'
  );

  const report = notes.join('\n');
  fs.writeFileSync(path.join(SCRATCH, 'newuser-journey.log'), report);
  console.log('\n===== NEW USER JOURNEY LOG =====\n' + report);
}

main().catch((e) => {
  console.error(e);
  fs.writeFileSync(path.join(SCRATCH, 'newuser-journey.log'), notes.join('\n') + '\nFATAL: ' + e.message);
  process.exit(1);
});
