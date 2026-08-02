# Peribolos

Peribolos gives autonomous AI agents a bounded way to spend USDC on Arc. An operator defines the rules, the agent receives a scoped API key, and the vault contract checks every payment before funds move.

This repository contains the Arc testnet contracts, hosted payment API, web control room, and SDK packages used to integrate agent runtimes.

## Current status

- Network: [Arc Testnet](https://docs.arc.network), chain `5042002`
- Control room: [peribolos.vercel.app](https://peribolos.vercel.app)
- API: [peribolos-api.onrender.com](https://peribolos-api.onrender.com)
- API health: [peribolos-api.onrender.com/health](https://peribolos-api.onrender.com/health)
- License: [MIT](LICENSE)

Peribolos is a testnet product. Do not use production funds until deployment secrets, signer controls, and contract operations have been reviewed for your environment.

## What it protects

The spending boundary lives outside the agent runtime:

1. An operator creates an agent and gives it a payment API key.
2. The agent submits a payment request to the API.
3. The API checks the vault, payee, action type, pause state, and spending caps.
4. A managed signer submits `vault.pay` when the vault is live.
5. The Arc contract enforces the same authorization rules on-chain.
6. The API records the result and exposes it through activity and audit routes.

Offline vaults are reported as `FAILED`; the API never invents a transaction hash or claims a payment executed when it did not.

## Main pieces

| Area | Location | Responsibility |
|---|---|---|
| Web control room | `apps/dashboard` | Agent, vault, payee, policy, signer, activity, and simulation screens |
| Hosted API | `apps/api` | Authentication, policy checks, payments, signer orchestration, persistence, and audit export |
| Contracts | `contracts` | Vault ownership, caps, pause, allowlists, and payment enforcement |
| Core SDK | `sdk/core` | TypeScript client for the hosted API and on-chain vaults |
| LangChain SDK | `sdk/langchain` | LangChain tools backed by the payment API |
| Demo services | `apps/demo-agent`, `apps/demo-seller` | Local examples for agent calls and x402-style seller flows |

## Dashboard features

The hosted control room supports:

- Email-link, Web3 wallet, and Supabase passkey sign-in
- Passkey registration, active-device review, refresh, and removal from Settings
- Account logout that clears the Supabase session, connected wallet state, and local API-key state
- Agent provisioning and scoped API-key generation
- Vault caps, payee allowlists, action types, expiry, and pause controls
- Activity and audit review
- Prompt-injection simulations against the same policy preflight used by payments

## Arc testnet

| Resource | Value |
|---|---|
| Chain ID | `5042002` (`0x4CEF52`) |
| RPC | `https://rpc.testnet.arc.network` |
| Explorer | [testnet.arcscan.app](https://testnet.arcscan.app) |
| Native USDC | `0x3600000000000000000000000000000000000000` |
| Identity registry | [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://testnet.arcscan.app/address/0x8004A818BFB912233c491871b3d84c89a494bd9e) |
| Peribolos factory | [`0x84B6a05B1d71D5947Adf1438c6FFe8Eb66AdA31E`](https://testnet.arcscan.app/address/0x84b6a05b1d71d5947adf1438c6ffe8eb66ada31e) |
| Sample vault | [`0xac5d542EdCB15972570685B2Fdb87be71d1378a1`](https://testnet.arcscan.app/address/0xac5d542edcb15972570685b2fdb87be71d1378a1) |

## Run locally

### Requirements

- Node.js 20 or newer
- npm
- Foundry, if you plan to work on the contracts

### Install

```bash
git clone https://github.com/CryptoZephyr/Peribolos.git
cd Peribolos
npm install
npm run build:sdk
```

Create local `.env` and `.env.local` files as needed. They are intentionally not committed. The API uses Circle credentials for hosted signer provisioning and Supabase credentials for production persistence. The dashboard uses the public Supabase URL and anon key.

### Start the stack

```bash
npm run dev:api         # API on port 3400
npm run dev:dashboard   # dashboard on port 3000
npm run dev:seller      # optional x402 seller on port 3402
```

Or start the local stack runner:

```bash
npm run dev:stack
```

## Payment API

Agent payments use a Bearer API key. The raw key is shown once and only its hash is stored.

```bash
curl -X POST https://peribolos-api.onrender.com/v1/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PERIBOLOS_AGENT_API_KEY" \
  -H "Idempotency-Key: $REQUEST_ID" \
  -d '{
    "payeeAddress": "'"$PAYEE_ADDRESS"'",
    "amountUsdc": 2.50,
    "actionType": 1,
    "idempotencyKey": "'"$REQUEST_ID"'"
  }'
```

| Route | Purpose |
|---|---|
| `GET /health` | Process liveness and network metadata |
| `GET /ready` | Production signer and persistence readiness |
| `POST /v1/payments` | Submit an agent payment |
| `GET /v1/payments/:id` | Read a payment result |
| `GET /v1/activity` | Workspace-scoped activity |
| `GET /v1/audit/export` | CSV or JSON audit export |
| `GET /v1/setup/status` | Operator-only signer and network readiness |
| `GET /v1/signers/status` | Operator-only signer-to-vault linkage |

Payment responses use explicit states:

- `EXECUTED`: the chain transaction completed and has a transaction hash.
- `BLOCKED`: policy or contract authorization rejected the request.
- `FAILED`: execution could not complete; no successful chain claim is made.
- `PENDING`: a live transaction is still being processed.

## SDK example

```ts
import { PeribolosHostedClient } from "@peribolos/core";

const client = new PeribolosHostedClient({
  apiKey: process.env.PERIBOLOS_API_KEY!,
  baseUrl: "https://peribolos-api.onrender.com",
});

const result = await client.pay({
  payeeAddress: process.env.PAYEE_ADDRESS as `0x${string}`,
  amountUsdc: 2.5,
  actionType: 1,
});

console.log(result.status, result.txHash);
```

For LangChain integrations, use `createPeribolosTools` from `@peribolos/langchain` with the same API key and API base URL.

## Production configuration

Render provides the API process and Vercel provides the dashboard. Secrets are configured in those platforms, never committed to the repository.

Production API configuration includes:

- `CIRCLE_API_KEY`
- `ENTITY_SECRET` or `CIRCLE_ENTITY_SECRET`
- `CIRCLE_WALLET_SET_ID`
- `SIGNER_ENCRYPTION_KEY`
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` (or the `NEXT_PUBLIC_*` equivalents)
- `SUPABASE_SERVICE_ROLE_KEY` for server-only state persistence
- `CORS_ORIGIN`

Run `apps/api/src/db/schema.sql` in the Supabase SQL editor before the first production start. The API stores its current state snapshot in the locked-down `peribolos_state` table. The service-role key is used only by the API and must never be exposed to the dashboard.

For passkeys, configure Supabase Authentication → Passkeys with the production relying-party ID and origin for `peribolos.vercel.app`.

## Security model

| Risk | Control |
|---|---|
| Prompt injection requests an unsafe payment | Policy preflight plus on-chain vault checks |
| Agent receives a private key | Agent receives an API key; signing remains in the managed signer service |
| Agent exceeds a budget | Per-transaction and daily caps are checked before payment and enforced by the vault |
| Agent pays an unknown recipient | Payee allowlists are checked before execution and by the contract |
| Duplicate request retries | Idempotency keys return the existing payment record |
| Operator and agent permissions are mixed | Management routes require operator credentials; payment keys are agent-scoped |

## Tests and checks

```bash
npm run typecheck
npm run build
npm run test -w @peribolos/api

cd contracts
forge test
```

## Repository layout

```text
Peribolos/
├── apps/
│   ├── api/          # Express API, policy layer, signer service, and indexer
│   ├── dashboard/    # Next.js control room
│   ├── demo-agent/   # Local scripted and LLM agent examples
│   └── demo-seller/  # Local seller example
├── contracts/        # PeribolosVault and PeribolosFactory contracts
├── sdk/
│   ├── core/         # @peribolos/core
│   └── langchain/    # @peribolos/langchain
├── scripts/          # Local stack, demo, and preflight helpers
├── architecture.md   # System architecture notes
└── render.yaml       # Render service definition
```

## Further reading

- [Architecture notes](architecture.md)
- [Arc documentation](https://docs.arc.network)
- [Arc testnet explorer](https://testnet.arcscan.app)

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
