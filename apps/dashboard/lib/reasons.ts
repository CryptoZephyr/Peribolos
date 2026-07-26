/**
 * Human-facing copy for on-chain block reasons. The reason CODE comes from the
 * contract via @peribolos/core; this maps it to a short label + plain-language
 * explanation for the blocked-attempts feed. Keep copy plain and functional.
 */
import { BlockReason } from "@peribolos/core";

export const REASON_LABEL: Record<BlockReason, string> = {
  [BlockReason.NONE]: "Allowed",
  [BlockReason.RECIPIENT_NOT_ALLOWLISTED]: "Recipient not allowlisted",
  [BlockReason.EXCEEDS_PER_TX_CAP]: "Over per-transaction cap",
  [BlockReason.EXCEEDS_DAILY_CAP]: "Over daily cap",
  [BlockReason.ACTION_NOT_ALLOWED]: "Action type not allowed",
  [BlockReason.AGENT_KEY_EXPIRED]: "Agent key expired",
  [BlockReason.VAULT_PAUSED]: "Vault paused",
  [BlockReason.INSUFFICIENT_BALANCE]: "Insufficient balance",
  [BlockReason.TRANSFER_FAILED]: "Transfer failed on-chain",
};

export const REASON_EXPLANATION: Record<BlockReason, string> = {
  [BlockReason.NONE]: "The payment passed every rule.",
  [BlockReason.RECIPIENT_NOT_ALLOWLISTED]:
    "The recipient address is not on this vault's allowlist. This is how an injected payment to an attacker is stopped.",
  [BlockReason.EXCEEDS_PER_TX_CAP]:
    "The amount is larger than the per-transaction limit set for this vault.",
  [BlockReason.EXCEEDS_DAILY_CAP]:
    "This payment would push spending past the daily limit for the current UTC day.",
  [BlockReason.ACTION_NOT_ALLOWED]:
    "The action type is not permitted by this vault's rules.",
  [BlockReason.AGENT_KEY_EXPIRED]:
    "The agent key has passed its expiry. The vault fails closed.",
  [BlockReason.VAULT_PAUSED]: "The owner paused this vault. No payments execute while paused.",
  [BlockReason.INSUFFICIENT_BALANCE]: "The vault does not hold enough USDC for this payment.",
  [BlockReason.TRANSFER_FAILED]: "The USDC transfer reverted on-chain and was recorded, not thrown.",
};
