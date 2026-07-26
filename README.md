# Peribolos V2

**No-Terminal Spending Control Platform for Autonomous AI Agents on [Arc](https://docs.arc.network)** (Circle's L1, USDC-native gas).

Give AI agents real spending power without giving them an unrestricted wallet. Enforces budgets, payees, action bitmasks, and prompt injection defense on-chain via smart contracts while providing a managed, no-terminal startup platform.

---

## 🌟 What's New in Peribolos V2 Startup MVP

- 🚀 **No-Terminal Onboarding**: Users create protected agent spending vaults, define approved payees, set budgets, and generate API keys directly in the web dashboard.
- 🔑 **Managed Signer Service**: Agent private keys are provisioned server-side and encrypted with AES-256-GCM. Frontend code and static builds never touch private keys.
- ⚡ **Hosted Payment API (`POST /v1/payments`)**: Agents send payments via simple API Key authorization (`Bearer pb_live_...`) with automatic idempotency and preflight policy checks.
- 📊 **Dashboard V2**: Comprehensive control room for Overview, Agents, Vaults, Approved Payees, Policies, Real-time Activity, Prompt-Injection Security Testing, API Keys, Pricing Tiers, and Audit Export.
- 🛡️ **Prompt-Injection Security Audit**: Safe in-app simulation testing adversarial prompt attacks against contract enforcement with verifiable Arcscan proof links.
- 📥 **Audit Export**: One-click CSV and JSON export of normalized execution and blocked payment history.
- 🔌 **Developer Integrations**: Built-in support for LangChain, OpenAI Agents SDK, CrewAI, and Raw REST fetch.

---

## 🏛️ Architecture & Network Details

| Field | Value |
|---|---|
| **Chain** | Arc Testnet · Chain ID `5042002` (`0x4CEF52`) |
| **RPC** | `https://rpc.testnet.arc.network` |
| **Explorer** | [testnet.arcscan.app](https://testnet.arcscan.app) |
| **USDC Contract** | `0x3600000000000000000000000000000000000000` (6-decimal ERC-20; native gas asset on Arc) |
| **Backend API** | `http://localhost:3400` |
| **Dashboard UI** | `http://localhost:3000` |

---

## 🚀 Quick Start

### 1. Install & Run Stack

```bash
# Node >= 20
npm install
npm run build

# Start Backend API & Event Indexer
npm run dev -w @peribolos/api

# Start Dashboard V2
npm run dev -w @peribolos/dashboard
```

Open `http://localhost:3000/app` to access Dashboard V2.

### 2. Five-Step No-Terminal Workflow

1. **Create Agent**: Navigate to **Agents** → Click **+ Provision New Agent**. Peribolos provisions a protected vault, managed signer, and agent API key (`pb_live_...`).
2. **Add Approved Payees**: Navigate to **Payees** → Add vendor names and on-chain addresses.
3. **Set Budget Policies**: Adjust per-tx caps, daily budget limits, and allowed action bitmasks in **Vaults**.
4. **Agent Payment**: Agent invokes `POST /v1/payments` using bearer token API key.
5. **Run Security Audit**: Navigate to **Simulations** → Select a prompt injection attack fixture and execute live verification.

---

## ⚡ Hosted Payment API Reference

```bash
curl -X POST http://localhost:3400/v1/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer pb_live_demo1234567890abcdef1234567890abcdef" \
  -d '{
    "payeeAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "amountUsdc": 2.50,
    "actionType": 1,
    "idempotencyKey": "idemp_req_001"
  }'
```

### Successful Response (`200 OK`)
```json
{
  "id": "pr_abc123",
  "idempotencyKey": "idemp_req_001",
  "status": "EXECUTED",
  "amountUsdc": 2.50,
  "payeeAddress": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
  "payeeName": "Demo x402 Seller API",
  "txHash": "0x...",
  "explorerUrl": "https://testnet.arcscan.app/tx/0x..."
}
```

### Contract Rule Blocked Response (`403 Forbidden`)
```json
{
  "id": "pr_xyz789",
  "status": "BLOCKED",
  "blockReasonCode": "RECIPIENT_NOT_ALLOWLISTED",
  "blockReasonDescription": "Address 0x1111... is not registered in the payee allowlist.",
  "explorerUrl": "https://testnet.arcscan.app/address/0x..."
}
```

---

## 💻 SDK & Developer Integration Examples

### 1. Hosted API SDK (`@peribolos/core`)

```ts
import { PeribolosHostedClient } from "@peribolos/core";

const client = new PeribolosHostedClient({
  apiKey: process.env.PERIBOLOS_API_KEY!,
  baseUrl: "http://localhost:3400"
});

const result = await client.pay({
  payeeAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  amountUsdc: 2.50,
  actionType: 1
});
```

### 2. LangChain Integration
See [apps/demo-agent/src/examples/langchain_hosted.ts](apps/demo-agent/src/examples/langchain_hosted.ts).

### 3. OpenAI Agents SDK
See [apps/demo-agent/src/examples/openai_agents_sdk.ts](apps/demo-agent/src/examples/openai_agents_sdk.ts).

### 4. CrewAI (Python)
See [apps/demo-agent/src/examples/crewai.py](apps/demo-agent/src/examples/crewai.py).

---

## 🧪 Testing

```bash
# Run Foundry smart contract tests (76 passed)
cd contracts && forge test

# Run Core SDK unit tests
npm test -w @peribolos/core

# Run Backend API integration tests
npm test -w @peribolos/api

# Workspace typecheck
npm run typecheck
```

---

## 🛡️ Security Principles

1. **Smart Contracts are the Wall**: LLM guardrails can be bypassed by prompt injection; on-chain contracts cannot.
2. **Managed Signer Isolation**: Agent private keys are AES-256-GCM encrypted server-side and never exposed to frontends.
3. **Owner Authority**: Workspace owners retain full key rotation, revocation, and withdrawal control on-chain.
