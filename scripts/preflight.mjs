/**
 * Preflight — one command to verify the demo stack is ready.
 *
 * Checks:
 *  1. Arc RPC (with failover URLs)
 *  2. Demo vault is alive (balance / agentKey)
 *  3. Optional: x402 seller health on :3402
 *
 * Exit 0 = ready for judges. Exit 1 = fix listed issues.
 *
 *   node scripts/preflight.mjs
 *   npm run preflight
 */
import { createPublicClient } from "viem";
import { arcTestnet } from "viem/chains";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Load SDK dist if built (file:// required on Windows).
let createArcTransport;
let DEMO_VAULT;
let USDC;
try {
  const corePath = pathToFileURL(join(root, "sdk/core/dist/index.js")).href;
  const core = await import(corePath);
  createArcTransport = core.createArcTransport;
  DEMO_VAULT = core.DEMO_VAULT_ADDRESS;
  USDC = core.USDC_ADDRESS;
} catch (e) {
  console.error("SDK not built or failed to load. Run: npm run build:sdk");
  console.error(e.message);
  process.exit(1);
}

const SELLER = process.env.SELLER_URL ?? "http://localhost:3402/health";
const issues = [];
const ok = [];

function pass(msg) {
  console.log(`  ✓ ${msg}`);
  ok.push(msg);
}
function fail(msg) {
  console.log(`  ✗ ${msg}`);
  issues.push(msg);
}

console.log("Peribolos preflight\n");

// --- RPC ---
console.log("1. Arc RPC");
const transport = createArcTransport({
  rpcUrl: process.env.RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL,
});
const client = createPublicClient({ chain: arcTestnet, transport });
try {
  const id = await client.getChainId();
  if (id !== 5042002) fail(`Wrong chain id ${id} (want 5042002)`);
  else pass(`chain id ${id}`);
  const block = await client.getBlockNumber();
  pass(`block ${block}`);
} catch (e) {
  fail(`RPC failed: ${e.shortMessage ?? e.message}`);
}

// --- Vault ---
console.log("\n2. Demo vault");
const vault = process.env.VAULT_ADDRESS ?? DEMO_VAULT;
try {
  const [paused, agentKey, balance] = await Promise.all([
    client.readContract({
      address: vault,
      abi: [{ type: "function", name: "paused", inputs: [], outputs: [{ type: "bool" }], stateMutability: "view" }],
      functionName: "paused",
    }),
    client.readContract({
      address: vault,
      abi: [{ type: "function", name: "agentKey", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" }],
      functionName: "agentKey",
    }),
    client.readContract({
      address: USDC,
      abi: [
        {
          type: "function",
          name: "balanceOf",
          inputs: [{ name: "a", type: "address" }],
          outputs: [{ type: "uint256" }],
          stateMutability: "view",
        },
      ],
      functionName: "balanceOf",
      args: [vault],
    }),
  ]);
  pass(`vault ${vault}`);
  pass(`agent ${agentKey}`);
  pass(`paused=${paused} balance=${Number(balance) / 1e6} USDC`);
  if (paused) fail("Vault is PAUSED — unpause before demos");
  if (balance < 1_000_000n) fail("Vault balance < 1 USDC — fund before vault-pay demos");
} catch (e) {
  fail(`Vault read failed: ${e.shortMessage ?? e.message}`);
}

// --- Env files ---
console.log("\n3. Env files");
const agentEnv = join(root, "apps/demo-agent/.env");
const dashEnv = join(root, "apps/dashboard/.env.local");
if (existsSync(agentEnv)) pass("apps/demo-agent/.env present");
else fail("apps/demo-agent/.env missing (copy .env.example)");
if (existsSync(dashEnv)) pass("apps/dashboard/.env.local present");
else fail("apps/dashboard/.env.local missing (optional but needed for zero-setup Playground)");

// --- Seller ---
console.log("\n4. x402 demo-seller");
const healthUrl = SELLER.includes("/health") ? SELLER : new URL("/health", SELLER).href;
try {
  const res = await fetch(healthUrl, { signal: AbortSignal.timeout(3_000) });
  if (!res.ok) fail(`Seller health HTTP ${res.status}`);
  else {
    const body = await res.json();
    pass(`seller healthy at ${healthUrl} (seller=${body.seller ?? "?"})`);
  }
} catch {
  fail(
    `Seller not reachable at ${healthUrl} — run: npm run dev:seller  (or npm run demo:full)`,
  );
}

// --- Summary ---
console.log("\n────────────────────────────");
if (issues.length === 0) {
  console.log("READY — all checks passed.");
  console.log("Next: npm run demo:full   or   npm run dev:stack");
  process.exit(0);
}
console.log(`NOT READY — ${issues.length} issue(s):`);
for (const i of issues) console.log(`  • ${i}`);
process.exit(1);
