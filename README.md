# Peribolos

Peribolos gives AI agents a bounded way to spend USDC on Arc. An operator sets the rules; the agent receives an API key; the vault contract checks every payment before funds move.

The repository contains the Arc testnet contracts, a hosted payment API, a web control room, and SDK packages for agent integrations.

## Current status

- Network: [Arc Testnet](https://docs.arc.network) (`5042002`)
- Control room: [peribolos.vercel.app](https://peribolos.vercel.app)
- API: [peribolos-api.onrender.com](https://peribolos-api.onrender.com)
- API health: [peribolos-api.onrender.com/health](https://peribolos-api.onrender.com/health)
- License: [MIT](LICENSE)

This is a testnet product. Do not use it for production funds without configuring durable storage, rotating all deployment secrets, and reviewing the contract and operational controls for your environment.

## What it protects

Peribolos places the spending boundary outside the agent runtime:

1. An operator creates an agent and gives it an API key.
2. The agent submits a payment request to the API.
3. The API performs a policy preflight for the vault, payee, action type, pause state, and spending caps.
4. A managed signer submits `vault.pay` when the vault is live.
5. The Arc contract enforces the same authorization rules on-chain.
6. The API records the result and exposes it through the activity and audit endpoints.

The API never treats an offline vault as an executed payment and never invents a transaction hash.

## Main pieces

| Area | Location | Responsibility |
|---|---|---|
| Web control room | `apps/dashboard` | Agent, vault, payee, signer, activity, and simulation screens |
| Hosted API | `apps/api` | Authentication, policy checks, payments, signer orchestration, and audit export |
| Contracts | `contracts` | Vault ownership, agent authorization, allowlists, caps, pause, and payment enforcement |
| Core SDK | `sdk/core` | TypeScript client for the hosted API and on-chain vaults |
| LangChain SDK | `sdk/langchain` | LangChain tools backed by the hosted payment API |
| Demo services | `apps/demo-agent`, `apps/demo-seller` | Local examples for agent calls and x402-style seller flows |

## Arc testnet details

| Resource | Value |
|---|---|
| Chain ID | `5042002` (`0x4CEF52`) |
| RPC | `https://rpc.testnet.arc.network` |
| Explorer | [testnet.arcscan.app](https://testnet.arcscan.app) |
| Native USDC | `0x3600000000000000000000000000000000000000` |
| Factory | [`0xda3751cd08435D8b5137DD11A9a7797c214cfC4a`](https://testnet.arcscan.app/address/0xda3751cd08435D8b5137DD11A9a7797c214cfC4a) |
| Sample vault | [`0x62D5487d6523fc4D34692e1DbF8EBC01F39BbC7B`](https://testnet.arcscan.app/address/0x62D5487d6523fc4D34692e1DbF8EBC01F39BbC7B) |

## Run it locally

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

Copy the existing environment templates and fill in local values. Never commit `.env` or `.env.local` files.

```bash
cp apps/api/.env.example apps/api/.env
cp apps/dashboard/.env.example apps/dashboard/.env.local
```

The API needs an encryption key before it can create local signer records. Hosted signer provisioning also requires Circle Developer-Controlled Wallet credentials. For local-only policy work, use the explicit development seed settings in `apps/api/.env`; production ignores those development switches.

### Start the stack

Run components separately:

```bash
npm run dev:api         # API on port 3400
npm run dev:dashboard   # dashboard on port 3000
npm run dev:seller      # optional x402 seller on port 3402
```

Or start the local stack runner:

```bash
npm run dev:stack
```

## Using the dashboard

1. Sign in through the dashboard.
2. Create an agent and save the API key when it is shown. It is returned once.
3. Add payees and their EVM addresses.
4. Set the vault caps, allowed action types, expiry, and pause state.
5. Give the agent only its own API key. Keep operator credentials out of agent prompts and code.
6. Use Activity and Audit to review payment attempts and chain events.

The simulation page exercises the policy boundary with adversarial inputs. It does not move funds.

## Payment API

Agent payments use a Bearer API key. The key is hashed before storage; the raw value is not returned after creation.

```bash
curl -X POST https://peribolos-api.onrender.com/v1/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PERIBOLOS_AGENT_API_KEY" \
  -H "Idempotency-Key: $REQUEST_ID" \
  -d '{
    "payeeAddress": "'$PAYEE_ADDRESS'",
    "amountUsdc": 2.50,
    "actionType": 1,
    "idempotencyKey": "'$REQUEST_ID'"
  }'
```

Relevant routes:

| Route | Purpose |
|---|---|
| `GET /health` | Process liveness and network metadata |
| `GET /ready` | Production configuration readiness |
| `POST /v1/payments` | Submit an agent payment |
| `GET /v1/payments/:id` | Read one payment result |
| `GET /v1/activity` | Workspace-scoped payment and chain activity |
| `GET /v1/audit/export` | CSV or JSON audit export |
| `GET /v1/agents` | List agents visible to the credential |
| `GET /v1/vaults` | List vaults visible to the credential |
| `GET /v1/setup/status` | Operator-only signer and network readiness |
| `GET /v1/signers/status` | Operator-only signer-to-vault linkage |

Payment responses use explicit states:

- `EXECUTED`: the chain transaction completed and has a transaction hash.
- `BLOCKED`: policy or contract authorization rejected the request.
- `FAILED`: execution could not complete; no successful chain claim is made.
- `PENDING`: a live transaction is still being processed.

## SDK example

```ts
import { PeribolosHostedClient } from '@peribolos/core';

const client = new PeribolosHostedClient({
  apiKey: process.env.PERIBOLOS_API_KEY!,
  baseUrl: 'https://peribolos-api.onrender.com',
});

const result = await client.pay({
  payeeAddress: process.env.PAYEE_ADDRESS as `0x${string}`,
  amountUsdc: 2.5,
  actionType: 1,
});

console.log(result.status, result.txHash);
```

For LangChain integrations, use `createPeribolosTools` from `@peribolos/langchain` with the same API key and API base URL.

## Security model

| Risk | Control |
|---|---|
| Prompt injection requests an unsafe payment | Policy preflight plus on-chain vault checks |
| Agent receives a private key | Agent receives an API key; signing remains in the managed signer service |
| Agent exceeds a budget | Per-transaction and daily caps are checked before payment and enforced by the vault |
| Agent pays an unknown recipient | Payee allowlists are checked before execution and by the contract |
| Duplicate request retries | Idempotency keys return the existing payment record |
| Operator and agent permissions are mixed | Management routes require an operator credential; payment keys are agent-scoped |

## Configuration and deployment

The Render service uses `render.yaml` for build and start commands. Secrets are supplied through the Render environment, not committed to this repository.

Production requires:

- `CIRCLE_API_KEY`
- `ENTITY_SECRET` or `CIRCLE_ENTITY_SECRET`
- `CIRCLE_WALLET_SET_ID`
- `SIGNER_ENCRYPTION_KEY`
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` (or the `NEXT_PUBLIC_*` equivalents)
- `CORS_ORIGIN`
- `PERIBOLOS_DB_FILE` backed by durable storage

`/health` confirms that the process is running. `/ready` is the stricter check and reports whether the service has the credentials and persistence configuration required for hosted operations.

## Tests and checks

```bash
# API typecheck and build
npm run typecheck -w @peribolos/api
npm run build -w @peribolos/api

# API integration tests
npm run test -w @peribolos/api

# Workspace typecheck
npm run typecheck

# Smart contract tests
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
