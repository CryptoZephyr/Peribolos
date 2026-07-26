/**
 * Live Gateway deposit + x402 buy smoke (Arc testnet).
 * Env: AGENT_PRIVATE_KEY, RPC_URL?, SELLER_URL?, DEPOSIT_USDC?
 */
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { formatUnits } from "viem";

const key = process.env.AGENT_PRIVATE_KEY;
if (!key) {
  console.error("Missing AGENT_PRIVATE_KEY");
  process.exit(1);
}
const rpc = process.env.RPC_URL ?? "https://rpc.testnet.arc.network";
const seller = process.env.SELLER_URL ?? "http://localhost:3402/weather/lagos";
const depositAmt = process.env.DEPOSIT_USDC ?? "1";

const gateway = new GatewayClient({
  chain: "arcTestnet",
  privateKey: key.startsWith("0x") ? key : `0x${key}`,
  rpcUrl: rpc,
});

console.log("agent", gateway.address);
console.log("seller", seller);

let bal = await gateway.getBalances();
console.log("wallet USDC", bal.wallet.formatted);
console.log("gateway available", bal.gateway.formattedAvailable);

if (bal.gateway.available < 100_000n) {
  // need at least $0.10
  console.log(`depositing ${depositAmt} USDC to Gateway…`);
  const dep = await gateway.deposit(depositAmt);
  console.log("depositTx", dep.depositTxHash);
  bal = await gateway.getBalances();
  console.log("gateway available after", bal.gateway.formattedAvailable);
}

// Health check seller
const healthUrl = seller.replace(/\/weather\/.*$/, "/health");
try {
  const h = await fetch(healthUrl);
  console.log("seller health", h.status, await h.text());
} catch (e) {
  console.error("seller health failed", e.message);
  process.exit(1);
}

console.log("buying", seller);
const result = await gateway.pay(seller);
console.log("status", result.status);
console.log("data", JSON.stringify(result.data).slice(0, 300));

bal = await gateway.getBalances();
console.log("gateway remaining", bal.gateway.formattedAvailable);

if (result.status < 200 || result.status >= 300) process.exit(1);
console.log("✓ x402 buy OK");
