/**
 * One-command stage demo:
 *  1. Ensure SDK is importable
 *  2. Start demo-seller if not already healthy
 *  3. Run the scripted agent demo (x402 + vault pay + injection block)
 *  4. Tear down seller if we started it
 *
 *   npm run demo:full
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const SELLER_PORT = Number(process.env.PORT ?? 3402);
const HEALTH = `http://127.0.0.1:${SELLER_PORT}/health`;

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

async function sellerHealthy() {
  try {
    const res = await fetch(HEALTH, { signal: AbortSignal.timeout(2_000) });
    return res.ok;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForSeller(timeoutMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await sellerHealthy()) return true;
    await sleep(400);
  }
  return false;
}

function run(cmd, args, env, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd ?? root,
      env: { ...process.env, ...env },
      stdio: opts.stdio ?? "inherit",
      // shell:false — args are not concatenated (avoids Windows DEP0190)
      shell: false,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
    });
  });
}

let sellerProc = null;

async function main() {
  console.log("═══ Peribolos demo:full ═══\n");

  // Merge env from demo-agent + seller (agent wins on conflict for shared keys)
  const agentEnv = loadEnvFile(join(root, "apps/demo-agent/.env"));
  const sellerEnvFile = loadEnvFile(join(root, "apps/demo-seller/.env"));
  const env = {
    ...sellerEnvFile,
    ...agentEnv,
    RUN_PETTY_CASH: agentEnv.RUN_PETTY_CASH ?? "true",
    SELLER_URL: agentEnv.SELLER_URL ?? `http://127.0.0.1:${SELLER_PORT}/weather/lagos`,
    PORT: String(SELLER_PORT),
    // Zero-config seller payee if unset
    SELLER_ADDRESS:
      sellerEnvFile.SELLER_ADDRESS ||
      process.env.SELLER_ADDRESS ||
      "0xaE382c0cD4d3E1f704508D3BABe0F55e2A319652",
    GATEWAY_NETWORK: sellerEnvFile.GATEWAY_NETWORK || "eip155:5042002",
    GATEWAY_FACILITATOR_URL:
      sellerEnvFile.GATEWAY_FACILITATOR_URL || "https://gateway-api-testnet.circle.com",
  };

  if (!env.AGENT_PRIVATE_KEY || !env.VAULT_ADDRESS) {
    console.error(
      "Missing AGENT_PRIVATE_KEY / VAULT_ADDRESS.\n" +
        "Copy apps/demo-agent/.env.example → .env and fill (or re-run redeploy env setup).",
    );
    process.exit(1);
  }

  // Start seller if needed
  let weStartedSeller = false;
  if (await sellerHealthy()) {
    console.log(`✓ Seller already healthy on :${SELLER_PORT}`);
  } else {
    console.log(`→ Starting demo-seller on :${SELLER_PORT}…`);
    sellerProc = spawn(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["tsx", "src/server.ts"],
      {
        cwd: join(root, "apps/demo-seller"),
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
      },
    );
    weStartedSeller = true;
    sellerProc.stdout?.on("data", (d) => process.stdout.write(`[seller] ${d}`));
    sellerProc.stderr?.on("data", (d) => process.stderr.write(`[seller] ${d}`));

    if (!(await waitForSeller())) {
      console.error("Seller failed to become healthy. Check Gateway/port conflicts.");
      cleanup();
      process.exit(1);
    }
    console.log("✓ Seller ready");
  }

  // Scripted demo
  console.log("\n→ Running scripted 4-beat demo…\n");
  try {
    // Prefer local tsx binary to avoid shell/npx quirks on Windows.
    const tsxBin = join(
      root,
      "node_modules",
      ".bin",
      process.platform === "win32" ? "tsx.cmd" : "tsx",
    );
    await run(
      tsxBin,
      ["--env-file=.env", "src/scripted-demo.ts"],
      env,
      { cwd: join(root, "apps/demo-agent") },
    );
    console.log("\n═══ demo:full COMPLETE ═══");
  } catch (e) {
    console.error("\n═══ demo:full FAILED ═══");
    console.error(e.message);
    cleanup();
    process.exit(1);
  }

  cleanup(weStartedSeller);
}

function cleanup(killSeller = true) {
  if (killSeller && sellerProc && !sellerProc.killed) {
    try {
      sellerProc.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

main().catch((e) => {
  console.error(e);
  cleanup();
  process.exit(1);
});
