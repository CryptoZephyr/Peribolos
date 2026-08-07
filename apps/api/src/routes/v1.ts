import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { formatUnits } from 'viem';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { db, VaultRecord, ApiKeyRecord, Agent, PaymentRequestRecord } from '../db/store.js';
import { signerService } from '../services/signer.js';
import { preflightPolicyCheck } from '../services/policy.js';
import { runPromptInjectionSimulation, INJECTION_FIXTURES } from '../services/simulation.js';
import {
  validateBody,
  paymentSchema,
  createAgentSchema,
  createPayeeSchema,
  updateVaultSchema,
  fundVaultSchema,
  createApiKeySchema,
  signerTargetSchema,
  signerConfirmSchema,
  signerPauseSchema,
  signerRevokeSchema,
  promptInjectionSchema,
  usdcAmountToUnits
} from '../middleware/validation.js';

export const v1Router = Router();

const MAX_AGENTS_PER_WORKSPACE = 100;

// Mutating and read endpoints must never serve an empty/in-memory production
// store after a persistence failure. Liveness/readiness stay available for
// operators, while the authenticated API fails closed until storage recovers.
v1Router.use((_req: Request, res: Response, next: Function) => {
  if (process.env.NODE_ENV === 'production') {
    const persistence = db.getPersistenceStatus();
    if (!persistence.configured || !persistence.healthy) {
      return res.status(503).json({
        error: 'PERSISTENCE_UNAVAILABLE',
        message: 'Workspace storage is temporarily unavailable. Retry after the service is ready.'
      });
    }
  }
  next();
});

// No API response may acknowledge a mutation before the complete workspace
// snapshot is durable. This also covers writes performed during authentication
// (new Supabase workspaces and API-key last-used timestamps).
v1Router.use((_req: Request, res: Response, next: Function) => {
  const originalJson = res.json.bind(res);
  let responseScheduled = false;
  res.json = ((body: unknown) => {
    if (responseScheduled) return res;
    responseScheduled = true;
    void db.flushPersistence()
      .then(() => originalJson(body))
      .catch(() => {
        if (res.headersSent) return;
        res.status(503);
        originalJson({
          error: 'PERSISTENCE_UNAVAILABLE',
          message: 'The request was not acknowledged because workspace storage could not confirm the update. Retry after the service is ready.'
        });
      });
    return res;
  }) as Response['json'];
  next();
});

let supabaseAuthClient: SupabaseClient | null | undefined;
function getSupabaseAuthClient(): SupabaseClient | null {
  if (supabaseAuthClient !== undefined) return supabaseAuthClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  supabaseAuthClient = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return supabaseAuthClient;
}

function isValidAddress(addr: string): addr is `0x${string}` {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/.test(addr);
}

function sendCachedPayment(res: Response, existing: PaymentRequestRecord) {
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

function assertVaultInWorkspace(vaultId: string, workspaceId: string, res: Response): VaultRecord | undefined {
  const vault = db.getVaultById(vaultId);
  if (!vault) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Vault not found' });
    return undefined;
  }
  if (vault.workspaceId !== workspaceId) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Vault does not belong to this workspace.' });
    return undefined;
  }
  return vault;
}

function csvCell(value: unknown): string {
  const raw = value === undefined || value === null ? '' : String(value);
  const escapedFormula = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${escapedFormula.replace(/"/g, '""')}"`;
}

function safeErrorMessage(error: unknown, fallback: string): string {
  if (process.env.NODE_ENV === 'production') return fallback;
  return error instanceof Error ? error.message.slice(0, 300) : fallback;
}

// Middleware: authenticate either an agent API key or a Supabase user session.
export async function authenticateApiKey(req: Request, res: Response, next: Function) {
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

  if (apiKeyRecord) {
    apiKeyRecord.lastUsedAt = new Date().toISOString();
    db.save();
    (req as any).apiKey = apiKeyRecord;
    (req as any).workspaceId = apiKeyRecord.workspaceId;
    (req as any).agentId = apiKeyRecord.agentId;
    return next();
  }

  const authClient = getSupabaseAuthClient();
  if (!authClient) {
    return res.status(401).json({ error: 'INVALID_API_KEY', message: 'The provided API key is invalid or has been revoked.' });
  }
  const { data, error } = await authClient.auth.getUser(rawKey);
  if (error || !data.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'The provided session is invalid or expired.' });
  }
  const email = data.user.email || `${data.user.id}@supabase.local`;
  const workspaceId = db.getOrCreateExternalWorkspace(data.user.id, email);
  (req as any).supabaseUser = data.user;
  (req as any).workspaceId = workspaceId;
  (req as any).authMode = 'supabase';
  next();
}

/** Workspace-management actions require an operator key, not an agent payment key. */
export function requireOperator(req: Request, res: Response, next: Function) {
  const key = (req as any).apiKey as ApiKeyRecord | undefined;
  const supabaseUser = (req as any).supabaseUser as { id?: string } | undefined;
  const externalUser = supabaseUser?.id ? db.getUserByExternalAuthId(supabaseUser.id) : undefined;
  const isSupabaseOperator = (req as any).authMode === 'supabase'
    && (externalUser?.role === 'owner' || externalUser?.role === 'admin');
  if (!isSupabaseOperator && key?.role !== 'operator') {
    return res.status(403).json({
      error: 'OPERATOR_KEY_REQUIRED',
      message: 'This workspace-management action requires an operator API key.'
    });
  }
  next();
}

function scopedAgentId(req: Request): string | undefined {
  const key = (req as any).apiKey as ApiKeyRecord | undefined;
  return key?.role === 'operator' ? undefined : (req as any).agentId as string | undefined;
}

/* ==========================================================================
   HOSTED PAYMENT API (PHASE 3)
   POST /v1/payments
   ========================================================================== */
v1Router.post('/payments', authenticateApiKey, validateBody(paymentSchema), async (req: Request, res: Response) => {
  try {
    if (!(req as any).apiKey) {
      return res.status(403).json({ error: 'AGENT_API_KEY_REQUIRED', message: 'Payments require the agent API key, not a user session.' });
    }
    const { payeeAddress, amountUsdc, actionType, idempotencyKey, metadataHash } = req.body;
    const workspaceId = (req as any).workspaceId as string;
    const agentId = (req as any).agentId as string;

    const effectiveIdempotencyKey = idempotencyKey || `idemp_${crypto.randomBytes(8).toString('hex')}`;

    // Check Idempotency
    const existing = db.getPaymentRequestByIdempotency(workspaceId, effectiveIdempotencyKey);
    if (existing) {
      return sendCachedPayment(res, existing);
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
        payeeName: db.getPayeeByAddress(payeeAddrFormatted, workspaceId)?.name || 'Unknown Payee',
        amountUsdc,
        actionType: actionType ?? 1,
        metadataHash: metaHashFormatted,
        status: 'BLOCKED' as const,
        blockReasonCode: preflight.blockReasonCode,
        blockReasonDescription: preflight.blockReasonDescription,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const reserved = db.addPaymentRequestIfAbsent(prRecord);
      if (reserved.id !== prRecord.id) return sendCachedPayment(res, reserved);

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
        payeeName: db.getPayeeByAddress(payeeAddrFormatted, workspaceId)?.name || 'Approved Payee',
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
      const reserved = db.addPaymentRequestIfAbsent(prRecord);
      if (reserved.id !== prRecord.id) return sendCachedPayment(res, reserved);

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
        payeeName: db.getPayeeByAddress(payeeAddrFormatted, workspaceId)?.name || 'Approved Payee',
        amountUsdc,
        actionType: actionType ?? 1,
        metadataHash: metaHashFormatted,
        status: 'FAILED' as const,
        blockReasonCode: 'NO_ACTIVE_SIGNER',
        blockReasonDescription: 'No active managed signer for this agent. Provision or rotate a signer.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const reserved = db.addPaymentRequestIfAbsent(prRecord);
      if (reserved.id !== prRecord.id) return sendCachedPayment(res, reserved);
      return res.status(200).json({
        id: prRecord.id,
        status: 'FAILED',
        blockReasonCode: 'NO_ACTIVE_SIGNER',
        blockReasonDescription: prRecord.blockReasonDescription,
        preflightPassed: true,
        vaultMode: 'live'
      });
    }

    const pendingRecord = db.addPaymentRequestIfAbsent({
      id: `pr_${crypto.randomBytes(8).toString('hex')}`,
      workspaceId,
      agentId,
      vaultId: vault.id,
      idempotencyKey: effectiveIdempotencyKey,
      payeeAddress: payeeAddrFormatted,
      payeeName: db.getPayeeByAddress(payeeAddrFormatted, workspaceId)?.name || 'Approved Payee',
      amountUsdc,
      actionType: actionType ?? 1,
      metadataHash: metaHashFormatted,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    if (pendingRecord.status !== 'PENDING') return sendCachedPayment(res, pendingRecord);

    const amountUsdcUnits = usdcAmountToUnits(amountUsdc);
    const execution = await signerService.executeVaultPay({
      vaultAddress: vault.address,
      signerRecord,
      recipient: payeeAddrFormatted,
      amountUsdcUnits,
      actionType: actionType ?? 1,
      metadataHash: metaHashFormatted
    });

    const prRecord = db.updatePaymentRequest(pendingRecord.id, {
      status: execution.status,
      blockReasonCode: execution.reasonCode,
      blockReasonDescription: execution.reasonDescription,
      txHash: execution.txHash
    })!;

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
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: safeErrorMessage(err, 'Unable to process the payment request.') });
  }
});

// GET /v1/payments/:id
v1Router.get('/payments/:id', authenticateApiKey, (req: Request, res: Response) => {
  const prs = db.getPaymentRequests((req as any).workspaceId);
  const found = prs.find(p => p.id === req.params.id);
  if (!found || (scopedAgentId(req) && found.agentId !== scopedAgentId(req))) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Payment request not found' });
  }
  return res.json(found);
});

/* ==========================================================================
   PROMPT INJECTION SIMULATIONS (PHASE 6)
   ========================================================================== */
v1Router.get('/simulations/scenarios', authenticateApiKey, (_req: Request, res: Response) => {
  return res.json(INJECTION_FIXTURES);
});

v1Router.post('/simulations/prompt-injection', authenticateApiKey, validateBody(promptInjectionSchema), (req: Request, res: Response) => {
  const { scenarioId, vaultId } = req.body;
  const workspaceId = (req as any).workspaceId as string;
  const vaults = db.getVaults(workspaceId);
  const requestedVault = vaultId && db.getVaultById(vaultId);
  const vault = requestedVault || vaults.find(v => !scopedAgentId(req) || v.agentId === scopedAgentId(req));

  if (!vault || vault.workspaceId !== workspaceId || (scopedAgentId(req) && vault.agentId !== scopedAgentId(req))) {
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
v1Router.get('/activity', authenticateApiKey, (req: Request, res: Response) => {
  const wsId = (req as any).workspaceId as string;
  const statusFilter = req.query.status as string | undefined;
  let prs = db.getPaymentRequests(wsId);
  const agentId = scopedAgentId(req);
  if (agentId) prs = prs.filter(p => p.agentId === agentId);
  if (statusFilter) {
    prs = prs.filter(p => p.status === statusFilter);
  }
  const workspaceVaults = new Set(db.getVaults(wsId).map(v => v.address.toLowerCase()));
  const chainEvents = db.getChainEvents().filter(e => workspaceVaults.has(e.vaultAddress.toLowerCase()));
  return res.json({ paymentRequests: prs, chainEvents });
});

v1Router.get('/audit/export', authenticateApiKey, (req: Request, res: Response) => {
  const format = (req.query.format as string) || 'csv';
  const wsId = (req as any).workspaceId as string;
  const agentId = scopedAgentId(req);
  const prs = db.getPaymentRequests(wsId).filter(p => !agentId || p.agentId === agentId);

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
      p.payeeName || '',
      p.amountUsdc,
      p.actionType,
      p.status,
      p.blockReasonCode || '',
      p.txHash || ''
    ].map(csvCell).join(',')
  );

  const csv = [headers.join(','), ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="peribolos-audit-log.csv"');
  return res.send(csv);
});

/* ==========================================================================
   DASHBOARD V2 MANAGEMENT API ENDPOINTS (PHASE 4)
   ========================================================================== */
v1Router.get('/setup/status', authenticateApiKey, requireOperator, (_req: Request, res: Response) => {
  return res.json({
    signer: signerService.getReadiness(),
    vaultExecution: {
      network: 'Arc Testnet',
      chainId: 5042002,
      authorizationModel:
        'Agents initiate vault.pay; the on-chain PeribolosVault enforces allowlist, caps, pause, expiry, and balance before any USDC moves.',
    },
  });
});

/**
 * Return safe, workspace-scoped signer linkage metadata.  This deliberately
 * omits Circle wallet ids and all key material; the active address and the
 * vault's recorded agent key are enough for an operator to fund and verify
 * the correct wallet after a rotation.
 */
v1Router.get('/signers/status', authenticateApiKey, requireOperator, (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId as string;
  const agents = db.getAgents(workspaceId);
  const rows = agents.map(agent => {
    const vault = db.getVaults(workspaceId).find(candidate => candidate.agentId === agent.id);
    const signer = db.getManagedSignerByAgent(agent.id);
    const activeSignerAddress = signer?.address;
    const vaultSignerAddress = vault?.agentSignerAddress;
    return {
      agentId: agent.id,
      vaultId: vault?.id,
      vaultAddress: vault?.address,
      vaultMode: vault?.mode,
      activeSignerAddress,
      provider: signer?.provider || (signer ? 'local' : undefined),
      signerStatus: signer?.status,
      dbAligned: Boolean(
        activeSignerAddress && vaultSignerAddress &&
        activeSignerAddress.toLowerCase() === vaultSignerAddress.toLowerCase()
      ),
      vaultSignerAddress,
    };
  });

  return res.json({
    network: 'Arc Testnet',
    chainId: 5042002,
    agents: rows,
  });
});

v1Router.get('/workspaces', authenticateApiKey, requireOperator, (req: Request, res: Response) => {
  const wsId = (req as any).workspaceId as string;
  return res.json(db.getWorkspaces().filter(w => w.id === wsId));
});

v1Router.get('/agents', authenticateApiKey, (req: Request, res: Response) => {
  const wsId = (req as any).workspaceId as string;
  const agentId = scopedAgentId(req);
  return res.json(db.getAgents(wsId).filter(agent => !agentId || agent.id === agentId));
});

v1Router.post('/agents', authenticateApiKey, requireOperator, validateBody(createAgentSchema), async (req: Request, res: Response) => {
  const { name, description, framework, vaultAddress, ownerAddress } = req.body;
  const wsId = (req as any).workspaceId as string;
  if (db.getAgents(wsId).length >= MAX_AGENTS_PER_WORKSPACE) {
    return res.status(429).json({
      error: 'AGENT_LIMIT_REACHED',
      message: `This workspace can have at most ${MAX_AGENTS_PER_WORKSPACE} agents.`
    });
  }
  const agentId = `ag_${crypto.randomBytes(8).toString('hex')}`;
  const vaultId = `v_${crypto.randomBytes(8).toString('hex')}`;

  // A new managed signer cannot already be the agentKey of an existing live
  // vault. Enforce the safe two-phase flow before creating a Circle wallet:
  // provision offline, deploy/rotate with that address, then attach the vault.
  if (vaultAddress !== undefined) {
    return res.status(409).json({
      error: 'LIVE_VAULT_REQUIRES_TWO_PHASE_SETUP',
      message: 'Create the agent first, deploy or rotate the vault to its returned signer address, then attach the live vault from the Vaults page.'
    });
  }

  const agent: Agent = {
    id: agentId,
    workspaceId: wsId,
    name: name || 'New Autonomous Agent',
    description: description || 'AI agent managed by Peribolos',
    framework: framework || 'langchain',
    status: 'active',
    createdAt: new Date().toISOString()
  };
  // In Circle mode this creates the Arc Testnet DCW used by the later vault deployment.
  let signerAddress: `0x${string}`;
  try {
    const provisioned = await signerService.provisionSigner(vaultId, agentId);
    signerAddress = provisioned.address;
  } catch (err) {
    return res.status(503).json({
      error: 'SIGNER_PROVISIONING_FAILED',
      message: safeErrorMessage(err, 'Unable to provision an agent signer.')
    });
  }
  db.addAgent(agent);
  const owner = typeof ownerAddress === 'string' && isValidAddress(ownerAddress)
    ? (ownerAddress as `0x${string}`)
    : ('0x0000000000000000000000000000000000000002' as `0x${string}`);

  const vault: VaultRecord = {
    id: vaultId,
    workspaceId: wsId,
    agentId,
    address: '0x0000000000000000000000000000000000000001' as `0x${string}`,
    ownerAddress: owner,
    agentSignerAddress: signerAddress,
    treasuryAddress: owner,
    dailyCapUsdc: 100.0,
    perTxCapUsdc: 25.0,
    allowedActionsBitmap: 255,
    agentKeyExpiresAt: Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
    paused: false,
    mode: 'offline',
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
    role: 'agent',
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
    note: 'Vault starts in offline policy mode. Deploy a PeribolosVault with the returned signer, then attach it to enable on-chain execution.'
  });
});

v1Router.get('/vaults', authenticateApiKey, (req: Request, res: Response) => {
  const wsId = (req as any).workspaceId as string;
  const agentId = scopedAgentId(req);
  return res.json(db.getVaults(wsId).filter(vault => !agentId || vault.agentId === agentId));
});

/** Read authoritative vault authorization and USDC state from Arc Testnet. */
v1Router.get('/vaults/:id/chain-state', authenticateApiKey, requireOperator, async (req: Request, res: Response) => {
  const vault = db.getVaultById(req.params.id);
  if (!vault) return res.status(404).json({ error: 'NOT_FOUND', message: 'Vault not found' });
  if (vault.workspaceId !== (req as any).workspaceId) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Vault does not belong to this workspace.' });
  }
  if (vault.mode !== 'live') {
    return res.status(400).json({
      error: 'OFFLINE_VAULT',
      message: 'This vault has no authoritative Arc contract state until a live vault is attached.'
    });
  }
  if (!isValidAddress(vault.address)) {
    return res.status(400).json({ error: 'INVALID_VAULT_ADDRESS', message: 'Vault address is not a valid 20-byte address.' });
  }
  try {
    const state = await signerService.readVaultState(vault.address);
    return res.json({
      network: 'Arc Testnet',
      chainId: 5042002,
      vaultId: vault.id,
      vaultAddress: vault.address,
      ownerAddress: state.owner,
      agentKey: state.agentKey,
      agentKeyExpiresAt: Number(state.agentExpiry),
      usdcToken: state.usdcToken,
      balanceUsdc: state.balanceUsdc,
      balanceUsdcUnits: state.balanceUsdcUnits.toString(),
      paused: state.paused,
      perTxCapUsdc: formatUnits(state.perTxCapUsdcUnits, 6),
      dailyCapUsdc: formatUnits(state.dailyCapUsdcUnits, 6),
      floatAmountUsdc: formatUnits(state.floatAmountUsdcUnits, 6),
      allowedActionsBitmap: state.allowedActions.toString(),
      epochSpentUsdc: formatUnits(state.epochSpentUsdcUnits, 6),
      explorerUrl: `https://testnet.arcscan.app/address/${vault.address}`
    });
  } catch (err) {
    return res.status(502).json({
      error: 'CHAIN_STATE_READ_FAILED',
      message: safeErrorMessage(err, 'Unable to read the vault from Arc Testnet.')
    });
  }
});

/** Update spending rules (product-layer); live chain rule updates remain owner-controlled on contract. */
v1Router.patch('/vaults/:id', authenticateApiKey, requireOperator, validateBody(updateVaultSchema), async (req: Request, res: Response) => {
  const vault = db.getVaultById(req.params.id);
  if (!vault) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Vault not found' });
  }
  if (vault.workspaceId !== (req as any).workspaceId) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Vault does not belong to this workspace.' });
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

  const changesContractControlledState = vault.mode === 'live' && [
    dailyCapUsdc,
    perTxCapUsdc,
    allowedActionsBitmap,
    agentKeyExpiresAt,
    paused,
    mode,
    address,
    ownerAddress,
  ].some(value => value !== undefined);
  if (changesContractControlledState) {
    return res.status(409).json({
      error: 'LIVE_VAULT_OWNER_ACTION_REQUIRED',
      message: 'This live vault is controlled by its Arc contract. Use the connected owner wallet, then sync the authoritative chain state.'
    });
  }

  const updates: Partial<VaultRecord> = {};
  if (typeof dailyCapUsdc === 'number' && dailyCapUsdc > 0) updates.dailyCapUsdc = dailyCapUsdc;
  if (typeof perTxCapUsdc === 'number' && perTxCapUsdc > 0) updates.perTxCapUsdc = perTxCapUsdc;
  if (typeof allowedActionsBitmap === 'number') updates.allowedActionsBitmap = allowedActionsBitmap;
  if (typeof agentKeyExpiresAt === 'number') updates.agentKeyExpiresAt = agentKeyExpiresAt;
  if (typeof paused === 'boolean') updates.paused = paused;
  if (mode === 'live' || mode === 'offline') updates.mode = mode;
  if (typeof address === 'string' && isValidAddress(address)) {
    const managedSigner = db.getManagedSignerByAgent(vault.agentId);
    const verification = await signerService.verifyVaultAddress(
      address.toLowerCase() as `0x${string}`,
      managedSigner?.address
    );
    if (!verification.valid) {
      return res.status(400).json({
        error: verification.reasonCode || 'INVALID_LIVE_VAULT',
        message: verification.reasonDescription || 'The address is not a compatible live Peribolos vault on Arc Testnet.',
        agentKey: verification.agentKey
      });
    }
    const state = await signerService.readVaultState(address.toLowerCase() as `0x${string}`);
    if (typeof ownerAddress === 'string' && state.owner.toLowerCase() !== ownerAddress.toLowerCase()) {
      return res.status(409).json({
        error: 'VAULT_OWNER_MISMATCH',
        message: `Arc reports ${state.owner} as the vault owner; the supplied owner address was not linked.`
      });
    }
    updates.address = address.toLowerCase() as `0x${string}`;
    updates.mode = 'live';
    updates.agentSignerAddress = verification.agentKey || managedSigner?.address;
    updates.ownerAddress = state.owner;
    updates.treasuryAddress = state.owner;
    updates.dailyCapUsdc = Number(formatUnits(state.dailyCapUsdcUnits, 6));
    updates.perTxCapUsdc = Number(formatUnits(state.perTxCapUsdcUnits, 6));
    updates.allowedActionsBitmap = Number(state.allowedActions);
    updates.agentKeyExpiresAt = Number(state.agentExpiry);
    updates.paused = state.paused;
  }
  if (vault.mode !== 'live' && typeof ownerAddress === 'string' && isValidAddress(ownerAddress) && !updates.address) {
    updates.ownerAddress = ownerAddress.toLowerCase() as `0x${string}`;
    updates.treasuryAddress = ownerAddress.toLowerCase() as `0x${string}`;
  }

  const updated = db.updateVault(vault.id, updates);
  return res.json(updated);
});

/** Refresh the product mirror only from authoritative Arc contract state. */
v1Router.post('/vaults/:id/sync', authenticateApiKey, requireOperator, async (req: Request, res: Response) => {
  const vault = assertVaultInWorkspace(req.params.id, (req as any).workspaceId, res);
  if (!vault) return;
  if (vault.mode !== 'live' || !isValidAddress(vault.address)) {
    return res.status(400).json({ error: 'LIVE_VAULT_REQUIRED', message: 'Only a live Arc vault can be synced.' });
  }
  try {
    const state = await signerService.readVaultState(vault.address);
    const updated = db.updateVault(vault.id, {
      ownerAddress: state.owner,
      treasuryAddress: state.owner,
      agentSignerAddress: state.agentKey,
      dailyCapUsdc: Number(formatUnits(state.dailyCapUsdcUnits, 6)),
      perTxCapUsdc: Number(formatUnits(state.perTxCapUsdcUnits, 6)),
      allowedActionsBitmap: Number(state.allowedActions),
      agentKeyExpiresAt: Number(state.agentExpiry),
      paused: state.paused,
    });
    return res.json({
      vault: updated,
      source: 'arc-testnet',
      blockState: {
        floatAmountUsdc: formatUnits(state.floatAmountUsdcUnits, 6),
        balanceUsdc: state.balanceUsdc,
        epochSpentUsdc: formatUnits(state.epochSpentUsdcUnits, 6),
      }
    });
  } catch (err) {
    return res.status(502).json({
      error: 'CHAIN_STATE_SYNC_FAILED',
      message: safeErrorMessage(err, 'Unable to sync the vault from Arc Testnet.')
    });
  }
});

/** Record a vault funding transfer (native Arc USDC → vault) only after receipt verification. */
v1Router.post('/vaults/:id/fund', authenticateApiKey, requireOperator, validateBody(fundVaultSchema), async (req: Request, res: Response) => {
  const vault = db.getVaultById(req.params.id);
  if (!vault) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Vault not found' });
  }
  if (vault.workspaceId !== (req as any).workspaceId) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Vault does not belong to this workspace.' });
  }
  const { amountUsdc, txHash, fromAddress } = req.body;
  if (vault.mode !== 'live') {
    return res.status(400).json({
      error: 'OFFLINE_VAULT',
      message: 'Cannot record fund for offline vault. Attach a live vault address first.'
    });
  }

  const verification = await signerService.verifyNativeFundingTransaction({
    vaultAddress: vault.address,
    txHash: txHash as `0x${string}`,
    expectedAmountUsdc: amountUsdc,
    expectedFromAddress: fromAddress as `0x${string}` | undefined
  });
  if (!verification.valid) {
    return res.status(verification.retryable ? 502 : 400).json({
      error: verification.reasonCode,
      message: verification.reasonDescription
    });
  }

  db.addChainEvent({
    id: `evt_fund_${txHash.slice(2, 14).toLowerCase()}`,
    vaultAddress: vault.address,
    eventType: 'Funded',
    recipient: vault.address,
    agentKey: verification.fromAddress,
    amountUsdc: verification.amountUsdc,
    txHash: txHash as `0x${string}`,
    blockNumber: verification.blockNumber,
    timestamp: new Date().toISOString()
  });

  // Audit trail as a payment-request-like record is wrong; store as activity note via chain event only
  return res.status(201).json({
    vaultId: vault.id,
    amountUsdc: verification.amountUsdc,
    txHash,
    fromAddress: verification.fromAddress,
    blockNumber: verification.blockNumber,
    explorerUrl: `https://testnet.arcscan.app/tx/${txHash}`,
    message: 'Fund transfer verified on Arc Testnet. On-chain balance remains authoritative.'
  });
});

v1Router.get('/payees', authenticateApiKey, (req: Request, res: Response) => {
  const wsId = (req as any).workspaceId as string;
  return res.json(db.getPayees(wsId));
});

v1Router.post('/payees', authenticateApiKey, requireOperator, validateBody(createPayeeSchema), (req: Request, res: Response) => {
  const { name, address, category, description, allowedActionType, defaultLimitUsdc } = req.body;
  const workspaceId = (req as any).workspaceId as string;

  const payee = {
    id: `pay_${crypto.randomBytes(8).toString('hex')}`,
    workspaceId,
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

v1Router.get('/api-keys', authenticateApiKey, requireOperator, (req: Request, res: Response) => {
  const wsId = (req as any).workspaceId as string;
  const keys = db.getApiKeys(wsId);
  return res.json(keys.map(({ keyHash, ...rest }) => rest));
});

v1Router.post('/api-keys', authenticateApiKey, requireOperator, validateBody(createApiKeySchema), (req: Request, res: Response) => {
  const { agentId, name, role } = req.body;
  const wsId = (req as any).workspaceId as string;
  if (db.getApiKeys(wsId).filter(key => key.status === 'active').length >= 100) {
    return res.status(429).json({ error: 'API_KEY_LIMIT_REACHED', message: 'This workspace has reached its active API key limit.' });
  }
  const targetAgentId = agentId || (req as any).agentId;
  const targetAgent = db.getAgents(wsId).find(a => a.id === targetAgentId);
  if (!targetAgent) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Agent does not belong to this workspace.' });
  }
  const rawKey = `pb_live_${crypto.randomBytes(24).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const apiKeyRecord: ApiKeyRecord = {
    id: `key_${crypto.randomBytes(8).toString('hex')}`,
    workspaceId: wsId,
    agentId: targetAgentId,
    keyPrefix: rawKey.substring(0, 12),
    keyHash,
    name,
    role,
    status: 'active',
    createdAt: new Date().toISOString()
  };
  db.addApiKey(apiKeyRecord);

  return res.status(201).json({
    apiKeyRecord: { id: apiKeyRecord.id, name: apiKeyRecord.name, keyPrefix: apiKeyRecord.keyPrefix, role: apiKeyRecord.role },
    rawApiKey: rawKey
  });
});

function revokeApiKey(req: Request, res: Response) {
  const workspaceId = (req as any).workspaceId as string;
  const key = db.revokeApiKey(workspaceId, req.params.id);
  if (!key) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'API key not found in this workspace.' });
  }
  return res.json({ id: key.id, status: key.status, message: 'API key revoked. Future requests using it are rejected.' });
}

v1Router.post('/api-keys/:id/revoke', authenticateApiKey, requireOperator, revokeApiKey);
v1Router.delete('/api-keys/:id', authenticateApiKey, requireOperator, revokeApiKey);

v1Router.post('/signers/rotate', authenticateApiKey, requireOperator, validateBody(signerTargetSchema), async (req: Request, res: Response) => {
  const { vaultId, agentId } = req.body;
  if (!vaultId || !agentId) {
    return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'vaultId and agentId are required' });
  }
  const vault = assertVaultInWorkspace(vaultId, (req as any).workspaceId, res);
  if (!vault) return;
  if (vault.agentId !== agentId) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Vault is not owned by this agent.' });
  }
  if (vault.mode === 'live') {
    return res.status(409).json({
      error: 'LIVE_VAULT_ROTATION_REQUIRES_OWNER',
      message:
        'This vault is live on Arc Testnet. Rotate its agentKey from the owner wallet first; managed signer rotation is disabled until an owner-authorized on-chain rotation flow is completed.'
    });
  }

  let newAddress: `0x${string}`;
  let newRecord: import('../db/store.js').ManagedSignerRecord;
  try {
    ({ newAddress, newRecord } = await signerService.rotateSigner(vaultId, agentId));
  } catch (err) {
    return res.status(503).json({
      error: 'SIGNER_ROTATION_FAILED',
      message: safeErrorMessage(err, 'Unable to rotate the agent signer.')
    });
  }
  db.updateVault(vaultId, { agentSignerAddress: newAddress });

  // Response must never include private key material
  return res.json({
    message: 'Managed signer rotated successfully',
    newSignerAddress: newAddress,
    signerRecordId: newRecord.id,
    status: newRecord.status
  });
});

/**
 * Prepare a live-vault rotation without changing the active signer. The owner
 * must call rotateAgentKey on-chain, then confirm it through the endpoint below.
 */
v1Router.post('/signers/rotate/prepare', authenticateApiKey, requireOperator, validateBody(signerTargetSchema), async (req: Request, res: Response) => {
  const { vaultId, agentId } = req.body;
  if (!vaultId || !agentId) {
    return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'vaultId and agentId are required' });
  }
  const vault = assertVaultInWorkspace(vaultId, (req as any).workspaceId, res);
  if (!vault) return;
  if (vault.agentId !== agentId) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Vault is not owned by this agent.' });
  }
  if (vault.mode !== 'live') {
    return res.status(400).json({
      error: 'LIVE_VAULT_REQUIRED',
      message: 'Two-phase owner rotation is only required for live Arc vaults; use the regular rotation endpoint for offline signers.'
    });
  }

  const existingPending = db.getPendingManagedSigner(vault.id, agentId);
  if (existingPending) {
    return res.status(409).json({
      error: 'PENDING_SIGNER_ALREADY_EXISTS',
      message: 'This vault already has a pending signer. Complete or cancel that owner rotation before provisioning another wallet.',
      newSignerAddress: existingPending.address,
      signerRecordId: existingPending.id
    });
  }

  try {
    const { address, record } = await signerService.provisionSigner(vault.id, agentId, 'pending');
    return res.status(201).json({
      vaultId: vault.id,
      agentId,
      newSignerAddress: address,
      signerRecordId: record.id,
      status: 'pending_owner_confirmation',
      message: 'Submit rotateAgentKey(newSignerAddress, newExpiry) from the vault owner wallet, then confirm the transaction here.'
    });
  } catch (err) {
    return res.status(503).json({
      error: 'SIGNER_ROTATION_PREPARE_FAILED',
      message: safeErrorMessage(err, 'Unable to provision a pending signer.')
    });
  }
});

/** Promote a prepared signer only after Arc reports it as the vault agentKey. */
v1Router.post('/signers/rotate/confirm', authenticateApiKey, requireOperator, validateBody(signerConfirmSchema), async (req: Request, res: Response) => {
  const { vaultId, agentId, newSignerAddress, txHash } = req.body;
  if (!vaultId || !agentId || !isValidAddress(newSignerAddress)) {
    return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'vaultId, agentId, and a valid newSignerAddress are required' });
  }
  const vault = assertVaultInWorkspace(vaultId, (req as any).workspaceId, res);
  if (!vault) return;
  if (vault.agentId !== agentId) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Vault is not owned by this agent.' });
  }
  if (vault.mode !== 'live') {
    return res.status(400).json({ error: 'LIVE_VAULT_REQUIRED', message: 'Signer confirmation requires a live Arc vault.' });
  }

  const normalizedAddress = newSignerAddress.toLowerCase() as `0x${string}`;
  const pending = db.getManagedSignerByAddress(normalizedAddress, 'pending');
  if (!pending || pending.agentId !== agentId || pending.vaultId !== vault.id) {
    return res.status(404).json({ error: 'PENDING_SIGNER_NOT_FOUND', message: 'No pending signer exists for this agent and vault.' });
  }

  try {
    const rotationProof = await signerService.verifyAgentKeyRotationTransaction({
      txHash: txHash as `0x${string}`,
      vaultAddress: vault.address,
      newSignerAddress: normalizedAddress,
    });
    if (!rotationProof.valid) {
      return res.status(rotationProof.retryable ? 502 : 400).json({
        error: rotationProof.reasonCode,
        message: rotationProof.reasonDescription
      });
    }
    const authorization = await signerService.readVaultAuthorization(vault.address);
    if (authorization.agentKey.toLowerCase() !== normalizedAddress) {
      return res.status(409).json({
        error: 'OWNER_ROTATION_NOT_CONFIRMED',
        message: `Arc still reports agentKey ${authorization.agentKey}; submit rotateAgentKey from the vault owner wallet first.`
      });
    }
    const promoted = db.promoteManagedSigner(agentId, normalizedAddress);
    if (!promoted) {
      return res.status(409).json({ error: 'SIGNER_PROMOTION_FAILED', message: 'The pending signer could not be promoted.' });
    }
    db.updateVault(vault.id, {
      agentSignerAddress: normalizedAddress,
      agentKeyExpiresAt: Number(authorization.agentExpiry)
    });
    db.addChainEvent({
      id: `evt_rotate_${txHash.slice(2, 14).toLowerCase()}`,
      vaultAddress: vault.address,
      eventType: 'AgentKeyRotated',
      agentKey: normalizedAddress,
      txHash: txHash as `0x${string}`,
      blockNumber: rotationProof.blockNumber,
      timestamp: new Date().toISOString()
    });
    return res.json({
      vaultId: vault.id,
      agentId,
      activeSignerAddress: promoted.address,
      agentKeyExpiresAt: Number(authorization.agentExpiry),
      status: 'active'
    });
  } catch (err) {
    return res.status(502).json({
      error: 'OWNER_ROTATION_VERIFY_FAILED',
      message: safeErrorMessage(err, 'Unable to verify the vault authorization on Arc Testnet.')
    });
  }
});

v1Router.post('/signers/pause', authenticateApiKey, requireOperator, validateBody(signerPauseSchema), (req: Request, res: Response) => {
  const { vaultId, paused } = req.body;
  const workspaceId = (req as any).workspaceId as string;
  const vault = db.getVaultById(vaultId);

  if (!vault || vault.workspaceId !== workspaceId) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Vault not found' });
  }

  if (vault.mode === 'live') {
    return res.status(409).json({
      error: 'LIVE_VAULT_OWNER_ACTION_REQUIRED',
      message: 'Pause state for a live vault is enforced on Arc. Use the connected owner wallet, then refresh chain state.'
    });
  }

  const isPaused = paused;
  db.updateVault(vault.id, { paused: isPaused });

  return res.json({
    vaultId: vault.id,
    paused: isPaused,
    message: `Offline vault preflight ${isPaused ? 'paused' : 'resumed'} successfully`
  });
});

v1Router.post('/signers/revoke', authenticateApiKey, requireOperator, validateBody(signerRevokeSchema), (req: Request, res: Response) => {
  const { agentId, vaultId } = req.body;
  if (!agentId) {
    return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'agentId is required' });
  }
  const workspaceId = (req as any).workspaceId as string;
  if (!db.getAgents(workspaceId).find(a => a.id === agentId)) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Agent does not belong to this workspace.' });
  }
  const vault = assertVaultInWorkspace(vaultId, workspaceId, res);
  if (!vault) return;
  if (vault.agentId !== agentId) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Vault is not owned by this agent.' });
  }
  const ok = signerService.revokeSigner(agentId);
  if (vault.mode === 'offline') {
    db.updateVault(vaultId, { paused: true });
  }
  return res.json({
    revoked: ok,
    vaultPaused: vault.mode === 'offline' ? true : vault.paused,
    onChainAgentKeyStillAuthorized: vault.mode === 'live',
    ownerActionRequired: vault.mode === 'live',
    message: ok
      ? vault.mode === 'live'
        ? 'Managed signer access was revoked in Peribolos. The owner must also pause the vault or rotate its agent key on Arc.'
        : 'Managed signer revoked and offline policy execution paused.'
      : 'No active signer found'
  });
});
