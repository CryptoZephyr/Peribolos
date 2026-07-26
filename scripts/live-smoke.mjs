/**
 * Live end-to-end smoke for Peribolos on Arc testnet.
 * Expects env (never log secrets):
 *   RPC_URL, FACTORY, OWNER_PRIVATE_KEY, AGENT_PRIVATE_KEY
 * Optional: SELLER_URL, RUN_PETTY_CASH=true
 *
 * Steps:
 *  1. Read factory / create domain (if VAULT_ADDRESS unset)
 *  2. Vault state + feeBps
 *  3. Allowlisted pay (1 USDC)
 *  4. Injection drain → PaymentBlocked
 *  5. Optional x402 petty-cash buy
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  parseUnits,
  decodeEventLog,
  formatUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function req(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

const RPC = process.env.RPC_URL ?? "https://rpc.testnet.arc.network";
const FACTORY = req("FACTORY");
const OWNER_KEY = req("OWNER_PRIVATE_KEY");
const AGENT_KEY = req("AGENT_PRIVATE_KEY");
const EXISTING_VAULT = process.env.VAULT_ADDRESS;
const SELLER_URL = process.env.SELLER_URL ?? "http://localhost:3402/weather/lagos";
const RUN_PETTY = process.env.RUN_PETTY_CASH === "true";
const EXPLORER = "https://testnet.arcscan.app";

function loadAbi(path) {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return raw.abi ?? raw;
}
const vaultAbi = loadAbi(join(root, "sdk/core/src/abi/PeribolosVault.json"));
const factoryAbi = loadAbi(join(root, "sdk/core/src/abi/PeribolosFactory.json"));

const USDC = "0x3600000000000000000000000000000000000000";
const ATTACKER = "0x000000000000000000000000000000000000dEaD";

const transport = http(RPC, {
  batch: { batchSize: 10, wait: 40 },
  retryCount: 5,
  retryDelay: 1500,
  timeout: 60_000,
});

const publicClient = createPublicClient({ chain: arcTestnet, transport });
const owner = privateKeyToAccount(OWNER_KEY);
const agent = privateKeyToAccount(AGENT_KEY);
const ownerWallet = createWalletClient({
  account: owner,
  chain: arcTestnet,
  transport,
});
const agentWallet = createWalletClient({
  account: agent,
  chain: arcTestnet,
  transport,
});

const results = [];
function ok(msg, extra) {
  console.log(`✓ ${msg}${extra ? " — " + extra : ""}`);
  results.push({ ok: true, msg, extra });
}
function fail(msg, extra) {
  console.error(`✗ ${msg}${extra ? " — " + extra : ""}`);
  results.push({ ok: false, msg, extra });
}
function scan(hash) {
  return `${EXPLORER}/tx/${hash}`;
}

async function decodePay(receipt, vault) {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== vault.toLowerCase()) continue;
    try {
      const d = decodeEventLog({ abi: vaultAbi, data: log.data, topics: log.topics });
      if (d.eventName === "PaymentExecuted" || d.eventName === "PaymentBlocked") {
        return d;
      }
    } catch {
      /* skip */
    }
  }
  return null;
}

async function createDomain() {
  const allowlist = [owner.address];
  const agentGasWei = parseEther("0.3");
  const fundWei = parseEther("2.5");
  const value = agentGasWei + fundWei;
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 90 * 86400);

  const hash = await ownerWallet.writeContract({
    address: FACTORY,
    abi: factoryAbi,
    functionName: "createDomain",
    args: [
      {
        treasury: owner.address,
        agentKey: agent.address,
        agentExpiry: expiry,
        perTxCap: parseUnits("2", 6),
        dailyCap: parseUnits("10", 6),
        floatAmount: parseUnits("1", 6),
        allowedActions: 7n,
        allowlist,
      },
      "ipfs://peribolos-smoke-v31",
      agentGasWei,
    ],
    value,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("createDomain failed: " + hash);

  let vault = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== FACTORY.toLowerCase()) continue;
    // DomainCreated(vault indexed, owner indexed, agentKey indexed, uri)
    if (log.topics[1]) {
      vault = `0x${log.topics[1].slice(-40)}`;
      break;
    }
  }
  if (!vault) throw new Error("Could not parse vault from DomainCreated");
  return { vault, hash };
}

async function main() {
  console.log("=== Peribolos live smoke (Arc testnet) ===");
  console.log("RPC     ", RPC);
  console.log("Factory ", FACTORY);
  console.log("Owner   ", owner.address);
  console.log("Agent   ", agent.address);

  const chainId = await publicClient.getChainId();
  if (chainId !== 5042002) throw new Error("Wrong chain " + chainId);
  ok("Connected to Arc testnet", String(chainId));

  let vault = EXISTING_VAULT;
  if (!vault) {
    console.log("\n— Creating domain…");
    const created = await createDomain();
    vault = created.vault;
    ok("createDomain", scan(created.hash));
    console.log("Vault  ", vault);
  } else {
    ok("Using existing vault", vault);
  }

  // feeBps (new vaults only)
  try {
    const feeBps = await publicClient.readContract({
      address: vault,
      abi: vaultAbi,
      functionName: "feeBps",
    });
    ok("feeBps readable", String(feeBps));
    if (Number(feeBps) !== 0) fail("feeBps expected 0 on testnet", String(feeBps));
  } catch (e) {
    fail("feeBps read failed (old vault?)", e.message);
  }

  const balance = await publicClient.readContract({
    address: USDC,
    abi: [
      {
        type: "function",
        name: "balanceOf",
        stateMutability: "view",
        inputs: [{ name: "a", type: "address" }],
        outputs: [{ type: "uint256" }],
      },
    ],
    functionName: "balanceOf",
    args: [vault],
  });
  ok("Vault USDC balance", formatUnits(balance, 6));

  const agentOnVault = await publicClient.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: "agentKey",
  });
  if (agentOnVault.toLowerCase() !== agent.address.toLowerCase()) {
    throw new Error(`Agent key mismatch: vault=${agentOnVault} local=${agent.address}`);
  }
  ok("Agent key matches vault");

  // Legit pay
  console.log("\n— Legit vault.pay(1 USDC)…");
  {
    const hash = await agentWallet.writeContract({
      address: vault,
      abi: vaultAbi,
      functionName: "pay",
      args: [owner.address, parseUnits("1", 6), 0],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const ev = await decodePay(receipt, vault);
    if (ev?.eventName === "PaymentExecuted") {
      ok("PaymentExecuted", scan(hash));
    } else {
      fail("Expected PaymentExecuted", JSON.stringify(ev) + " " + scan(hash));
    }
  }

  // Drain / injection
  console.log("\n— Injection drain to 0xdEaD…");
  {
    const bal = await publicClient.readContract({
      address: USDC,
      abi: [
        {
          type: "function",
          name: "balanceOf",
          stateMutability: "view",
          inputs: [{ name: "a", type: "address" }],
          outputs: [{ type: "uint256" }],
        },
      ],
      functionName: "balanceOf",
      args: [vault],
    });
    const hash = await agentWallet.writeContract({
      address: vault,
      abi: vaultAbi,
      functionName: "pay",
      args: [ATTACKER, bal > 0n ? bal : parseUnits("100", 6), 0],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const ev = await decodePay(receipt, vault);
    if (ev?.eventName === "PaymentBlocked") {
      const reason = Number(ev.args.reason);
      if (reason === 1) {
        ok("PaymentBlocked RECIPIENT_NOT_ALLOWLISTED", scan(hash));
      } else {
        fail("Blocked with unexpected reason " + reason, scan(hash));
      }
    } else {
      fail("Expected PaymentBlocked", JSON.stringify(ev) + " " + scan(hash));
    }
  }

  // Petty cash optional
  if (RUN_PETTY) {
    console.log("\n— Petty-cash x402…");
    try {
      const { GatewayClient } = await import("@circle-fin/x402-batching/client");
      const gateway = new GatewayClient({
        chain: "arcTestnet",
        privateKey: AGENT_KEY,
        rpcUrl: RPC,
      });
      const bal = await gateway.getBalances();
      console.log("  Gateway available:", formatUnits(bal.gateway.available, 6), "USDC");
      if (bal.gateway.available < 1000n) {
        console.log("  Depositing 0.5 USDC to Gateway…");
        const dep = await gateway.deposit("0.5");
        ok("Gateway deposit", dep.depositTxHash);
      }
      const paid = await gateway.pay(SELLER_URL);
      if (paid.status >= 200 && paid.status < 300) {
        ok("x402 buy served", `HTTP ${paid.status}`);
      } else {
        fail("x402 buy failed", `HTTP ${paid.status}`);
      }
    } catch (e) {
      fail("x402 path error", e.message ?? String(e));
    }
  } else {
    console.log("\n— Skipping petty cash (set RUN_PETTY_CASH=true to enable)");
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\n=== Summary ===");
  console.log(`PASS ${results.filter((r) => r.ok).length} / FAIL ${failed.length}`);
  console.log("VAULT_ADDRESS=" + vault);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
