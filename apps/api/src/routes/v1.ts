import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { db, VaultRecord, ApiKeyRecord, Agent } from '../db/store.js';
import { signerService } from '../services/signer.js';
import { preflightPolicyCheck } from '../services/policy.js';
import { runPromptInjectionSimulation, INJECTION_FIXTURES } from '../services/simulation.js';
import {
  validateBody,
  paymentSchema,
  createAgentSchema,
  createPayeeSchema,
  updateVaultSchema,
  fundVaultSchema
} from '../middleware/validation.js';

export const v1Router = Router();

function isValidAddress(addr: string): addr is `0x${string}` {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/.test(addr);
}

// Middleware: Authenticate Agent API Key (Bearer pb_live_...)
export function authenticateApiKey(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid Authorization header. Provide Bearer pb_live_...'
    });
  }

  const rawKey = authHeader.substring(7).trim();
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const apiKeyRecord = db.getApiKeyByHash(keyHash);

  if (!apiKeyRecord) {
    return res.status(401).json({
      error: 'INVALID_API_KEY',
      message: 'The provided API key is invalid or has been revoked.'
    });
  }

  apiKeyRecord.lastUsedAt = new Date().toISOString();
  db.save();
  (req as any).apiKey = apiKeyRecord;
  (req as any).workspaceId = apiKeyRecord.workspaceId;
  (req as any).agentId = apiKeyRecord.agentId;
  next();
}

export function optionalAuthenticateApiKey(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const rawKey = authHeader.substring(7).trim();
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const apiKeyRecord = db.getApiKeyByHash(keyHash);
    if (apiKeyRecord) {
      apiKeyRecord.lastUsedAt = new Date().toISOString();
      db.save();
      (req as any).apiKey = apiKeyRecord;
      (req as any).workspaceId = apiKeyRecord.workspaceId;
      (req as any).agentId = apiKeyRecord.agentId;
    }
  }
  next();
}


/* ==========================================================================
   HOSTED PAYMENT API (PHASE 3)
   POST /v1/payments
   ========================================================================== */
v1Router.post('/payments', authenticateApiKey, validateBody(paymentSchema), async (req: Request, res: Response) => {
  try {
    const { payeeAddress, amountUsdc, actionType, idempotencyKey, metadataHash } = req.body;
    const workspaceId = (req as any).workspaceId as string;
    const agentId = (req as any).agentId as string;

    const effectiveIdempotencyKey = idempotencyKey || `idemp_${crypto.randomBytes(8).toString('hex')}`;

    // Check Idempotency
    const existing = db.getPaymentRequestByIdempotency(workspaceId, effectiveIdempotencyKey);
    if (existing) {
      return res.json({
        id: existing.id,
        idempotencyKey: existing.idempotencyKey,
        status: existing.status,
        amountUsdc: existing.amountUsdc,
        payeeAddress: existing.payeeAddress,
        payeeName: existing.payeeName,
        blockReasonCode: existing.blockReasonCode,
        blockReasonDescription: existing.blockReasonDescription,
        txHash: existing.txHash,
        explorerUrl: existing.txHash ? `https://testnet.arcscan.app/tx/${existing.txHash}` : undefined,
        cached: true
      });
    }

    // Get Agent & Vault — do NOT auto-provision dummy vaults on pay
    const vaults = db.getVaults(workspaceId).filter(v => v.agentId === agentId);
    const vault = vaults[0];

    if (!vault) {
      return res.status(400).json({
        error: 'NO_VAULT',
        message: 'No vault provisioned for this agent. Create an agent/vault in the dashboard first.',
        status: 'FAILED',
        blockReasonCode: 'NO_VAULT'
      });
    }

    // Preflight Policy Check (product-layer mirror of vault rules)
    const payeeAddrFormatted = payeeAddress.toLowerCase() as `0x${string}`;
    const preflight = preflightPolicyCheck({
      vault,
      payeeAddress: payeeAddrFormatted,
      amountUsdc,
      actionType: actionType ?? 1
    });

    const metaHashFormatted = (metadataHash && /^0x[0-9a-fA-F]{64}$/.test(metadataHash)
      ? metadataHash
      : `0x${crypto.createHash('sha256').update(effectiveIdempotencyKey).digest('hex')}`) as `0x${string}`;

    if (!preflight.allowed) {
      const prRecord = {
        id: `pr_${crypto.randomBytes(8).toString('hex')}`,
        workspaceId,
        agentId,
        vaultId: vault.id,
        idempotencyKey: effectiveIdempotencyKey,
        payeeAddress: payeeAddrFormatted,
        payeeName: db.getPayeeByAddress(payeeAddrFormatted)?.name || 'Unknown Payee',
        amountUsdc,
        actionType: actionType ?? 1,
        metadataHash: metaHashFormatted,
        status: 'BLOCKED' as const,
        blockReasonCode: preflight.blockReasonCode,
        blockReasonDescription: preflight.blockReasonDescription,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.addPaymentRequest(prRecord);

      return res.status(403).json({
        id: prRecord.id,
        idempotencyKey: prRecord.idempotencyKey,
        status: 'BLOCKED',
        blockReasonCode: preflight.blockReasonCode,
        blockReasonDescription: preflight.blockReasonDescription,
        vaultAddress: vault.address,
        vaultMode: vault.mode,
        preflightPassed: false,
        explorerUrl: vault.mode === 'live' ? `https://testnet.arcscan.app/address/${vault.address}` : undefined
      });
    }

    // Offline vaults: policy passed, but never claim EXECUTED or invent tx hashes
    if (vault.mode !== 'live') {
      const prRecord = {
        id: `pr_${crypto.randomBytes(8).toString('hex')}`,
        workspaceId,
        agentId,
        vaultId: vault.id,
        idempotencyKey: effectiveIdempotencyKey,
        payeeAddress: payeeAddrFormatted,
        payeeName: db.getPayeeByAddress(payeeAddrFormatted)?.name || 'Approved Payee',
        amountUsdc,
        actionType: actionType ?? 1,
        metadataHash: metaHashFormatted,
        status: 'FAILED' as const,
        blockReasonCode: 'OFFLINE_VAULT',
        blockReasonDescription:
          'Policy preflight passed, but this vault is in offline mode (no on-chain PeribolosVault address). Attach a live vault address to execute vault.pay on Arc Testnet. EXECUTED is never claimed without chain success.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.addPaymentRequest(prRecord);

      return res.status(200).json({
        id: prRecord.id,
        idempotencyKey: prRecord.idempotencyKey,
        status: 'FAILED',
        blockReasonCode: 'OFFLINE_VAULT',
        blockReasonDescription: prRecord.blockReasonDescription,
        amountUsdc: prRecord.amountUsdc,
        payeeAddress: prRecord.payeeAddress,
        payeeName: prRecord.payeeName,
        vaultAddress: vault.address,
        vaultMode: 'offline',
        preflightPassed: true,
        // Explicit: no fabricated proof
        txHash: undefined
      });
    }

    // Live vault: execute via managed signer only
    const signerRecord = db.getManagedSignerByAgent(agentId);
    if (!signerRecord) {
      const prRecord = {
        id: `pr_${crypto.randomBytes(8).toString('hex')}`,
        workspaceId,
        agentId,
        vaultId: vault.id,
        idempotencyKey: effectiveIdempotencyKey,
        payeeAddress: payeeAddrFormatted,
        payeeName: db.getPayeeByAddress(payeeAddrFormatted)?.name || 'Approved Payee',
        amountUsdc,
        actionType: actionType ?? 1,
        metadataHash: metaHashFormatted,
        status: 'FAILED' as const,
        blockReasonCode: 'NO_ACTIVE_SIGNER',
        blockReasonDescription: 'No active managed signer for this agent. Provision or rotate a signer.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.addPaymentRequest(prRecord);
      return res.status(200).json({
        id: prRecord.id,
        status: 'FAILED',
        blockReasonCode: 'NO_ACTIVE_SIGNER',
        blockReasonDescription: prRecord.blockReasonDescription,
        preflightPassed: true,
        vaultMode: 'live'
      });
    }

    const amountUsdcUnits = BigInt(Math.floor(amountUsdc * 1e6));
    const execution = await signerService.executeVaultPay({
      vaultAddress: vault.address,
      signerRecord,
      recipient: payeeAddrFormatted,
      amountUsdcUnits,
      actionType: actionType ?? 1,
      metadataHash: metaHashFormatted
    });

    const prRecord = {
      id: `pr_${crypto.randomBytes(8).toString('hex')}`,
      workspaceId,
      agentId,
      vaultId: vault.id,
      idempotencyKey: effectiveIdempotencyKey,
      payeeAddress: payeeAddrFormatted,
      payeeName: db.getPayeeByAddress(payeeAddrFormatted)?.name || 'Approved Payee',
      amountUsdc,
      actionType: actionType ?? 1,
      metadataHash: metaHashFormatted,
      status: execution.status,
      blockReasonCode: execution.reasonCode,
      blockReasonDescription: execution.reasonDescription,
      txHash: execution.txHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.addPaymentRequest(prRecord);

    const httpStatus = execution.status === 'BLOCKED' ? 403 : 200;
    return res.status(httpStatus).json({
      id: prRecord.id,
      idempotencyKey: prRecord.idempotencyKey,
      status: prRecord.status,
      amountUsdc: prRecord.amountUsdc,
      payeeAddress: prRecord.payeeAddress,
      payeeName: prRecord.payeeName,
      blockReasonCode: prRecord.blockReasonCode,
      blockReasonDescription: prRecord.blockReasonDescription,
      txHash: prRecord.txHash,
      vaultMode: 'live',
      preflightPassed: true,
      explorerUrl: prRecord.txHash ? `https://testnet.arcscan.app/tx/${prRecord.txHash}` : undefined
    });
  } catch (err: any) {
    console.error('[API] POST /v1/payments error:', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err?.message || err) });
  }
});

// GET /v1/payments/:id
v1Router.get('/payments/:id', authenticateApiKey, (req: Request, res: Response) => {
  const prs = db.getPaymentRequests((req as any).workspaceId);
  const found = prs.find(p => p.id === req.params.id);
  if (!found) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Payment request not found' });
  }
  return res.json(found);
});

/* ==========================================================================
   PROMPT INJECTION SIMULATIONS (PHASE 6)
   ========================================================================== */
v1Router.get('/simulations/scenarios', (_req: Request, res: Response) => {
  return res.json(INJECTION_FIXTURES);
});

v1Router.post('/simulations/prompt-injection', (req: Request, res: Response) => {
  const { scenarioId, vaultId } = req.body;
  const vaults = db.getVaults();
  const vault = (vaultId && db.getVaultById(vaultId)) || vaults[0];

  if (!vault) {
    return res.status(400).json({ error: 'NO_VAULT', message: 'No vault available for simulation' });
  }

  const agents = db.getAgents();
  const agent = agents.find(a => a.id === vault.agentId);

  const result = runPromptInjectionSimulation({
    scenarioId: scenarioId || 'scen_untrusted_drain',
    vault,
    agentName: agent?.name || 'Research Agent'
  });

  return res.json(result);
});

/* ==========================================================================
   ACTIVITY & AUDIT EXPORT (PHASE 5)
   ========================================================================== */
v1Router.get('/activity', (req: Request, res: Response) => {
  const wsId = (req.query.workspaceId as string) || 'ws_default';
  const statusFilter = req.query.status as string | undefined;
  let prs = db.getPaymentRequests(wsId);
  if (statusFilter) {
    prs = prs.filter(p => p.status === statusFilter);
  }
  const chainEvents = db.getChainEvents();
  return res.json({ paymentRequests: prs, chainEvents });
});

v1Router.get('/audit/export', (req: Request, res: Response) => {
  const format = (req.query.format as string) || 'csv';
  const wsId = (req.query.workspaceId as string) || 'ws_default';
  const prs = db.getPaymentRequests(wsId);

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="peribolos-audit-log.json"');
    return res.send(JSON.stringify(prs, null, 2));
  }

  const headers = [
    'ID',
    'Timestamp',
    'Agent ID',
    'Vault ID',
    'Payee Address',
    'Payee Name',
    'Amount (USDC)',
    'Action Type',
    'Status',
    'Block Reason Code',
    'TX Hash'
  ];
  const rows = prs.map(p =>
    [
      p.id,
      p.createdAt,
      p.agentId,
      p.vaultId,
      p.payeeAddress,
      `"${p.payeeName || ''}"`,
      p.amountUsdc,
      p.actionType,
      p.status,
      p.blockReasonCode || '',
      p.txHash || ''
    ].join(',')
  );

  const csv = [headers.join(','), ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="peribolos-audit-log.csv"');
  return res.send(csv);
});

/* ==========================================================================
   DASHBOARD V2 MANAGEMENT API ENDPOINTS (PHASE 4)
   ========================================================================== */
v1Router.get('/workspaces', (_req: Request, res: Response) => {
  return res.json(db.getWorkspaces());
});

v1Router.get('/agents', (req: Request, res: Response) => {
  const wsId = (req.query.workspaceId as string) || 'ws_default';
  return res.json(db.getAgents(wsId));
});

v1Router.post('/agents', optionalAuthenticateApiKey, validateBody(createAgentSchema), (req: Request, res: Response) => {
  const { name, description, framework, workspaceId, vaultAddress, ownerAddress } = req.body;
  const wsId = workspaceId || 'ws_default';
  const agentId = `ag_${crypto.randomBytes(8).toString('hex')}`;
  const vaultId = `v_${crypto.randomBytes(8).toString('hex')}`;

  const agent: Agent = {
    id: agentId,
    workspaceId: wsId,
    name: name || 'New Autonomous Agent',
    description: description || 'AI agent managed by Peribolos',
    framework: framework || 'langchain',
    status: 'active',
    createdAt: new Date().toISOString()
  };
  db.addAgent(agent);

  // Provision managed signer server-side only (key never leaves API)
  const { address: signerAddress } = signerService.provisionSigner(vaultId, agentId);

  // Live only when a real vault address is provided; otherwise honest offline mode
  const live = typeof vaultAddress === 'string' && isValidAddress(vaultAddress);
  const owner = typeof ownerAddress === 'string' && isValidAddress(ownerAddress)
    ? (ownerAddress as `0x${string}`)
    : ('0x0000000000000000000000000000000000000002' as `0x${string}`);

  const vault: VaultRecord = {
    id: vaultId,
    workspaceId: wsId,
    agentId,
    address: live
      ? (vaultAddress.toLowerCase() as `0x${string}`)
      : ('0x0000000000000000000000000000000000000001' as `0x${string}`),
    ownerAddress: owner,
    agentSignerAddress: signerAddress,
    treasuryAddress: owner,
    dailyCapUsdc: 100.0,
    perTxCapUsdc: 25.0,
    allowedActionsBitmap: 255,
    agentKeyExpiresAt: Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
    paused: false,
    mode: live ? 'live' : 'offline',
    createdAt: new Date().toISOString()
  };
  db.addVault(vault);

  const rawKey = `pb_live_${crypto.randomBytes(24).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const apiKeyRecord: ApiKeyRecord = {
    id: `key_${crypto.randomBytes(8).toString('hex')}`,
    workspaceId: wsId,
    agentId,
    keyPrefix: rawKey.substring(0, 12),
    keyHash,
    name: `${agent.name} API Key`,
    status: 'active',
    createdAt: new Date().toISOString()
  };
  db.addApiKey(apiKeyRecord);

  return res.status(201).json({
    agent,
    vault: {
      ...vault,
      // Never include signer private material
    },
    apiKey: rawKey, // Only returned ONCE upon creation
    note:
      vault.mode === 'offline'
        ? 'Vault is offline mode: policy preflight and simulations work; on-chain EXECUTED requires attaching a live PeribolosVault address.'
        : 'Vault is live mode: payments will submit vault.pay via managed signer.'
  });
});

v1Router.get('/vaults', (req: Request, res: Response) => {
  const wsId = (req.query.workspaceId as string) || 'ws_default';
  return res.json(db.getVaults(wsId));
});

/** Update spending rules (product-layer); live chain rule updates remain owner-controlled on contract. */
v1Router.patch('/vaults/:id', authenticateApiKey, validateBody(updateVaultSchema), (req: Request, res: Response) => {
  const vault = db.getVaultById(req.params.id);
  if (!vault) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Vault not found' });
  }

  const {
    dailyCapUsdc,
    perTxCapUsdc,
    allowedActionsBitmap,
    agentKeyExpiresAt,
    paused,
    mode,
    address,
    ownerAddress
  } = req.body;

  const updates: Partial<VaultRecord> = {};
  if (typeof dailyCapUsdc === 'number' && dailyCapUsdc > 0) updates.dailyCapUsdc = dailyCapUsdc;
  if (typeof perTxCapUsdc === 'number' && perTxCapUsdc > 0) updates.perTxCapUsdc = perTxCapUsdc;
  if (typeof allowedActionsBitmap === 'number') updates.allowedActionsBitmap = allowedActionsBitmap;
  if (typeof agentKeyExpiresAt === 'number') updates.agentKeyExpiresAt = agentKeyExpiresAt;
  if (typeof paused === 'boolean') updates.paused = paused;
  if (mode === 'live' || mode === 'offline') updates.mode = mode;
  if (typeof address === 'string' && isValidAddress(address)) {
    updates.address = address.toLowerCase() as `0x${string}`;
    updates.mode = 'live';
  }
  if (typeof ownerAddress === 'string' && isValidAddress(ownerAddress)) {
    updates.ownerAddress = ownerAddress.toLowerCase() as `0x${string}`;
    updates.treasuryAddress = ownerAddress.toLowerCase() as `0x${string}`;
  }

  const updated = db.updateVault(vault.id, updates);
  return res.json(updated);
});

/** Record a vault funding transfer (native Arc USDC → vault). Does not invent success. */
v1Router.post('/vaults/:id/fund', authenticateApiKey, validateBody(fundVaultSchema), (req: Request, res: Response) => {
  const vault = db.getVaultById(req.params.id);
  if (!vault) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Vault not found' });
  }
  const { amountUsdc, txHash, fromAddress } = req.body;
  if (vault.mode !== 'live') {
    return res.status(400).json({
      error: 'OFFLINE_VAULT',
      message: 'Cannot record fund for offline vault. Attach a live vault address first.'
    });
  }

  db.addChainEvent({
    id: `evt_fund_${crypto.randomBytes(6).toString('hex')}`,
    vaultAddress: vault.address,
    eventType: 'Funded',
    recipient: vault.address,
    agentKey: typeof fromAddress === 'string' ? (fromAddress as `0x${string}`) : undefined,
    amountUsdc,
    txHash: txHash as `0x${string}`,
    blockNumber: 0,
    timestamp: new Date().toISOString()
  });

  // Audit trail as a payment-request-like record is wrong; store as activity note via chain event only
  return res.status(201).json({
    vaultId: vault.id,
    amountUsdc,
    txHash,
    fromAddress: fromAddress || null,
    explorerUrl: `https://testnet.arcscan.app/tx/${txHash}`,
    message: 'Fund transfer recorded. On-chain balance is authoritative.'
  });
});

v1Router.get('/payees', (req: Request, res: Response) => {
  const wsId = (req.query.workspaceId as string) || 'ws_default';
  return res.json(db.getPayees(wsId));
});

v1Router.post('/payees', optionalAuthenticateApiKey, validateBody(createPayeeSchema), (req: Request, res: Response) => {
  const { name, address, category, description, allowedActionType, defaultLimitUsdc, workspaceId } = req.body;

  const payee = {
    id: `pay_${crypto.randomBytes(8).toString('hex')}`,
    workspaceId: workspaceId || 'ws_default',
    name,
    address: address.toLowerCase() as `0x${string}`,
    category: category || 'api',
    description: description || '',
    allowedActionType: allowedActionType ?? 1,
    defaultLimitUsdc: defaultLimitUsdc ?? 10.0,
    verified: true,
    createdAt: new Date().toISOString()
  };
  db.addPayee(payee);
  return res.status(201).json(payee);
});

v1Router.get('/api-keys', (req: Request, res: Response) => {
  const wsId = (req.query.workspaceId as string) || 'ws_default';
  const keys = db.getApiKeys(wsId);
  return res.json(keys.map(({ keyHash, ...rest }) => rest));
});

v1Router.post('/api-keys', authenticateApiKey, (req: Request, res: Response) => {
  const { agentId, name, workspaceId } = req.body;
  const wsId = workspaceId || 'ws_default';
  const rawKey = `pb_live_${crypto.randomBytes(24).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const apiKeyRecord: ApiKeyRecord = {
    id: `key_${crypto.randomBytes(8).toString('hex')}`,
    workspaceId: wsId,
    agentId: agentId || 'ag_demo',
    keyPrefix: rawKey.substring(0, 12),
    keyHash,
    name: name || 'Agent API Key',
    status: 'active',
    createdAt: new Date().toISOString()
  };
  db.addApiKey(apiKeyRecord);

  return res.status(201).json({
    apiKeyRecord: { id: apiKeyRecord.id, name: apiKeyRecord.name, keyPrefix: apiKeyRecord.keyPrefix },
    rawApiKey: rawKey
  });
});

v1Router.post('/signers/rotate', authenticateApiKey, (req: Request, res: Response) => {
  const { vaultId, agentId } = req.body;
  if (!vaultId || !agentId) {
    return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'vaultId and agentId are required' });
  }

  const { newAddress, newRecord } = signerService.rotateSigner(vaultId, agentId);
  db.updateVault(vaultId, { agentSignerAddress: newAddress });

  // Response must never include private key material
  return res.json({
    message: 'Managed signer rotated successfully',
    newSignerAddress: newAddress,
    signerRecordId: newRecord.id,
    status: newRecord.status
  });
});

v1Router.post('/signers/pause', authenticateApiKey, (req: Request, res: Response) => {
  const { vaultId, paused } = req.body;
  const vault = vaultId ? db.getVaultById(vaultId) : db.getVaults()[0];

  if (!vault) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Vault not found' });
  }

  const isPaused = paused !== undefined ? Boolean(paused) : !vault.paused;
  db.updateVault(vault.id, { paused: isPaused });

  return res.json({
    vaultId: vault.id,
    paused: isPaused,
    message: `Vault ${isPaused ? 'paused' : 'unpaused'} successfully`
  });
});

v1Router.post('/signers/revoke', authenticateApiKey, (req: Request, res: Response) => {
  const { agentId, vaultId } = req.body;
  if (!agentId) {
    return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'agentId is required' });
  }
  const ok = signerService.revokeSigner(agentId);
  if (vaultId) {
    db.updateVault(vaultId, { paused: true });
  }
  return res.json({
    revoked: ok,
    message: ok ? 'Managed signer revoked' : 'No active signer found'
  });
});
