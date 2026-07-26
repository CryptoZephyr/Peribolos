/**
 * Public type contract for @peribolos/core. Both the SDK implementation and
 * downstream consumers (demo agent, langchain tool) code against these.
 */

import type { Address, Hex } from "viem";

/**
 * Action-type bitmap positions. A vault's `allowedActions` is a bitmask;
 * action type `i` is permitted iff bit `i` is set. Kept small and explicit.
 */
export enum ActionType {
  SERVICE_PAYMENT = 0,
  AGENT_TO_AGENT = 1,
  HUMAN_PAYOUT = 2,
  SWAP = 3,
}

/**
 * Reason a `pay()` call was blocked. MUST match the on-chain
 * PeribolosVault.BlockReason enum ordering exactly — the SDK maps the emitted
 * uint8 to this enum.
 */
export enum BlockReason {
  NONE = 0,
  RECIPIENT_NOT_ALLOWLISTED = 1,
  EXCEEDS_PER_TX_CAP = 2,
  EXCEEDS_DAILY_CAP = 3,
  ACTION_NOT_ALLOWED = 4,
  AGENT_KEY_EXPIRED = 5,
  VAULT_PAUSED = 6,
  INSUFFICIENT_BALANCE = 7,
  TRANSFER_FAILED = 8,
}

/** Human-readable, machine-stable string codes surfaced to agents. */
export const BlockReasonCode: Record<BlockReason, string> = {
  [BlockReason.NONE]: "NONE",
  [BlockReason.RECIPIENT_NOT_ALLOWLISTED]: "RECIPIENT_NOT_ALLOWLISTED",
  [BlockReason.EXCEEDS_PER_TX_CAP]: "EXCEEDS_PER_TX_CAP",
  [BlockReason.EXCEEDS_DAILY_CAP]: "EXCEEDS_DAILY_CAP",
  [BlockReason.ACTION_NOT_ALLOWED]: "ACTION_NOT_ALLOWED",
  [BlockReason.AGENT_KEY_EXPIRED]: "AGENT_KEY_EXPIRED",
  [BlockReason.VAULT_PAUSED]: "VAULT_PAUSED",
  [BlockReason.INSUFFICIENT_BALANCE]: "INSUFFICIENT_BALANCE",
  [BlockReason.TRANSFER_FAILED]: "TRANSFER_FAILED",
};

/**
 * Result of a vault-tier payment attempt. `executed` distinguishes a completed
 * payment from a structurally blocked one. A blocked attempt is NOT an error —
 * it is the product working; `txHash` is still populated because the block is
 * recorded on-chain.
 */
export interface PayResult {
  executed: boolean;
  txHash: Hex;
  /** Present iff executed === false. */
  reason?: BlockReason;
  reasonCode?: string;
  to: Address;
  /** 6-decimal USDC base units. */
  amount: bigint;
  actionType: ActionType;
}

/** Result of a petty-cash (x402 Nanopayment) purchase. */
export interface PettyCashResult {
  status: number;
  data: unknown;
  /** Remaining Gateway available balance, 6-decimal base units. */
  remainingBalance?: bigint;
}

export interface VaultRules {
  perTxCap: bigint;
  dailyCap: bigint;
  floatAmount: bigint;
  allowedActions: bigint;
}

export interface VaultState {
  address: Address;
  owner: Address;
  treasury: Address;
  agentKey: Address;
  agentExpiry: bigint;
  paused: boolean;
  identityRegistered: boolean;
  rules: VaultRules;
  /** Live 6-decimal USDC balance held by the vault. */
  balance: bigint;
  epochSpent: bigint;
  /** Protocol fee bps on successful pays (0 = off; testnet default). */
  feeBps: number;
  /** Recipient of protocol fees when feeBps > 0. */
  feeRecipient: Address;
}

export interface CreateDomainParams {
  treasury: Address;
  agentKey: Address;
  /** Unix seconds; must be in the future. */
  agentExpiry: bigint;
  perTxCap: bigint;
  dailyCap: bigint;
  floatAmount: bigint;
  allowedActions: bigint;
  allowlist: Address[];
  agentMetadataURI: string;
  /** Native wei (18-dec) forwarded to the agent EOA for gas. */
  agentGasWei: bigint;
  /** Total native value (18-dec) to send; remainder funds the vault. */
  valueWei: bigint;
}

/** A parsed PaymentBlocked / PaymentExecuted event for the activity feed. */
export interface ActivityEvent {
  kind: "executed" | "blocked";
  to: Address;
  amount: bigint;
  actionType: ActionType;
  reason?: BlockReason;
  reasonCode?: string;
  txHash: Hex;
  blockNumber: bigint;
}
