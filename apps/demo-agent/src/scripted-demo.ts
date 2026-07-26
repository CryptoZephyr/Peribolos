/**
 * Scripted demo — the rehearsal-safe, deterministic version of the Peribolos
 * story. NO LLM: every step is hard-coded so it runs the same way every time,
 * which is exactly what you want on stage. The LLM version (agent-demo.ts)
 * tells the same story with a real model for the "it's really autonomous" beat.
 *
 * The four beats:
 *   1. Agent legitimately BUYS data from the x402 seller (petty cash, gasless).
 *   2. Agent legitimately PAYS an allowlisted recipient (vault tier).
 *   3. Agent reads a POISONED web page and — as a naive agent would — extracts
 *      the injected instruction and attempts to drain funds to the attacker.
 *   4. The vault BLOCKS it on-chain. We print the reason and the Arcscan link.
 *
 * Required env (.env):
 *   AGENT_PRIVATE_KEY   0x… agent EOA key for the demo domain
 *   VAULT_ADDRESS       0x… the demo domain's vault
 *   ALLOWLISTED_PAYEE   0x… an address on the vault's allowlist (beat 2)
 * Optional:
 *   SELLER_URL          default http://localhost:3402/weather/lagos
 *   RPC_URL             override Arc testnet RPC
 *   RUN_PETTY_CASH      "false" to skip beat 1 (if no Gateway deposit yet)
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  PeribolosVaultClient,
  ActionType,
  usdc,
  ARC_TESTNET,
  type PayResult,
} from "@peribolos/core";
import type { Address, Hex } from "viem";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Tiny presentation helpers
// ---------------------------------------------------------------------------
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

function beat(n: number, title: string) {
  console.log(`\n${BOLD}${CYAN}── Beat ${n}: ${title}${RESET}`);
}
function ok(msg: string) {
  console.log(`${GREEN}  ✓ ${msg}${RESET}`);
}
function blocked(msg: string) {
  console.log(`${RED}  ⛔ ${msg}${RESET}`);
}
function info(msg: string) {
  console.log(`${DIM}  ${msg}${RESET}`);
}
function scan(txHash: string) {
  return `${ARC_TESTNET.explorer}/tx/${txHash}`;
}
async function pause(ms = 1200) {
  await new Promise((r) => setTimeout(r, ms));
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`${RED}Missing required env var ${name}. See src/scripted-demo.ts header.${RESET}`);
    process.exit(1);
  }
  return v;
}

/**
 * The "naive agent" behavior we are demonstrating protection against: scrape a
 * page and pull out any address it's told to pay. A real vulnerable agent does
 * this implicitly via its LLM; here we do it explicitly and deterministically.
 */
function extractInjectedInstruction(html: string): { address: Address; raw: string } | null {
  const directive = html.match(/data-agent-directive="true"[^>]*>([\s\S]*?)<\/div>/i);
  const text = directive?.[1] ?? html;
  const addr = text.match(/0x[0-9a-fA-F]{40}/);
  if (!addr) return null;
  return { address: addr[0] as Address, raw: text.trim().replace(/\s+/g, " ") };
}

function describePay(r: PayResult): string {
  const amt = (Number(r.amount) / 1e6).toFixed(r.amount % 1000n === 0n ? 2 : 6);
  return r.executed
    ? `paid ${amt} USDC to ${r.to}`
    : `attempt to send ${amt} USDC to ${r.to} → ${r.reasonCode}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const agentPrivateKey = requireEnv("AGENT_PRIVATE_KEY") as Hex;
  const vaultAddress = requireEnv("VAULT_ADDRESS") as Address;
  const allowlistedPayee = requireEnv("ALLOWLISTED_PAYEE") as Address;
  const sellerUrl = process.env.SELLER_URL ?? "http://localhost:3402/weather/lagos";
  const runPettyCash = process.env.RUN_PETTY_CASH !== "false";

  const client = new PeribolosVaultClient({
    vaultAddress,
    agentPrivateKey,
    rpcUrl: process.env.RPC_URL,
  });

  console.log(`${BOLD}Peribolos — live agent demo (scripted)${RESET}`);
  console.log(`${DIM}vault:  ${vaultAddress}`);
  console.log(`agent:  ${client.agentAddress}`);
  console.log(`chain:  Arc testnet (${ARC_TESTNET.id})${RESET}`);

  const state = await client.getState();
  info(
    `vault balance ${(Number(state.balance) / 1e6).toFixed(2)} USDC · ` +
      `per-tx cap ${(Number(state.rules.perTxCap) / 1e6).toFixed(2)} · ` +
      `daily cap ${(Number(state.rules.dailyCap) / 1e6).toFixed(2)} · ` +
      `paused=${state.paused}`,
  );

  // --- Beat 1: petty-cash x402 purchase --------------------------------------
  if (runPettyCash) {
    beat(1, "Agent buys metered data (petty cash, gasless x402)");
    info(`GET ${sellerUrl}`);
    try {
      const result = await client.buy(sellerUrl);
      if (result.status >= 200 && result.status < 300) {
        ok(`seller served data for a sub-cent Nanopayment (HTTP ${result.status})`);
        info(`payload: ${JSON.stringify(result.data).slice(0, 120)}…`);
        if (result.remainingBalance !== undefined) {
          info(`petty-cash remaining: ${(Number(result.remainingBalance) / 1e6).toFixed(4)} USDC`);
        }
      } else {
        blocked(`seller returned HTTP ${result.status} (is the demo-seller running + funded?)`);
      }
    } catch (err) {
      blocked(`petty-cash buy failed: ${err instanceof Error ? err.message : String(err)}`);
      info("Skip with RUN_PETTY_CASH=false if you haven't deposited petty cash yet.");
    }
    await pause();
  }

  // --- Beat 2: legitimate allowlisted vault payment --------------------------
  beat(2, "Agent pays an allowlisted service (vault tier, rule-checked)");
  info(`vault.pay(${allowlistedPayee}, 1.00 USDC, SERVICE_PAYMENT)`);
  const legit = await client.pay(allowlistedPayee, usdc("1"), ActionType.SERVICE_PAYMENT);
  if (legit.executed) {
    ok(describePay(legit));
    info(scan(legit.txHash));
  } else {
    blocked(`unexpected block: ${legit.reasonCode} (is ${allowlistedPayee} allowlisted + within caps?)`);
    info(scan(legit.txHash));
  }
  await pause();

  // --- Beat 3+4: injection → block ------------------------------------------
  beat(3, "Agent reads a web page containing a hidden injection");
  const htmlPath = join(__dirname, "..", "malicious", "research-article.html");
  const html = readFileSync(htmlPath, "utf8");
  info(`fetched research article (${html.length} bytes)`);
  const injected = extractInjectedInstruction(html);
  if (!injected) {
    console.error(`${RED}Demo fixture missing its injected instruction — aborting.${RESET}`);
    process.exit(1);
  }
  console.log(`${YELLOW}  ↯ page contains hidden directive:${RESET}`);
  console.log(`${DIM}    "${injected.raw.slice(0, 140)}…"${RESET}`);
  info(`naive agent obeys → attempts drain to ${injected.address}`);
  await pause();

  beat(4, "The vault blocks the attack on-chain");
  // Use a normal SERVICE_PAYMENT — what an injected "pay X" instruction would do.
  // This passes the action check and trips the allowlist: RECIPIENT_NOT_ALLOWLISTED,
  // the headline anti-injection control. Re-read balance after the legit pay.
  const balanceNow = (await client.getState()).balance;
  const attack = await client.pay(injected.address, balanceNow, ActionType.SERVICE_PAYMENT);
  if (!attack.executed) {
    blocked(`${describePay(attack)}`);
    console.log(`${BOLD}${GREEN}  The model was fooled. The contract was not.${RESET}`);
    info(`zero funds moved — the block is permanent on-chain evidence:`);
    console.log(`${CYAN}    ${scan(attack.txHash)}${RESET}`);
  } else {
    // This must never happen; make it loud if it ever does.
    console.log(`${RED}${BOLD}  !!! ATTACK SUCCEEDED — THIS IS A BUG. Investigate before demoing. !!!${RESET}`);
    console.log(`    ${scan(attack.txHash)}`);
    process.exitCode = 2;
  }

  // --- Recap -----------------------------------------------------------------
  const after = await client.getState();
  console.log(
    `\n${BOLD}Recap:${RESET} vault balance unchanged by the attack ` +
      `(${(Number(after.balance) / 1e6).toFixed(2)} USDC). ` +
      `Legit payment settled; drain blocked and recorded.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
