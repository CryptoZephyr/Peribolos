# Peribolos V2 🛡️🤖

> **Non-Custodial, Rule-Enforced USDC Spending Vaults & Managed Payment API for Autonomous AI Agents on [Arc](https://docs.arc.network)**

[![Arc Network](https://img.shields.io/badge/Network-Arc%20Testnet%20(5042002)-6366f1?style=for-the-badge&logo=ethereum)](https://testnet.arcscan.app)
[![API Status](https://img.shields.io/badge/API-Live%20on%20Render-emerald?style=for-the-badge&logo=render)](https://peribolos-api.onrender.com/health)
[![USDC Native](https://img.shields.io/badge/Gas-USDC%20Native-2775CA?style=for-the-badge&logo=usdc)](https://testnet.arcscan.app/address/0x3600000000000000000000000000000000000000)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

Peribolos gives AI agents real financial autonomy without handing them an unrestricted wallet. It enforces strict spending caps, approved payee allowlists, action bitmasks, and prompt injection defense **on-chain via smart contracts** while providing a managed, no-terminal control room and hosted payment API.

---

## ⚡ Quick Links

- 🌐 **Live Backend API**: [`https://peribolos-api.onrender.com`](https://peribolos-api.onrender.com/health)
- 📊 **Dashboard V2**: Local Web Control Room (`http://localhost:3000`)
- 📖 **Architecture Document**: [architecture.md](architecture.md)
- 📝 **Product Spec**: [Peribolos_Product_Spec-3.md](Peribolos_Product_Spec-3.md)

---

## 🌟 Key Features

| Feature | Description |
|---|---|
| 🖥️ **No-Terminal Dashboard** | Provision agent vaults, define vendor allowlists, set daily budgets, and generate API keys from an intuitive web UI. |
| 🔑 **Managed Signer Service** | Server-side AES-256-GCM key isolation. Frontends and agent LLMs never touch raw private keys. |
| ⚡ **Hosted Payment API** | Simple `POST /v1/payments` endpoint with Bearer token authentication (`pb_live_...`), idempotency, and preflight policy checks. |
| 🛡️ **On-Chain Enforcement** | Spending policies (per-tx caps, daily velocity caps, allowlisted payees) enforced directly by Arc smart contracts. |
| 🧪 **Prompt-Injection Security Audit** | In-dashboard adversarial attack simulator testing prompt injection bypasses against smart contract walls. |
| 🔌 **Multi-Framework SDKs** | Native packages for TypeScript (`@peribolos/core`), LangChain (`@peribolos/langchain`), OpenAI Agents SDK, and Python / CrewAI. |
| 📊 **Audit & Export** | Real-time event indexer with one-click CSV & JSON audit history exports. |

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Agent Environment
        A[AI Agent / LLM] -->|1. Request Payment via Bearer API Key| B[Peribolos Hosted API]
    end

    subgraph Managed Infrastructure
        B -->|2. Preflight Policy Check| C[AES-256-GCM Managed Signer]
        C -->|3. Sign & Submit Transaction| D[Arc L1 Blockchain]
    end

    subgraph Arc Blockchain - Chain ID 5042002
        D -->|4. Enforce Rules| E[Peribolos Vault Smart Contract]
        E -->|5. Transfer Native USDC| F[Approved Payee / Vendor]
    end
```

### Network & Infrastructure Specifications

| Parameter | Specification |
|---|---|
| **Blockchain** | Arc Testnet (`Chain ID: 5042002 / 0x4CEF52`) |
| **RPC Endpoint** | `https://rpc.testnet.arc.network` |
| **Block Explorer** | [testnet.arcscan.app](https://testnet.arcscan.app) |
| **Native USDC Asset** | `0x3600000000000000000000000000000000000000` (6 decimals, native gas asset on Arc) |
| **Live Hosted API** | `https://peribolos-api.onrender.com` |

---

## 🚀 Getting Started

### 1. Run the Full Stack Locally

```bash
# Requires Node.js >= 20
git clone https://github.com/CryptoZephyr/Peribolos.git
cd Peribolos

# Install dependencies & build core SDKs
npm install
npm run build:sdk

# Start Backend API & Event Indexer (Port 3400)
npm run dev -w @peribolos/api

# In a second terminal: Start Dashboard V2 (Port 3000)
npm run dev -w @peribolos/dashboard
```

Open `http://localhost:3000` in your browser to launch Dashboard V2.

### 2. Five-Step No-Terminal Workflow

1. **Provision Agent**: Go to **Agents** → Click **+ Provision New Agent**. Peribolos creates an on-chain vault, managed signer, and API key (`pb_live_...`).
2. **Configure Payees**: Go to **Payees** → Add trusted vendor names and on-chain EVM recipient addresses.
3. **Set Spending Limits**: Set per-transaction caps and daily spending budgets under **Vaults**.
4. **Agent Executes Payment**: Pass the API key to your agent to call `POST /v1/payments`.
5. **Security Simulation**: Go to **Simulations** → Run live adversarial prompt injection attacks to verify on-chain protection.

---

## ⚡ Hosted Payment API Reference

### `POST /v1/payments`

Send a payment request via the managed API key.

#### Request Example (cURL)
```bash
curl -X POST https://peribolos-api.onrender.com/v1/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer pb_live_demo1234567890abcdef1234567890abcdef" \
  -d '{
    "payeeAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "amountUsdc": 2.50,
    "actionType": 1,
    "idempotencyKey": "idemp_req_001"
  }'
```

#### Successful Execution (`200 OK`)
```json
{
  "id": "pr_abc123",
  "idempotencyKey": "idemp_req_001",
  "status": "EXECUTED",
  "amountUsdc": 2.50,
  "payeeAddress": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
  "payeeName": "Demo x402 Seller API",
  "txHash": "0x8f2a...",
  "explorerUrl": "https://testnet.arcscan.app/tx/0x8f2a..."
}
```

#### Contract Policy Violation (`403 Forbidden`)
```json
{
  "id": "pr_xyz789",
  "status": "BLOCKED",
  "blockReasonCode": "RECIPIENT_NOT_ALLOWLISTED",
  "blockReasonDescription": "Address 0x1111... is not registered in the payee allowlist.",
  "explorerUrl": "https://testnet.arcscan.app/address/0x1111..."
}
```

---

## 💻 Developer Integrations & SDKs

### 1. Core TypeScript SDK (`@peribolos/core`)

```typescript
import { PeribolosHostedClient } from "@peribolos/core";

const client = new PeribolosHostedClient({
  apiKey: process.env.PERIBOLOS_API_KEY!,
  baseUrl: "https://peribolos-api.onrender.com"
});

const result = await client.pay({
  payeeAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  amountUsdc: 2.50,
  actionType: 1
});

console.log(`Payment status: ${result.status}, TX: ${result.txHash}`);
```

### 2. LangChain Agent Integration (`@peribolos/langchain`)

```typescript
import { PeribolosPayTool } from "@peribolos/langchain";
import { initializeAgentExecutorWithOptions } from "langchain/agents";

const payTool = new PeribolosPayTool({
  apiKey: process.env.PERIBOLOS_API_KEY!,
  baseUrl: "https://peribolos-api.onrender.com"
});

// Pass payTool directly into your LangChain Agent toolkit
```

### 3. Additional Framework Examples

- **OpenAI Agents SDK**: [apps/demo-agent/src/examples/openai_agents_sdk.ts](apps/demo-agent/src/examples/openai_agents_sdk.ts)
- **CrewAI (Python)**: [apps/demo-agent/src/examples/crewai.py](apps/demo-agent/src/examples/crewai.py)
- **Raw Fetch**: [apps/demo-agent/src/examples/raw_fetch.ts](apps/demo-agent/src/examples/raw_fetch.ts)

---

## 🛡️ Security Architecture

| Vector | Soft LLM Guardrails | Peribolos Smart Contract Vaults |
|---|---|---|
| **Prompt Injection** | ❌ Vulnerable to jailbreaks & system prompt overrides | ✅ **Immune** — Smart contract logic runs independently on Arc L1 |
| **Wallet Exposure** | ❌ Private key embedded in agent memory/env | ✅ **Immune** — AES-256-GCM Managed Signer handles signing server-side |
| **Overspending** | ❌ LLM can hallucinate amount parameters | ✅ **Enforced** — Hard limit per-tx cap & daily velocity checks in contract |
| **Unauthorized Recipients** | ❌ LLM can be deceived into sending to attacker address | ✅ **Enforced** — Contract rejects any recipient address not in on-chain allowlist |

---

## 🧪 Testing Suite

```bash
# 1. Run Foundry Smart Contract Tests (76 passed)
cd contracts && forge test

# 2. Core SDK Unit Tests
npm test -w @peribolos/core

# 3. Backend API Integration Tests
npm test -w @peribolos/api

# 4. Workspace-wide Typecheck
npm run typecheck
```

---

## 📦 Repository Layout

```text
Peribolos/
├── apps/
│   ├── api/          # Express Hosted Payment API & Managed Signer (Deployed on Render)
│   ├── dashboard/    # Next.js 15 Web Control Room (Dashboard V2)
│   ├── demo-agent/   # Example AI Agent implementations (LangChain, OpenAI, CrewAI)
│   └── demo-seller/  # Example x402 Service Provider API
├── contracts/        # Foundry EVM Smart Contracts (Arc L1 Vault & Allowance Enforcer)
├── sdk/
│   ├── core/         # @peribolos/core (TypeScript Hosted Client)
│   └── langchain/    # @peribolos/langchain (LangChain Integration)
└── render.yaml       # Render Blueprint infrastructure declaration
```

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for details.
