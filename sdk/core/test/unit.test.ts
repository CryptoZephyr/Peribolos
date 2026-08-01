/**
 * Unit tests for @peribolos/core pure surfaces.
 * No RPC — protects BlockReason ordinals (must match Solidity) and usdc().
 *
 * Run: npm test -w @peribolos/core
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BlockReason, BlockReasonCode, ActionType } from "../src/types.js";
import { usdc } from "../src/client.js";
import { ARC_TESTNET, USDC_ADDRESS, USDC_ERC20_DECIMALS, PERIBOLOS_FACTORY_ADDRESS } from "../src/constants.js";

describe("BlockReason ordinals (must match PeribolosVault.sol)", () => {
  it("matches on-chain enum ordering", () => {
    assert.equal(BlockReason.NONE, 0);
    assert.equal(BlockReason.RECIPIENT_NOT_ALLOWLISTED, 1);
    assert.equal(BlockReason.EXCEEDS_PER_TX_CAP, 2);
    assert.equal(BlockReason.EXCEEDS_DAILY_CAP, 3);
    assert.equal(BlockReason.ACTION_NOT_ALLOWED, 4);
    assert.equal(BlockReason.AGENT_KEY_EXPIRED, 5);
    assert.equal(BlockReason.VAULT_PAUSED, 6);
    assert.equal(BlockReason.INSUFFICIENT_BALANCE, 7);
    assert.equal(BlockReason.TRANSFER_FAILED, 8);
  });

  it("BlockReasonCode maps every reason to a stable machine string", () => {
    const expected: Record<number, string> = {
      0: "NONE",
      1: "RECIPIENT_NOT_ALLOWLISTED",
      2: "EXCEEDS_PER_TX_CAP",
      3: "EXCEEDS_DAILY_CAP",
      4: "ACTION_NOT_ALLOWED",
      5: "AGENT_KEY_EXPIRED",
      6: "VAULT_PAUSED",
      7: "INSUFFICIENT_BALANCE",
      8: "TRANSFER_FAILED",
    };
    for (const [n, code] of Object.entries(expected)) {
      const reason = Number(n) as BlockReason;
      assert.equal(BlockReasonCode[reason], code);
    }
    // No silent drift: every enum member has a code entry
    for (const key of Object.keys(BlockReason).filter((k) => Number.isNaN(Number(k)))) {
      const val = BlockReason[key as keyof typeof BlockReason] as BlockReason;
      assert.ok(BlockReasonCode[val], `missing BlockReasonCode for ${key}`);
    }
  });
});

describe("ActionType bitmap positions", () => {
  it("matches vault allowedActions bit positions", () => {
    assert.equal(ActionType.SERVICE_PAYMENT, 0);
    assert.equal(ActionType.AGENT_TO_AGENT, 1);
    assert.equal(ActionType.HUMAN_PAYOUT, 2);
    assert.equal(ActionType.SWAP, 3);
  });
});

describe("usdc()", () => {
  it("converts human USDC strings to 6-decimal base units", () => {
    assert.equal(usdc("0"), 0n);
    assert.equal(usdc("1"), 1_000_000n);
    assert.equal(usdc("1.5"), 1_500_000n);
    assert.equal(usdc("1.50"), 1_500_000n);
    assert.equal(usdc("0.000001"), 1n);
    assert.equal(usdc("1000"), 1_000_000_000n);
  });
});

describe("Arc testnet constants (docs-aligned)", () => {
  it("uses Arc testnet chain id 5042002 and public endpoints", () => {
    assert.equal(ARC_TESTNET.id, 5042002);
    assert.equal(ARC_TESTNET.rpcUrl, "https://rpc.testnet.arc.network");
    assert.equal(ARC_TESTNET.wsUrl, "wss://rpc.testnet.arc.network");
    assert.equal(ARC_TESTNET.explorer, "https://testnet.arcscan.app");
    assert.equal(USDC_ERC20_DECIMALS, 6);
    assert.equal(USDC_ADDRESS.toLowerCase(), "0x3600000000000000000000000000000000000000");
    assert.equal(
      PERIBOLOS_FACTORY_ADDRESS.toLowerCase(),
      "0x84b6a05b1d71d5947adf1438c6ffe8eb66ada31e",
    );
  });
});
