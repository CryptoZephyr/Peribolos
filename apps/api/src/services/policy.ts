import { db, VaultRecord } from '../db/store.js';

export interface PolicyCheckResult {
  allowed: boolean;
  blockReasonCode?: string;
  blockReasonDescription?: string;
  reasonOrdinal?: number;
}

export function preflightPolicyCheck(params: {
  vault: VaultRecord;
  payeeAddress: `0x${string}`;
  amountUsdc: number;
  actionType: number;
}): PolicyCheckResult {
  const { vault, payeeAddress, amountUsdc, actionType } = params;

  // 1. Vault Paused Check
  if (vault.paused) {
    return {
      allowed: false,
      reasonOrdinal: 6,
      blockReasonCode: 'VAULT_PAUSED',
      blockReasonDescription: 'The vault is currently paused by the owner. No payments can be processed.'
    };
  }

  // 2. Agent Key Expiration Check
  const nowSec = Math.floor(Date.now() / 1000);
  if (vault.agentKeyExpiresAt > 0 && nowSec > vault.agentKeyExpiresAt) {
    return {
      allowed: false,
      reasonOrdinal: 5,
      blockReasonCode: 'AGENT_KEY_EXPIRED',
      blockReasonDescription: `Agent key expired at ${new Date(vault.agentKeyExpiresAt * 1000).toISOString()}. Rotated key required.`
    };
  }

  // 3. Recipient / Payee Allowlist Check
  const payee = db.getPayeeByAddress(payeeAddress, vault.workspaceId);
  // Check payee registry or allowlist
  if (!payee) {
    return {
      allowed: false,
      reasonOrdinal: 1,
      blockReasonCode: 'RECIPIENT_NOT_ALLOWLISTED',
      blockReasonDescription: `Address ${payeeAddress} is not registered or approved in the payee allowlist.`
    };
  }

  // 4. Action Type Bitmap Check
  // Allowed actions bitmap bit check: (allowedActionsBitmap & (1 << actionType)) != 0
  const actionBit = 1 << actionType;
  if ((vault.allowedActionsBitmap & actionBit) === 0) {
    return {
      allowed: false,
      reasonOrdinal: 4,
      blockReasonCode: 'ACTION_NOT_ALLOWED',
      blockReasonDescription: `Action type ${actionType} is not permitted by vault policy (allowed bitmap: ${vault.allowedActionsBitmap}).`
    };
  }

  // 5. Per-Transaction Cap Check
  if (amountUsdc > vault.perTxCapUsdc) {
    return {
      allowed: false,
      reasonOrdinal: 2,
      blockReasonCode: 'EXCEEDS_PER_TX_CAP',
      blockReasonDescription: `Requested amount $${amountUsdc.toFixed(2)} USDC exceeds per-transaction cap of $${vault.perTxCapUsdc.toFixed(2)} USDC.`
    };
  }

  // 6. Daily Cap Check
  // Compute spent amount in the same fixed UTC-day epoch as PeribolosVault.
  const epochStartMs = Math.floor(nowSec / 86_400) * 86_400 * 1000;
  const epochStart = new Date(epochStartMs).toISOString();
  const recentPayments = db.getPaymentRequests(vault.workspaceId).filter(
    pr => pr.vaultId === vault.id && pr.status === 'EXECUTED' && pr.createdAt >= epochStart
  );
  const spentToday = recentPayments.reduce((acc, pr) => acc + pr.amountUsdc, 0);

  if (spentToday + amountUsdc > vault.dailyCapUsdc) {
    const remaining = Math.max(0, vault.dailyCapUsdc - spentToday);
    return {
      allowed: false,
      reasonOrdinal: 3,
      blockReasonCode: 'EXCEEDS_DAILY_CAP',
      blockReasonDescription: `Requested amount $${amountUsdc.toFixed(2)} USDC exceeds remaining daily limit ($${remaining.toFixed(2)} USDC left of $${vault.dailyCapUsdc.toFixed(2)} USDC cap).`
    };
  }

  return { allowed: true };
}
