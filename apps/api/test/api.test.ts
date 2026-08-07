import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { app } from '../src/server.js';
import { db } from '../src/db/store.js';
import { eventIndexer } from '../src/services/indexer.js';
import {
  encryptPrivateKey,
  decryptPrivateKey,
  signerService
} from '../src/services/signer.js';
import { preflightPolicyCheck } from '../src/services/policy.js';

describe('Peribolos V2 API Integration Tests', () => {
  const PORT = 3405;
  let testServer: ReturnType<typeof app.listen>;
  const baseUrl = `http://localhost:${PORT}`;
  const DEMO_KEY = process.env.PERIBOLOS_TEST_API_KEY;
  const ALLOWED_PAYEE = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const BLOCKED_PAYEE = '0x1111111111111111111111111111111111111111';

  before(async () => {
    // Ensure demo vault is offline with sane caps for deterministic tests
    const vaults = db.getVaults('ws_default');
    const demoVault = vaults.find(v => v.agentId === 'ag_demo') || vaults[0];
    if (demoVault) {
      db.updateVault(demoVault.id, {
        mode: 'offline',
        paused: false,
        dailyCapUsdc: 100,
        perTxCapUsdc: 25,
        allowedActionsBitmap: 255
      });
    }
    await new Promise<void>((resolve) => {
      testServer = app.listen(PORT, () => resolve());
    });
  });

  after(async () => {
    eventIndexer.stop();
    if (testServer) {
      await new Promise<void>((resolve, reject) => {
        testServer.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it('GET /health returns 200 OK and Arc Testnet metadata', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'ok');
    assert.strictEqual(body.network, 'Arc Testnet (5042002)');
    assert.ok(body.service);
  });

  it('GET /v1/setup/status reports signer readiness without secret values', async () => {
    const res = await fetch(`${baseUrl}/v1/setup/status`, {
      headers: { Authorization: `Bearer ${DEMO_KEY}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.signer.network.chainId, 5042002);
    assert.ok(['circle-dcw', 'local-dev'].includes(body.signer.provider));
    assert.ok(Array.isArray(body.signer.circle.missingEnv));
    assert.ok(!JSON.stringify(body).includes('pb_live_demo'));
    assert.ok(!JSON.stringify(body).includes('peribolos-v2-dev-signer-master-secret'));
  });

  it('GET /v1/signers/status reports active wallet linkage without key material', async () => {
    const res = await fetch(`${baseUrl}/v1/signers/status`, {
      headers: { Authorization: `Bearer ${DEMO_KEY}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.chainId, 5042002);
    assert.ok(Array.isArray(body.agents));
    assert.ok(body.agents.some((entry: { agentId: string }) => entry.agentId === 'ag_demo'));
    assert.ok(!JSON.stringify(body).includes('encryptedPrivateKey'));
    assert.ok(!JSON.stringify(body).includes('walletId'));
  });

  it('POST /v1/payments rejects missing authorization header with 401', async () => {
    const res = await fetch(`${baseUrl}/v1/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payeeAddress: ALLOWED_PAYEE, amountUsdc: 1.0 })
    });
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.ok(body.error === 'UNAUTHORIZED' || body.message);
  });

  it('POST /v1/payments rejects invalid API key with 401', async () => {
    const res = await fetch(`${baseUrl}/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer pb_live_notarealkey00000000000000000000'
      },
      body: JSON.stringify({ payeeAddress: ALLOWED_PAYEE, amountUsdc: 1.0 })
    });
    assert.strictEqual(res.status, 401);
  });

  it('POST /v1/payments rejects amounts below Arc USDC precision', async () => {
    const res = await fetch(`${baseUrl}/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEMO_KEY}`
      },
      body: JSON.stringify({
        payeeAddress: ALLOWED_PAYEE,
        amountUsdc: 0.0000009,
        actionType: 1
      })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /6 decimal places/);
  });

  it('POST /v1/payments: allowlisted payee on offline vault is FAILED (not fabricated EXECUTED)', async () => {
    const res = await fetch(`${baseUrl}/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEMO_KEY}`
      },
      body: JSON.stringify({
        payeeAddress: ALLOWED_PAYEE,
        amountUsdc: 2.5,
        actionType: 1,
        idempotencyKey: `idemp_test_allowed_${Date.now()}`
      })
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200, JSON.stringify(body));
    // Honest offline outcome: policy can pass, but EXECUTED requires chain success
    assert.strictEqual(body.status, 'FAILED');
    assert.strictEqual(body.blockReasonCode, 'OFFLINE_VAULT');
    assert.strictEqual(body.preflightPassed, true);
    assert.strictEqual(body.amountUsdc, 2.5);
    // Must not invent a success hash
    assert.ok(!body.txHash, 'offline path must not invent txHash');
    assert.notStrictEqual(body.status, 'EXECUTED');
  });

  it('POST /v1/payments blocks un-allowlisted payee with 403 & RECIPIENT_NOT_ALLOWLISTED', async () => {
    const res = await fetch(`${baseUrl}/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEMO_KEY}`
      },
      body: JSON.stringify({
        payeeAddress: BLOCKED_PAYEE,
        amountUsdc: 1.0,
        actionType: 1,
        idempotencyKey: `idemp_test_blocked_${Date.now()}`
      })
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.status, 'BLOCKED');
    assert.strictEqual(body.blockReasonCode, 'RECIPIENT_NOT_ALLOWLISTED');
    assert.ok(body.blockReasonDescription);
    assert.ok(!body.txHash);
  });

  it('POST /v1/payments blocks amount over per-tx cap', async () => {
    const res = await fetch(`${baseUrl}/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEMO_KEY}`
      },
      body: JSON.stringify({
        payeeAddress: ALLOWED_PAYEE,
        amountUsdc: 9999,
        actionType: 1,
        idempotencyKey: `idemp_test_cap_${Date.now()}`
      })
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.status, 'BLOCKED');
    assert.strictEqual(body.blockReasonCode, 'EXCEEDS_PER_TX_CAP');
  });

  it('POST /v1/payments respects idempotency keys (cached replay)', async () => {
    const key = `idemp_replay_${Date.now()}`;
    const payload = {
      payeeAddress: BLOCKED_PAYEE,
      amountUsdc: 1.0,
      actionType: 1,
      idempotencyKey: key
    };
    const r1 = await fetch(`${baseUrl}/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEMO_KEY}`
      },
      body: JSON.stringify(payload)
    });
    const b1 = await r1.json();
    const r2 = await fetch(`${baseUrl}/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEMO_KEY}`
      },
      body: JSON.stringify(payload)
    });
    const b2 = await r2.json();
    assert.strictEqual(b1.id, b2.id);
    assert.strictEqual(b2.cached, true);
    assert.strictEqual(b2.status, 'BLOCKED');
  });

  it('POST /v1/simulations: untrusted payee is BLOCKED_BY_POLICY from real preflight (not theater)', async () => {
    const res = await fetch(`${baseUrl}/v1/simulations/prompt-injection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: JSON.stringify({ scenarioId: 'scen_untrusted_drain' })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    // Outcome must track preflight — untrusted address is not a payee
    assert.strictEqual(body.outcome, 'BLOCKED_BY_POLICY');
    assert.strictEqual(body.preflightAllowed, false);
    assert.strictEqual(body.policyEnforced, true);
    assert.strictEqual(body.contractEnforced, false); // simulation does not submit on-chain
    assert.strictEqual(body.enforcementLayer, 'product_preflight');
    assert.strictEqual(body.blockReasonCode, 'RECIPIENT_NOT_ALLOWLISTED');
    assert.ok(body.shareableReportUrl);
    assert.ok(body.attemptedPayment);
  });

  it('POST /v1/simulations: scen_action_type_bypass with bitmap 255 does NOT fabricate BLOCKED', async () => {
    const vaultsRes = await fetch(`${baseUrl}/v1/vaults`, {
      headers: { Authorization: `Bearer ${DEMO_KEY}` }
    });
    const vaults = await vaultsRes.json();
    const vault = vaults.find((v: { agentId: string }) => v.agentId === 'ag_demo') || vaults[0];
    // Ensure full bitmap so action type 7 is allowed by preflight
    await fetch(`${baseUrl}/v1/vaults/${vault.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: JSON.stringify({ allowedActionsBitmap: 255, perTxCapUsdc: 25, dailyCapUsdc: 100, paused: false })
    });

    const res = await fetch(`${baseUrl}/v1/simulations/prompt-injection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: JSON.stringify({ scenarioId: 'scen_action_type_bypass', vaultId: vault.id })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    // action 7 is bit 7; 255 includes it → preflight allows → UNEXPECTED_PASS
    assert.strictEqual(body.preflightAllowed, true);
    assert.strictEqual(body.outcome, 'UNEXPECTED_PASS');
    assert.strictEqual(body.contractEnforced, false);
    assert.strictEqual(body.policyEnforced, false);
    assert.notStrictEqual(body.blockReasonCode, 'ACTION_NOT_ALLOWED');
    assert.ok(!body.blockReasonCode || body.blockReasonCode === undefined);
  });

  it('POST /v1/simulations: outcome tracks preflight when action bit is cleared', async () => {
    const vaultsRes = await fetch(`${baseUrl}/v1/vaults`, {
      headers: { Authorization: `Bearer ${DEMO_KEY}` }
    });
    const vaults = await vaultsRes.json();
    const vault = vaults.find((v: { agentId: string }) => v.agentId === 'ag_demo') || vaults[0];
    // Clear bit 7 (128) so action type 7 is not allowed: 255 - 128 = 127
    await fetch(`${baseUrl}/v1/vaults/${vault.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: JSON.stringify({ allowedActionsBitmap: 127, perTxCapUsdc: 25, dailyCapUsdc: 100, paused: false })
    });

    const res = await fetch(`${baseUrl}/v1/simulations/prompt-injection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: JSON.stringify({ scenarioId: 'scen_action_type_bypass', vaultId: vault.id })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.preflightAllowed, false);
    assert.strictEqual(body.outcome, 'BLOCKED_BY_POLICY');
    assert.strictEqual(body.blockReasonCode, 'ACTION_NOT_ALLOWED');
    assert.strictEqual(body.contractEnforced, false);
    assert.strictEqual(body.policyEnforced, true);

    // Restore full bitmap for later tests
    await fetch(`${baseUrl}/v1/vaults/${vault.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: JSON.stringify({ allowedActionsBitmap: 255 })
    });
  });

  it('POST /v1/vaults/:id/fund rejects offline vault and fake-less missing hash', async () => {
    const vaultsRes = await fetch(`${baseUrl}/v1/vaults`, {
      headers: { Authorization: `Bearer ${DEMO_KEY}` }
    });
    const vaults = await vaultsRes.json();
    const vault = vaults.find((v: { mode: string }) => v.mode === 'offline') || vaults[0];
    const bad = await fetch(`${baseUrl}/v1/vaults/${vault.id}/fund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: JSON.stringify({ amountUsdc: 5, txHash: '0x' + 'ab'.repeat(32) })
    });
    // offline → 400 OFFLINE_VAULT (even with well-formed hash)
    assert.strictEqual(bad.status, 400);
    const body = await bad.json();
    assert.ok(body.error === 'OFFLINE_VAULT' || body.message);

    const noHash = await fetch(`${baseUrl}/v1/vaults/${vault.id}/fund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: JSON.stringify({ amountUsdc: 5 })
    });
    assert.strictEqual(noHash.status, 400);

    const chainState = await fetch(`${baseUrl}/v1/vaults/${vault.id}/chain-state`, {
      headers: { Authorization: `Bearer ${DEMO_KEY}` }
    });
    assert.strictEqual(chainState.status, 400);
    const chainStateBody = await chainState.json();
    assert.strictEqual(chainStateBody.error, 'OFFLINE_VAULT');
  });

  it('GET /v1/audit/export returns CSV with audit columns and prior payment rows', async () => {
    const res = await fetch(`${baseUrl}/v1/audit/export?format=csv`, {
      headers: { Authorization: `Bearer ${DEMO_KEY}` }
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('text/csv'));
    const csv = await res.text();
    assert.ok(csv.includes('ID,Timestamp,Agent ID'));
    assert.ok(csv.includes('Status'));
    // Prior tests should have written BLOCKED and/or FAILED rows
    assert.ok(csv.includes('BLOCKED') || csv.includes('FAILED'));
  });

  it('GET /v1/audit/export?format=json returns payment request array', async () => {
    const res = await fetch(`${baseUrl}/v1/audit/export?format=json`, {
      headers: { Authorization: `Bearer ${DEMO_KEY}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));
    assert.ok(body.length > 0);
    assert.ok(body[0].status);
    assert.ok(body[0].id);
  });

  it('POST /v1/signers/pause pauses vault so subsequent payments BLOCK with VAULT_PAUSED', async () => {
    const vaultsRes = await fetch(`${baseUrl}/v1/vaults`, {
      headers: { Authorization: `Bearer ${DEMO_KEY}` }
    });
    const vaults = await vaultsRes.json();
    const vault = vaults.find((v: { agentId: string }) => v.agentId === 'ag_demo') || vaults[0];
    assert.ok(vault, 'demo vault required');

    const pauseRes = await fetch(`${baseUrl}/v1/signers/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: JSON.stringify({ vaultId: vault.id, paused: true })
    });
    assert.strictEqual(pauseRes.status, 200);
    const pauseBody = await pauseRes.json();
    assert.strictEqual(pauseBody.paused, true);

    const payRes = await fetch(`${baseUrl}/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEMO_KEY}`
      },
      body: JSON.stringify({
        payeeAddress: ALLOWED_PAYEE,
        amountUsdc: 1.0,
        actionType: 1,
        idempotencyKey: `idemp_paused_${Date.now()}`
      })
    });
    assert.strictEqual(payRes.status, 403);
    const payBody = await payRes.json();
    assert.strictEqual(payBody.status, 'BLOCKED');
    assert.strictEqual(payBody.blockReasonCode, 'VAULT_PAUSED');

    // Unpause for remaining tests
    await fetch(`${baseUrl}/v1/signers/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: JSON.stringify({ vaultId: vault.id, paused: false })
    });
  });

  it('POST /v1/signers/rotate returns new address and never returns private key', async () => {
    // Create agent with real managed signer first
    const createRes = await fetch(`${baseUrl}/v1/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: JSON.stringify({ name: 'Rotate Test Agent', framework: 'custom' })
    });
    assert.strictEqual(createRes.status, 201);
    const created = await createRes.json();
    assert.ok(created.agent?.id);
    assert.ok(created.vault?.id);
    assert.ok(created.apiKey?.startsWith('pb_live_'));
    // Critical: response must not leak private keys
    const raw = JSON.stringify(created);
    assert.ok(!raw.includes('encryptedPrivateKey'));
    assert.ok(!/0x[a-fA-F0-9]{64}/.test(raw) || !raw.includes('privateKey'));
    assert.ok(!('privateKey' in (created as object)));
    assert.strictEqual(created.vault.mode, 'offline');

    const rotateRes = await fetch(`${baseUrl}/v1/signers/rotate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: JSON.stringify({ vaultId: created.vault.id, agentId: created.agent.id })
    });
    assert.strictEqual(rotateRes.status, 200);
    const rotated = await rotateRes.json();
    assert.ok(rotated.newSignerAddress?.startsWith('0x'));
    assert.strictEqual(rotated.newSignerAddress.length, 42);
    assert.ok(!JSON.stringify(rotated).includes('encryptedPrivateKey'));
    assert.ok(!('privateKey' in rotated));
  });

  it('POST /v1/agents rejects one-step live attachment before agent publication', async () => {
    const before = db.getAgents('ws_default').length;
    const res = await fetch(`${baseUrl}/v1/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: JSON.stringify({
        name: 'Unsafe One Step Agent',
        framework: 'custom',
        vaultAddress: '0x2222222222222222222222222222222222222222'
      })
    });
    assert.strictEqual(res.status, 409);
    const body = await res.json();
    assert.strictEqual(body.error, 'LIVE_VAULT_REQUIRES_TWO_PHASE_SETUP');
    assert.strictEqual(db.getAgents('ws_default').length, before);
  });

  it('signer pause and revoke require explicit vault targets and pause state', async () => {
    const pauseRes = await fetch(`${baseUrl}/v1/signers/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: '{}'
    });
    assert.strictEqual(pauseRes.status, 400);

    const revokeRes = await fetch(`${baseUrl}/v1/signers/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: JSON.stringify({ agentId: 'ag_demo' })
    });
    assert.strictEqual(revokeRes.status, 400);
  });

  it('API responses fail closed when the persistence barrier cannot confirm state', async () => {
    const originalFlush = db.flushPersistence.bind(db);
    db.flushPersistence = async () => { throw new Error('simulated storage outage'); };
    try {
      const res = await fetch(`${baseUrl}/v1/workspaces`, {
        headers: { Authorization: `Bearer ${DEMO_KEY}` }
      });
      assert.strictEqual(res.status, 503);
      const body = await res.json();
      assert.strictEqual(body.error, 'PERSISTENCE_UNAVAILABLE');
    } finally {
      db.flushPersistence = originalFlush;
    }
  });

  it('agent payment keys cannot perform workspace-management actions', async () => {
    const createRes = await fetch(`${baseUrl}/v1/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: JSON.stringify({ name: 'Scoped Agent Key Test', framework: 'custom' })
    });
    assert.strictEqual(createRes.status, 201);
    const created = await createRes.json();
    const setupRes = await fetch(`${baseUrl}/v1/setup/status`, {
      headers: { Authorization: `Bearer ${created.apiKey}` }
    });
    assert.strictEqual(setupRes.status, 403);
    const body = await setupRes.json();
    assert.strictEqual(body.error, 'OPERATOR_KEY_REQUIRED');

    const agentsRes = await fetch(`${baseUrl}/v1/agents`, {
      headers: { Authorization: `Bearer ${created.apiKey}` }
    });
    assert.strictEqual(agentsRes.status, 200);
    const scopedAgents = await agentsRes.json();
    assert.deepStrictEqual(scopedAgents.map((agent: { id: string }) => agent.id), [created.agent.id]);

    const vaultsRes = await fetch(`${baseUrl}/v1/vaults`, {
      headers: { Authorization: `Bearer ${created.apiKey}` }
    });
    assert.strictEqual(vaultsRes.status, 200);
    const scopedVaults = await vaultsRes.json();
    assert.deepStrictEqual(scopedVaults.map((vault: { agentId: string }) => vault.agentId), [created.agent.id]);
  });

  it('POST /v1/signers/rotate refuses to drift a live vault from its on-chain agentKey', async () => {
    const createRes = await fetch(`${baseUrl}/v1/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: JSON.stringify({ name: 'Live Rotation Guard Agent', framework: 'custom' })
    });
    assert.strictEqual(createRes.status, 201);
    const created = await createRes.json();
    db.updateVault(created.vault.id, {
      mode: 'live',
      address: '0x2222222222222222222222222222222222222222'
    });

    const prepareRes = await fetch(`${baseUrl}/v1/signers/rotate/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: JSON.stringify({ vaultId: created.vault.id, agentId: created.agent.id })
    });
    assert.strictEqual(prepareRes.status, 201);
    const prepared = await prepareRes.json();
    assert.strictEqual(prepared.status, 'pending_owner_confirmation');
    assert.ok(prepared.newSignerAddress?.startsWith('0x'));

    const duplicatePrepareRes = await fetch(`${baseUrl}/v1/signers/rotate/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: JSON.stringify({ vaultId: created.vault.id, agentId: created.agent.id })
    });
    assert.strictEqual(duplicatePrepareRes.status, 409);
    const duplicateBody = await duplicatePrepareRes.json();
    assert.strictEqual(duplicateBody.error, 'PENDING_SIGNER_ALREADY_EXISTS');

    const confirmWithoutProof = await fetch(`${baseUrl}/v1/signers/rotate/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: JSON.stringify({ vaultId: created.vault.id, agentId: created.agent.id, newSignerAddress: prepared.newSignerAddress })
    });
    assert.strictEqual(confirmWithoutProof.status, 400);

    const rotateRes = await fetch(`${baseUrl}/v1/signers/rotate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: JSON.stringify({ vaultId: created.vault.id, agentId: created.agent.id })
    });
    assert.strictEqual(rotateRes.status, 409);
    const body = await rotateRes.json();
    assert.strictEqual(body.error, 'LIVE_VAULT_ROTATION_REQUIRES_OWNER');

    const rulePatchRes = await fetch(`${baseUrl}/v1/vaults/${created.vault.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: JSON.stringify({ dailyCapUsdc: 1, perTxCapUsdc: 1 })
    });
    assert.strictEqual(rulePatchRes.status, 409);
    const rulePatchBody = await rulePatchRes.json();
    assert.strictEqual(rulePatchBody.error, 'LIVE_VAULT_OWNER_ACTION_REQUIRED');

    const revokeRes = await fetch(`${baseUrl}/v1/signers/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: JSON.stringify({ vaultId: created.vault.id, agentId: created.agent.id })
    });
    assert.strictEqual(revokeRes.status, 200);
    const revoked = await revokeRes.json();
    assert.strictEqual(revoked.ownerActionRequired, true);
    assert.strictEqual(revoked.onChainAgentKeyStillAuthorized, true);
    assert.strictEqual(db.getVaultById(created.vault.id)?.paused, false);
    db.updateVault(created.vault.id, { mode: 'offline' });
  });

  it('PATCH /v1/vaults/:id updates spending rules used by preflight', async () => {
    const vaultsRes = await fetch(`${baseUrl}/v1/vaults`, {
      headers: { Authorization: `Bearer ${DEMO_KEY}` }
    });
    const vaults = await vaultsRes.json();
    const vault = vaults.find((v: { agentId: string }) => v.agentId === 'ag_demo') || vaults[0];

    const patchRes = await fetch(`${baseUrl}/v1/vaults/${vault.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: JSON.stringify({ perTxCapUsdc: 3.0, dailyCapUsdc: 50 })
    });
    assert.strictEqual(patchRes.status, 200);
    const updated = await patchRes.json();
    assert.strictEqual(updated.perTxCapUsdc, 3.0);
    assert.strictEqual(updated.dailyCapUsdc, 50);

    const payRes = await fetch(`${baseUrl}/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEMO_KEY}`
      },
      body: JSON.stringify({
        payeeAddress: ALLOWED_PAYEE,
        amountUsdc: 5.0,
        actionType: 1,
        idempotencyKey: `idemp_rules_${Date.now()}`
      })
    });
    assert.strictEqual(payRes.status, 403);
    const body = await payRes.json();
    assert.strictEqual(body.blockReasonCode, 'EXCEEDS_PER_TX_CAP');

    // Restore caps
    await fetch(`${baseUrl}/v1/vaults/${vault.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: JSON.stringify({ perTxCapUsdc: 25, dailyCapUsdc: 100 })
    });
  });

  it('PATCH /v1/vaults/:id rejects a syntactically valid but non-contract live address', async () => {
    const vaultsRes = await fetch(`${baseUrl}/v1/vaults`, {
      headers: { Authorization: `Bearer ${DEMO_KEY}` }
    });
    const vaults = await vaultsRes.json();
    const vault = vaults.find((v: { agentId: string }) => v.agentId === 'ag_demo') || vaults[0];
    const patchRes = await fetch(`${baseUrl}/v1/vaults/${vault.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEMO_KEY}` },
      body: JSON.stringify({ address: '0x1111111111111111111111111111111111111111' })
    });
    assert.strictEqual(patchRes.status, 400);
    const body = await patchRes.json();
    assert.ok(['NO_CONTRACT_CODE', 'VAULT_READ_FAILED', 'SIGNER_MISMATCH'].includes(body.error));
  });

  it('GET /v1/activity returns payment requests with filters', async () => {
    const res = await fetch(`${baseUrl}/v1/activity?workspaceId=ws_default`, {
      headers: { Authorization: `Bearer ${DEMO_KEY}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.paymentRequests));
    assert.ok(body.paymentRequests.length > 0);
  });

  it('managed signer encrypt/decrypt roundtrip never exposes key via provisionSigner return', async () => {
    const sampleKey = '0x' + crypto.randomBytes(32).toString('hex');
    const enc = encryptPrivateKey(sampleKey);
    assert.ok(enc.encryptedPrivateKey);
    assert.ok(enc.iv);
    assert.ok(enc.authTag);
    const dec = decryptPrivateKey(enc.encryptedPrivateKey, enc.iv, enc.authTag);
    assert.strictEqual(dec, sampleKey);

    const { address, record } = await signerService.provisionSigner('v_test_enc', `ag_enc_${Date.now()}`);
    assert.ok(address.startsWith('0x'));
    if (record.provider === 'circle') {
      assert.ok(record.walletId);
      assert.strictEqual(record.encryptedPrivateKey, '');
    } else {
      assert.ok(record.encryptedPrivateKey);
      // Public surface of provision is address + record; API routes must not serialize encrypted key to clients
      assert.notStrictEqual(record.encryptedPrivateKey, sampleKey);
    }
  });

  it('policy preflight pure function blocks paused vault without network', () => {
    const vault = db.getVaults('ws_default')[0];
    assert.ok(vault);
    const result = preflightPolicyCheck({
      vault: { ...vault, paused: true },
      payeeAddress: ALLOWED_PAYEE.toLowerCase() as `0x${string}`,
      amountUsdc: 1,
      actionType: 1
    });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.blockReasonCode, 'VAULT_PAUSED');
  });
});
