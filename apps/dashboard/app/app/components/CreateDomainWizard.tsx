"use client";

/**
 * Create-domain wizard — the owner-side onboarding flow (P0-3).
 *
 * One transaction deploys a rule-configured PeribolosVault, registers the
 * agent in the ERC-8004 registry, forwards a native-gas sliver to the agent
 * EOA, and funds the vault treasury. Everything the vault enforces is set here.
 *
 * Key-handling note: the agent key is generated CLIENT-SIDE and shown once for
 * the owner to copy into their agent's env. Peribolos never transmits or stores
 * it — consistent with "no backend, no key custody". The owner may also paste
 * an address they already control.
 */

import { useEffect, useMemo, useState } from "react";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  isAddress,
  parseUnits,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import {
  ArrowSquareOut,
  Copy,
  Check,
  Plus,
  Trash,
  ShieldCheck,
  Sparkle,
} from "@phosphor-icons/react";
import { ActionType, PERIBOLOS_FACTORY_ADDRESS } from "@peribolos/core";
import { addressUrl, txUrl, publicClient } from "@/lib/chain";
import { describeError } from "@/lib/errors";
import { factoryAbi } from "./contractAbis";
import { useSession } from "../session";

type KeyMode = "generate" | "paste";

const ACTION_OPTIONS: { value: ActionType; label: string }[] = [
  { value: ActionType.SERVICE_PAYMENT, label: "Service payments" },
  { value: ActionType.AGENT_TO_AGENT, label: "Agent-to-agent" },
  { value: ActionType.HUMAN_PAYOUT, label: "Human payouts" },
  { value: ActionType.SWAP, label: "Swaps" },
];

const DAY = 86_400;

function fieldClass(invalid: boolean): string {
  return `w-full rounded-lg border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors placeholder:text-text-faint focus:border-accent ${
    invalid ? "border-blocked" : "border-line"
  }`;
}

export function CreateDomainWizard({
  initialAgentAddress,
  onCreated,
}: {
  initialAgentAddress?: Address | null;
  onCreated: (vault: Address, context: { ownerAddress: Address; agentSignerAddress: Address }) => void;
}) {
  const { address: owner, isConnected, method, writeVault } = useSession();

  // --- form state ---
  // Primary no-terminal path: paste managed signer address from Dashboard → Agents (no browser private key).
  const [keyMode, setKeyMode] = useState<KeyMode>("paste");
  const [generatedKey, setGeneratedKey] = useState<Hex | null>(null);
  const [pastedAgent, setPastedAgent] = useState("");
  const [copied, setCopied] = useState(false);

  const [allowlist, setAllowlist] = useState<string[]>([""]);
  const [perTxCap, setPerTxCap] = useState("2");
  const [dailyCap, setDailyCap] = useState("5");
  const [floatAmount, setFloatAmount] = useState("1");
  const [fundAmount, setFundAmount] = useState("3");
  const [agentGas, setAgentGas] = useState("0.5");
  const [expiryDays, setExpiryDays] = useState("30");
  const [actions, setActions] = useState<Set<ActionType>>(
    () => new Set([ActionType.SERVICE_PAYMENT, ActionType.AGENT_TO_AGENT, ActionType.HUMAN_PAYOUT]),
  );

  const generatedAgentAddress = useMemo(
    () => (generatedKey ? privateKeyToAccount(generatedKey).address : null),
    [generatedKey],
  );

  const agentAddress: Address | null =
    keyMode === "generate"
      ? generatedAgentAddress
      : isAddress(pastedAgent)
        ? (pastedAgent as Address)
        : null;

  const cleanedAllowlist = allowlist.map((a) => a.trim()).filter((a) => a.length > 0);
  const allowlistValid = cleanedAllowlist.every((a) => isAddress(a));

  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [createdVault, setCreatedVault] = useState<Address | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [envCopied, setEnvCopied] = useState(false);

  useEffect(() => {
    if (initialAgentAddress && isAddress(initialAgentAddress)) {
      setKeyMode("paste");
      setPastedAgent(initialAgentAddress);
    }
  }, [initialAgentAddress]);

  const canSubmit =
    isConnected &&
    Boolean(owner) &&
    Boolean(agentAddress) &&
    cleanedAllowlist.length > 0 &&
    allowlistValid &&
    Number(perTxCap) > 0 &&
    Number(dailyCap) > 0 &&
    Number(fundAmount) > 0 &&
    !submitting;

  function toggleAction(a: ActionType) {
    setActions((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  }

  function regenerateKey() {
    // Advanced direct-contract path only. Primary MVP flow uses dashboard
    // managed signers (server-side AES-GCM) — never put agent keys in the browser for production.
    setGeneratedKey(generatePrivateKey());
    setCopied(false);
  }

  async function copyKey() {
    if (!generatedKey) return;
    await navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function submit() {
    if (!agentAddress || !owner) return;

    const allowedActionsMask = Array.from(actions).reduce(
      (mask, a) => mask | (1n << BigInt(a)),
      0n,
    );
    const expirySeconds = BigInt(Math.floor(Date.now() / 1000) + Number(expiryDays) * DAY);
    const agentGasWei = parseEther(agentGas || "0");
    const fundWei = parseEther(fundAmount || "0");

    setError(null);
    setSubmitting(true);
    try {
      const hash = await writeVault({
        address: PERIBOLOS_FACTORY_ADDRESS,
        abi: factoryAbi,
        functionName: "createDomain",
        args: [
          {
            treasury: owner as Address,
            agentKey: agentAddress,
            agentExpiry: expirySeconds,
            perTxCap: parseUnits(perTxCap || "0", 6),
            dailyCap: parseUnits(dailyCap || "0", 6),
            floatAmount: parseUnits(floatAmount || "0", 6),
            allowedActions: allowedActionsMask,
            allowlist: cleanedAllowlist as Address[],
          },
          "ipfs://peribolos-agent",
          agentGasWei,
        ],
        value: agentGasWei + fundWei,
      });
      setTxHash(hash);

      // Resolve the created vault from the DomainCreated event.
      // topics[1] is the indexed vault address, left-padded to 32 bytes.
      const receipt = await publicClient.getTransactionReceipt({ hash });
      let vault: Address | null = null;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== PERIBOLOS_FACTORY_ADDRESS.toLowerCase()) continue;
        const topic = log.topics[1];
        if (topic) {
          vault = (`0x${topic.slice(-40)}`) as Address;
          break;
        }
      }
      if (vault) setCreatedVault(vault);
      else setError("Domain created, but the vault address could not be read from the receipt.");
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  // --- success state ---
  if (createdVault) {
    const envBlock = [
      `VAULT_ADDRESS=${createdVault}`,
      // Prefer hosted API; do not require AGENT_PRIVATE_KEY for the primary product path
      generatedKey
        ? `# ADVANCED direct-contract only — prefer PERIBOLOS_API_KEY=pb_live_... from Dashboard → Agents\nAGENT_PRIVATE_KEY=${generatedKey}`
        : "# Prefer: PERIBOLOS_API_KEY=pb_live_... (Dashboard → Agents). AGENT_PRIVATE_KEY is advanced/direct-contract only.",
      cleanedAllowlist[0] ? `ALLOWLISTED_PAYEE=${cleanedAllowlist[0]}` : "# ALLOWLISTED_PAYEE=0x…",
    ].join("\n");

    return (
      <div className="rounded-xl border border-accent/40 bg-accent-tint p-6 space-y-5">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-accent">
            <ShieldCheck size={18} weight="bold" />
            Domain created
          </div>
          <p className="mt-2 text-sm text-text-muted">
            Your vault is live on Arc testnet and the agent is registered in the ERC-8004 identity
            registry. Rules are already enforcing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href={addressUrl(createdVault)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-text transition-colors hover:text-accent"
          >
            View vault on Arcscan <ArrowSquareOut size={13} />
          </a>
          {txHash && (
            <a
              href={txUrl(txHash)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-text-faint transition-colors hover:text-text"
            >
              Creation transaction <ArrowSquareOut size={13} />
            </a>
          )}
        </div>

        {/* .env handoff (P0-3) */}
        <div className="rounded-lg border border-line bg-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-text">Agent .env handoff</span>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(envBlock);
                setEnvCopied(true);
                setTimeout(() => setEnvCopied(false), 2000);
              }}
              className="flex items-center gap-1 rounded-full border border-line px-2 py-1 text-[11px] text-text"
            >
              {envCopied ? <Check size={12} weight="bold" /> : <Copy size={12} />}
              {envCopied ? "Copied" : "Copy .env"}
            </button>
          </div>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] text-text-muted">
            {envBlock}
          </pre>
        </div>

        <div className="rounded-lg border border-line bg-surface p-3">
          <div className="text-xs font-semibold text-text">Petty-cash funding</div>
          <p className="mt-1 text-[11px] text-text-muted">
            Gateway deposits are intentionally kept out of the public dashboard. Use the local
            demo-agent or a custody-aware backend to fund petty cash with the agent key.
          </p>
        </div>

        <button
          onClick={() => {
            if (owner && agentAddress) {
              onCreated(createdVault, {
                ownerAddress: owner as Address,
                agentSignerAddress: agentAddress,
              });
            }
          }}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-surface transition-colors hover:bg-accent-deep"
        >
          Open this vault
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface-raised p-6">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-text-faint">
        <Sparkle size={14} weight="bold" />
        New protected domain
      </div>
      <p className="mt-2 text-sm text-text-muted">
        One transaction deploys the vault, sets its rules on-chain, registers the agent identity,
        and funds it. Prefer pasting the <strong>managed signer address</strong> from Agents —
        no agent private key in the browser.
      </p>

      <div className="mt-6 space-y-6">
        {/* Agent key */}
        <section>
          <label className="text-sm font-medium text-text">Agent signer address</label>
          <p className="mt-1 text-xs text-text-faint">
            Use the managed signer from Dashboard → Agents (recommended). Generate is advanced
            direct-contract only and should not be the primary path.
          </p>
          <div className="mt-3 inline-flex rounded-full border border-line p-0.5 text-xs">
            {(["generate", "paste"] as KeyMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setKeyMode(mode)}
                className={`rounded-full px-3 py-1 font-medium transition-colors ${
                  keyMode === mode ? "bg-accent text-surface" : "text-text-muted hover:text-text"
                }`}
              >
                {mode === "generate" ? "Generate for me" : "Paste an address"}
              </button>
            ))}
          </div>

          {keyMode === "generate" ? (
            <div className="mt-3">
              <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
                This advanced path creates a private key in your browser. Peribolos never stores it; use the managed signer path unless you control key custody yourself.
              </div>
              {!generatedKey ? (
                <button
                  onClick={regenerateKey}
                  className="rounded-lg border border-line px-3 py-2 text-sm text-text transition-colors hover:border-line-strong"
                >
                  Generate agent key
                </button>
              ) : (
                <div className="rounded-lg border border-line bg-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-text-faint">Agent address</span>
                    <span className="font-mono text-xs text-text">{generatedAgentAddress}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
                    <span className="text-xs text-blocked">Private key (copy now, shown once)</span>
                    <button
                      onClick={copyKey}
                      className="flex items-center gap-1 rounded-full border border-line px-2 py-1 text-xs text-text transition-colors hover:border-line-strong"
                    >
                      {copied ? <Check size={12} weight="bold" /> : <Copy size={12} />}
                      {copied ? "Copied" : "Copy key"}
                    </button>
                  </div>
                  <p className="mt-2 break-all font-mono text-[11px] text-text-muted">
                    {generatedKey}
                  </p>
                  <button
                    onClick={regenerateKey}
                    className="mt-2 text-xs text-text-faint underline-offset-2 hover:underline"
                  >
                    Regenerate
                  </button>
                </div>
              )}
            </div>
          ) : (
            <input
              value={pastedAgent}
              onChange={(e) => setPastedAgent(e.target.value)}
              placeholder="0x... managed signer from Agents"
              className={`mt-3 ${fieldClass(pastedAgent.length > 0 && !isAddress(pastedAgent))}`}
            />
          )}
        </section>

        {/* Allowlist */}
        <section>
          <label className="text-sm font-medium text-text">Recipient allowlist</label>
          <p className="mt-1 text-xs text-text-faint">
            The only addresses the agent can pay via the vault. This is the wall injection cannot
            cross.
          </p>
          <div className="mt-3 space-y-2">
            {allowlist.map((addr, i) => {
              const invalid = addr.trim().length > 0 && !isAddress(addr.trim());
              return (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={addr}
                    onChange={(e) =>
                      setAllowlist((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                    }
                    placeholder="0x… allowlisted recipient"
                    className={fieldClass(invalid)}
                  />
                  {allowlist.length > 1 && (
                    <button
                      onClick={() => setAllowlist((prev) => prev.filter((_, j) => j !== i))}
                      className="shrink-0 rounded-lg border border-line p-2 text-text-faint transition-colors hover:border-blocked hover:text-blocked"
                      aria-label="Remove recipient"
                    >
                      <Trash size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setAllowlist((prev) => [...prev, ""])}
            className="mt-2 flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-accent"
          >
            <Plus size={13} weight="bold" /> Add recipient
          </button>
        </section>

        {/* Caps */}
        <section className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-text">Per-transaction cap</label>
            <div className="mt-2 flex items-center gap-2">
              <input
                inputMode="decimal"
                value={perTxCap}
                onChange={(e) => setPerTxCap(e.target.value)}
                className={fieldClass(perTxCap.length > 0 && !(Number(perTxCap) > 0))}
              />
              <span className="text-xs text-text-faint">USDC</span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-text">Daily cap</label>
            <div className="mt-2 flex items-center gap-2">
              <input
                inputMode="decimal"
                value={dailyCap}
                onChange={(e) => setDailyCap(e.target.value)}
                className={fieldClass(dailyCap.length > 0 && !(Number(dailyCap) > 0))}
              />
              <span className="text-xs text-text-faint">USDC</span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-text">Idle float</label>
            <p className="mt-1 text-[11px] text-text-faint">Kept in the vault; the rest is sweepable.</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                inputMode="decimal"
                value={floatAmount}
                onChange={(e) => setFloatAmount(e.target.value)}
                className={fieldClass(false)}
              />
              <span className="text-xs text-text-faint">USDC</span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-text">Agent key expiry</label>
            <p className="mt-1 text-[11px] text-text-faint">Payments fail closed after this.</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                inputMode="numeric"
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
                className={fieldClass(false)}
              />
              <span className="text-xs text-text-faint">days</span>
            </div>
          </div>
        </section>

        {/* Actions */}
        <section>
          <label className="text-sm font-medium text-text">Allowed action types</label>
          <div className="mt-3 flex flex-wrap gap-2">
            {ACTION_OPTIONS.map((opt) => {
              const on = actions.has(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleAction(opt.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    on
                      ? "border-accent bg-accent-tint text-accent"
                      : "border-line text-text-muted hover:border-line-strong"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Funding */}
        <section className="grid grid-cols-2 gap-4 border-t border-line pt-6">
          <div>
            <label className="text-sm font-medium text-text">Fund vault</label>
            <p className="mt-1 text-[11px] text-text-faint">USDC held by the vault treasury.</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                inputMode="decimal"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                className={fieldClass(fundAmount.length > 0 && !(Number(fundAmount) > 0))}
              />
              <span className="text-xs text-text-faint">USDC</span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-text">Agent gas</label>
            <p className="mt-1 text-[11px] text-text-faint">Sliver sent to the agent EOA for fees.</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                inputMode="decimal"
                value={agentGas}
                onChange={(e) => setAgentGas(e.target.value)}
                className={fieldClass(false)}
              />
              <span className="text-xs text-text-faint">USDC</span>
            </div>
          </div>
        </section>

        {error && (
          <p className="text-xs text-blocked">{error}</p>
        )}

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="w-full rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-surface transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:bg-surface-overlay disabled:text-text-faint"
        >
          {!isConnected
            ? "Sign in to create"
            : submitting
              ? "Confirm and deploy…"
              : "Create domain — one transaction"}
        </button>
        {txHash && !createdVault && (
          <a
            href={txUrl(txHash)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1 text-xs text-text-faint transition-colors hover:text-text"
          >
            Track transaction on Arcscan <ArrowSquareOut size={13} />
          </a>
        )}
      </div>
    </div>
  );
}
