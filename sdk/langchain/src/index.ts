/**
 * @peribolos/langchain — LangChain tools that give an agent a rule-enforced
 * Peribolos vault on Arc.
 *
 * The 10-line integration:
 *
 *   import { createPeribolosTools } from "@peribolos/langchain";
 *   const tools = createPeribolosTools({
 *     vaultAddress: "0x...",
 *     agentPrivateKey: process.env.AGENT_PRIVATE_KEY,
 *   });
 *   const model = new ChatAnthropic({ model: "claude-sonnet-5" }).bindTools(tools);
 *
 * Design note: a BLOCKED payment is returned to the model as a normal tool
 * result (not an exception) with the on-chain reason code — the agent should
 * see "the wall said no, and here's why" and continue gracefully.
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  ActionType,
  PeribolosVaultClient,
  usdc,
  type PeribolosVaultClientConfig,
} from "@peribolos/core";
import type { Address } from "viem";

export interface PeribolosToolsConfig extends PeribolosVaultClientConfig {}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

type PeribolosPayInput = {
  to: string;
  amountUsdc: number;
  actionType?: number;
};

type PeribolosBuyInput = {
  url: string;
};

/** Format 6-dec base units as a human USDC string. */
function fmt(amount: bigint): string {
  const whole = amount / 1_000_000n;
  const frac = (amount % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

/** Convert a numeric USDC amount to base units without float drift. */
function amountToBase(amountUsdc: number): bigint {
  // String path via usdc() — avoids Math.round(amount * 1e6) float bugs.
  const fixed = amountUsdc.toFixed(6);
  return usdc(fixed);
}

export function createPeribolosTools(config: PeribolosToolsConfig) {
  const client = new PeribolosVaultClient(config);

  const peribolosPay = tool(
    async ({ to, amountUsdc, actionType }: PeribolosPayInput) => {
      if (!ADDRESS_RE.test(to)) {
        return JSON.stringify({ ok: false, error: "INVALID_ADDRESS", to });
      }
      const amount = amountToBase(amountUsdc);
      const result = await client.pay(
        to as Address,
        amount,
        (actionType ?? ActionType.SERVICE_PAYMENT) as ActionType,
      );
      if (result.executed) {
        return JSON.stringify({
          ok: true,
          executed: true,
          amountUsdc: fmt(result.amount),
          to: result.to,
          txHash: result.txHash,
        });
      }
      return JSON.stringify({
        ok: true,
        executed: false,
        blocked: true,
        reason: result.reasonCode,
        explanation:
          `The Peribolos vault blocked this payment (${result.reasonCode}). ` +
          "This is a hard on-chain rule, not a temporary error — do NOT retry the same payment. " +
          "The blocked attempt was recorded on-chain.",
        txHash: result.txHash,
      });
    },
    {
      name: "peribolos_pay",
      description:
        "Pay USDC from the agent's rule-enforced Peribolos vault on Arc to a recipient address. " +
        "The vault enforces a recipient allowlist, per-transaction cap, and daily cap ON-CHAIN; " +
        "payments violating any rule are blocked and recorded. Use for paying services, other " +
        "agents, or people. Amounts are in USDC (e.g. 1.5).",
      schema: z.object({
        to: z.string().describe("Recipient EVM address (0x...)"),
        amountUsdc: z
          .number()
          .positive()
          .describe("Amount in USDC, e.g. 0.5 for fifty cents"),
        actionType: z
          .number()
          .int()
          .min(0)
          .max(3)
          .optional()
          .describe(
            "0=SERVICE_PAYMENT (default), 1=AGENT_TO_AGENT, 2=HUMAN_PAYOUT, 3=SWAP",
          ),
      }),
    },
  );

  const peribolosBuy = tool(
    async ({ url }: PeribolosBuyInput) => {
      try {
        const result = await client.buy(url);
        return JSON.stringify({
          ok: result.status >= 200 && result.status < 300,
          status: result.status,
          data: result.data,
          remainingPettyCashUsdc:
            result.remainingBalance !== undefined ? fmt(result.remainingBalance) : undefined,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const code = err instanceof Error && err.name === "INSUFFICIENT_GATEWAY_BALANCE"
          ? "INSUFFICIENT_GATEWAY_BALANCE"
          : message.includes("INSUFFICIENT_GATEWAY_BALANCE")
            ? "INSUFFICIENT_GATEWAY_BALANCE"
            : "PETTY_CASH_ERROR";
        return JSON.stringify({
          ok: false,
          error: code,
          explanation:
            code === "INSUFFICIENT_GATEWAY_BALANCE"
              ? "Petty-cash Gateway deposit is exhausted. Refill via depositPettyCash / dashboard refill — do not retry the same buy."
              : message,
        });
      }
    },
    {
      name: "peribolos_buy",
      description:
        "Buy an x402-protected web resource (a paid API) using the vault's petty-cash pocket — " +
        "a gasless USDC Nanopayment via Circle Gateway. Use when an HTTP API responds with " +
        "402 Payment Required or is known to be a paid endpoint. Spending is hard-capped by the " +
        "small petty-cash deposit. NOT gated by vault allowlist/caps.",
      schema: z.object({
        url: z.string().url().describe("Full URL of the paid resource"),
      }),
    },
  );

  const peribolosStatus = tool(
    async () => {
      const state = await client.getState();
      let pettyCashUsdc: string | undefined;
      try {
        const pc = await client.getPettyCashBalance();
        pettyCashUsdc = fmt(pc);
      } catch {
        // Petty cash may be disabled.
      }
      return JSON.stringify({
        vault: state.address,
        balanceUsdc: fmt(state.balance),
        paused: state.paused,
        rules: {
          perTxCapUsdc: fmt(state.rules.perTxCap),
          dailyCapUsdc: fmt(state.rules.dailyCap),
          spentTodayUsdc: fmt(state.epochSpent),
        },
        feeBps: state.feeBps,
        pettyCashUsdc,
        agentExpiry: new Date(Number(state.agentExpiry) * 1000).toISOString(),
      });
    },
    {
      name: "peribolos_status",
      description:
        "Check the agent's Peribolos vault: balance, spending rules (per-tx cap, daily cap, " +
        "spent today), and pause state. Call before large payments to preflight limits.",
      schema: z.object({}),
    },
  );

  return [peribolosPay, peribolosBuy, peribolosStatus];
}

export { ActionType } from "@peribolos/core";
