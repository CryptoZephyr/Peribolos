# Peribolos SDK

Rule-enforced USDC spending for AI agents on Arc. Two packages:

- **`@peribolos/core`** — TypeScript client for a Peribolos vault (viem-based).
- **`@peribolos/langchain`** — LangChain tools wrapping core, for agents.

Both talk to the live factory on Arc testnet:
`0x84B6a05B1d71D5947Adf1438c6FFe8Eb66AdA31E` (chain `5042002`, v3.2).

## The two trust tiers

| Tier | Method | Enforcement |
|------|--------|-------------|
| **Vault** | `pay(to, amount, actionType)` | On-chain rules: allowlist, per-tx cap, daily cap, action type, expiry, pause. A blocked payment is a *successful* tx that moves no funds and emits `PaymentBlocked(reason)`. |
| **Petty cash** | `buy(url)` | Gasless x402 Nanopayment via Circle Gateway. Bounded on-chain by the Gateway deposit, **not** by vault rules — keep it small. |

## LangChain integration (the 10 lines)

```ts
import { createPeribolosTools } from "@peribolos/langchain";
import { ChatOpenAI } from "@langchain/openai";

const tools = createPeribolosTools({
  vaultAddress: "0x...",                       // your domain's vault
  agentPrivateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}`,
});

// Free models via OpenRouter (or any OpenAI-compatible endpoint)
const model = new ChatOpenAI({
  model: process.env.MODEL ?? "meta-llama/llama-3.3-70b-instruct:free",
  apiKey: process.env.OPENROUTER_API_KEY,
  configuration: { baseURL: "https://openrouter.ai/api/v1" },
}).bindTools(tools);
// tools: peribolos_pay, peribolos_buy, peribolos_status
```

A blocked payment returns to the model as a normal tool result with a
machine-readable `reason` (e.g. `RECIPIENT_NOT_ALLOWLISTED`) and an instruction
not to retry — the agent fails gracefully instead of crashing.

## Core client (framework-agnostic)

```ts
import { PeribolosVaultClient, usdc, ActionType } from "@peribolos/core";

const vault = new PeribolosVaultClient({
  vaultAddress: "0x...",
  agentPrivateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}`,
});

const r = await vault.pay("0xRecipientOnAllowlist", usdc("1.50"), ActionType.SERVICE_PAYMENT);
if (!r.executed) console.log("blocked:", r.reasonCode); // never throws on a rule block

await vault.buy("https://api.example.com/paid-endpoint"); // petty-cash x402
const state = await vault.getState();                     // balances, rules, spent-today
const feed  = await vault.getActivity();                  // executed + blocked events
```

Owner-side domain creation lives in `PeribolosFactoryClient` (separate, higher-trust key).

## Block reason codes

`RECIPIENT_NOT_ALLOWLISTED` · `EXCEEDS_PER_TX_CAP` · `EXCEEDS_DAILY_CAP` ·
`ACTION_NOT_ALLOWED` · `AGENT_KEY_EXPIRED` · `VAULT_PAUSED` ·
`INSUFFICIENT_BALANCE` · `TRANSFER_FAILED`

Contract check order (first failing rule wins): paused → expiry → action →
allowlist → per-tx cap → daily cap → balance.

## Build

```bash
npm install                    # from repo root (workspaces)
cd sdk/core && npx tsup        # build core first (others depend on its dist)
cd ../langchain && npx tsup
```

## Demo

See [`apps/demo-agent`](../apps/demo-agent) — a scripted (deterministic,
rehearsal-safe) run and a real-LLM run, both proving the injection block live.
[`apps/demo-seller`](../apps/demo-seller) is the x402 counterparty.
