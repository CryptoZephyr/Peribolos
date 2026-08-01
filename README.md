# Peribolos V2

> Non-custodial, rule-enforced USDC spending vaults and managed payment API for autonomous AI agents on [Arc](https://docs.arc.network).

[![Arc Network](https://img.shields.io/badge/Network-Arc%20Testnet%20(5042002)-6366f1?style=for-the-badge&logo=ethereum)](https://testnet.arcscan.app)
[![API Status](https://img.shields.io/badge/API-Live%20on%20Render-emerald?style=for-the-badge&logo=render)](https://peribolos-api.onrender.com/health)
[![USDC Native](https://img.shields.io/badge/Gas-USDC%20Native-2775CA?style=for-the-badge&logo=usdc)](https://testnet.arcscan.app/address/0x3600000000000000000000000000000000000000)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

Peribolos provides on-chain spending controls and a payment API for AI agents. Smart contracts on Arc L1 enforce spending limits, payee allowlists, and permitted action types. A web control room and managed signer service let operators manage agent budgets, monitor audit logs, and simulate prompt injection attacks without giving agents direct access to private keys.

---

## Quick Links

- **Live Backend API**: [https://peribolos-api.onrender.com](https://peribolos-api.onrender.com/health)
- **Local Control Room**: `http://localhost:3000`
- **Architecture Specification**: [architecture.md](architecture.md)
- **Product Specification**: [Peribolos_Product_Spec-3.md](Peribolos_Product_Spec-3.md)

---

## Core Capabilities

| Component | Details |
|---|---|
| **Web Control Room** | Next.js 16 app for agent provisioning, vault configuration, payee allowlists, daily budgets, and API key generation. |
| **Managed Signer** | Server-side AES-256-GCM key isolation. Agents use API keys (`pb_live_...`) instead of raw private keys. |
| **Payment API** | Express 4.21 backend (`POST /v1/payments`) with Bearer token authentication, SHA-256 key hashing, idempotency, and policy checks. |
| **On-Chain Enforcement** | Arc L1 smart contracts (`PeribolosVault.sol`) enforce per-transaction caps, daily velocity limits, action bitmasks, and payee allowlists. |
| **ERC-8004 Identity** | On-chain registration of AI Agent Identity NFTs during domain creation. |
| **Gasless x402 Support** | Circle Gateway Nanopayments support for petty-cash microtransactions (`peribolos_buy`). |
| **Adversarial Laboratory** | In-dashboard prompt injection simulator testing agent attacks against smart contract boundaries. |
| **SDK Ecosystem** | Native packages for TypeScript (`@peribolos/core`), LangChain (`@peribolos/langchain`), OpenAI Agents SDK, and Python / CrewAI. |
| **Audit & Export** | Event indexer with JSON and CSV export endpoints (`/v1/audit/export`). |

---

## Architecture

```mermaid
flowchart TD
    subgraph Agent Environment
        A[AI Agent / LLM] -->|1. Request payment via Bearer key| B[Peribolos API]
    end

    subgraph Managed Infrastructure
        B -->|2. Policy preflight check| C[Managed Signer Service]
        C -->|3. Sign & submit transaction| D[Arc L1 Blockchain]
    end

    subgraph Arc Blockchain - Chain ID 5042002
        D -->|4. Enforce rules| E[Peribolos Vault Contract]
        E -->|5. Transfer native USDC| F[Approved Payee]
    end
```

### Deployed Contracts & Network Specification

| Resource | Value / Address |
|---|---|
| **Blockchain Network** | Arc Testnet (`Chain ID: 5042002 / 0x4CEF52`) |
| **RPC Endpoint** | `https://rpc.testnet.arc.network` |
| **Block Explorer** | [testnet.arcscan.app](https://testnet.arcscan.app) |
| **Native USDC Asset** | `0x3600000000000000000000000000000000000000` (6 decimals, native gas asset) |
| **Peribolos Factory** | [`0x84B6a05B1d71D5947Adf1438c6FFe8Eb66AdA31E`](https://testnet.arcscan.app/address/0x84b6a05b1d71d5947adf1438c6ffe8eb66ada31e) |
| **Sample Vault** | [`0xac5d542EdCB15972570685B2Fdb87be71d1378a1`](https://testnet.arcscan.app/address/0xac5d542edcb15972570685b2fdb87be71d1378a1) |
| **Hosted Backend API** | `https://peribolos-api.onrender.com` |

---

## Setup and Development

### Prerequisites

- Node.js >= 20
- Foundry / Forge (for smart contract testing)

### Installation & Execution

```bash
git clone https://github.com/CryptoZephyr/Peribolos.git
cd Peribolos

# Install dependencies and build SDK packages
npm install
npm run build:sdk

# Option A: Start individual components
npm run dev:api         # Express API & indexer on Port 3400
npm run dev:dashboard   # Next.js control room on Port 3000
npm run dev:seller      # Demo x402 seller API

# Option B: Run full stack via script runner
npm run dev:stack
```

---

## Workflow Guide

1. **Create an agent**: Open **Agents** and click **Provision New Agent**. This creates the agent record, provisions a Circle Developer-Controlled Wallet signer, creates an offline vault placeholder, and returns an agent payment key (`pb_live_...`).
2. **Deploy the live vault**: Open **Vaults**, connect the owner wallet or passkey on Arc Testnet, paste the managed signer address, configure the allowlist/caps, and submit the owner deployment transaction. The API will only accept the resulting address after verifying Arc bytecode and the vault's on-chain `agentKey`.
3. **Configure payees and policy**: Add vendor addresses under **Payees**, then review daily caps, per-transaction limits, and action types under **Vaults**. The contract is the final authority.
4. **Fund and verify**: Fund the vault with Arc-native USDC. The vault page reads the authoritative ERC-20 balance from Arc; recorded transaction notes are not treated as proof of funding.
5. **Execute payments**: Pass the agent payment key to your runtime and call `POST /v1/payments`. Agents can request `vault.pay`; only the on-chain vault can authorize and transfer USDC.
6. **Run security simulations**: Open **Simulations** to test prompt-injection payloads against the same policy preflight used by the payment API.

### Workspace keys and roles

Peribolos separates operator control from agent execution:

- **Agent keys** are payment credentials for runtimes. They can submit payment requests but cannot create agents, change vault configuration, rotate signers, manage payees, or issue keys.
- **Operator keys** are workspace-management credentials for startup operators and Web3 operations teams. They can manage agents, vaults, payees, signers, and workspace keys.

Create and review both key types under **API Keys**. Never place an operator key in an agent environment.

For a live vault, signer rotation is two-phase: an operator prepares a pending signer, the vault owner authorizes `rotateAgentKey` on Arc, and the API confirms the new on-chain key before activating it.

---

## Payment API Reference

### `POST /v1/payments`

Submits a payment request using an agent's API key.

#### Request Example

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

`EXECUTED` is returned only after a live vault transaction is mined and a `PaymentExecuted` event is observed. Offline vaults return `FAILED` with `OFFLINE_VAULT`; they never fabricate transaction hashes.

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

#### Policy Violation Response (`403 Forbidden`)

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

## Developer Integrations

### 1. TypeScript Core SDK (`@peribolos/core`)

```typescript
import { PeribolosHostedClient, PeribolosVaultClient } from "@peribolos/core";

// Hosted API Client
const hostedClient = new PeribolosHostedClient({
  apiKey: process.env.PERIBOLOS_API_KEY!,
  baseUrl: "https://peribolos-api.onrender.com"
});

const response = await hostedClient.pay({
  payeeAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  amountUsdc: 2.50,
  actionType: 1
});

console.log(`Payment Status: ${response.status}, TX: ${response.txHash}`);
```

### 2. LangChain Integration (`@peribolos/langchain`)

```typescript
import { createPeribolosTools } from "@peribolos/langchain";

// Instantiates peribolos_pay, peribolos_buy, and peribolos_status tools
const tools = createPeribolosTools({
  apiKey: process.env.PERIBOLOS_API_KEY!,
  baseUrl: "https://peribolos-api.onrender.com"
});
```

### 3. Executable Demos

```bash
# Scripted deterministic prompt injection demo on Arc testnet
npm run demo

# LLM agent prompt injection demo with LangChain
npm run demo:llm
```

---

## Security Matrix

| Vulnerability Vector | Soft LLM Guardrails | Peribolos Vault Contracts |
|---|---|---|
| **Prompt Injection** | Vulnerable to jailbreaks and system prompt overrides | Immune. Rules execute on-chain on Arc L1. |
| **Private Key Exposure** | Keys stored in environment variables or agent context | Isolated. Managed Signer handles signing server-side. |
| **Overspending** | Agent can hallucinate transaction values | Enforced. Per-tx caps and daily velocity limits in contract. |
| **Unauthorized Payee** | Agent can send funds to arbitrary recipient addresses | Enforced. Contract rejects addresses outside allowlist. |

---

## Testing & Quality Assurance

```bash
# 1. Smart Contract Test Suite (68 local tests + 1 Arc testnet fork test)
cd contracts && forge test

# 2. SDK Unit Tests
npm test -w @peribolos/core

# 3. API Integration Tests
npm test -w @peribolos/api

# 4. Workspace Typecheck across all packages
npm run typecheck
```

---

## Repository Structure

```text
Peribolos/
├── apps/
│   ├── api/          # Express backend API & managed signer service
│   ├── dashboard/    # Next.js 15 control room UI
│   ├── demo-agent/   # Scripted and LLM demo agents
│   └── demo-seller/  # x402 seller API using Circle Gateway
├── contracts/        # Foundry EVM smart contracts (PeribolosVault, PeribolosFactory)
├── sdk/
│   ├── core/         # @peribolos/core (TypeScript RPC & API client)
│   └── langchain/    # @peribolos/langchain (LangChain agent tools)
├── scripts/          # Workspace automation scripts (dev-stack, demo-full, preflight)
└── render.yaml       # Infrastructure setup declaration
```

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
