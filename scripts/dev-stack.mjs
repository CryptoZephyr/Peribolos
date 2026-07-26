/**
 * One-command interactive stack for judges:
 *  - demo-seller (x402) on :3402
 *  - dashboard on :3000
 *
 * Ctrl+C stops both.
 *
 *   npm run dev:stack
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const sellerEnv = {
  ...loadEnvFile(join(root, "apps/demo-seller/.env")),
  SELLER_ADDRESS:
    process.env.SELLER_ADDRESS ||
    loadEnvFile(join(root, "apps/demo-seller/.env")).SELLER_ADDRESS ||
    "0xaE382c0cD4d3E1f704508D3BABe0F55e2A319652",
  PORT: process.env.PORT || "3402",
  GATEWAY_NETWORK: "eip155:5042002",
  GATEWAY_FACILITATOR_URL: "https://gateway-api-testnet.circle.com",
};

const children = [];

function start(name, cmd, args, cwd, extraEnv = {}) {
  console.log(`→ ${name}: ${cmd} ${args.join(" ")}`);
  const child = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (signal) return;
    console.log(`[${name}] exited ${code}`);
  });
  return child;
}

function shutdown() {
  for (const c of children) {
    try {
      c.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
}

process.on("SIGINT", () => {
  console.log("\nStopping stack…");
  shutdown();
  process.exit(0);
});
process.on("SIGTERM", shutdown);

console.log("═══ Peribolos V2 Platform dev:stack ═══");
console.log("  Backend API http://localhost:3400");
console.log("  Dashboard   http://localhost:3000");
console.log("  Seller      http://localhost:3402/health");
console.log("  Ctrl+C to stop all\n");

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

start("api", npx, ["tsx", "src/server.ts"], join(root, "apps/api"));
start("seller", npx, ["tsx", "src/server.ts"], join(root, "apps/demo-seller"), sellerEnv);
start("dashboard", npm, ["run", "dev", "-w", "@peribolos/dashboard"], root);
