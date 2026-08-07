"use client";

import Link from "next/link";

export default function SecurityPage() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="border-b border-line pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-text">Security Architecture & Disclosures</h1>
        <p className="text-sm text-text-muted mt-1">
          Why prompt injection cannot override Peribolos smart contract enforcement on Arc.
        </p>
      </div>

      <div className="space-y-6 text-xs text-text-muted leading-relaxed">
        <div className="rounded-xl border border-line bg-surface-raised p-6 space-y-3">
          <h2 className="text-sm font-bold text-text uppercase tracking-wider">Root Principle: Smart Contract Safety</h2>
          <p>
            Traditional AI agent guardrails rely on system prompts or LLM output filtering. However, any malicious instruction that tricks an LLM into modifying its behavior can bypass prompt-based guardrails.
          </p>
          <p>
            Peribolos shifts financial control from the LLM context to on-chain smart contracts (<code className="text-accent font-mono">PeribolosVault.sol</code>). Even if an adversary achieves 100% prompt injection control over an agent&apos;s LLM, the on-chain vault rejects any transaction that breaches per-tx limits, daily caps, or un-allowlisted recipients.
          </p>
          <p>
            Vault owners retain control of vault assets and owner-authorized changes. Hosted agent execution is different: Circle Developer-Controlled Wallets manage agent signing keys server-side, and those keys are never exposed to the browser.
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface-raised p-6 space-y-4">
          <h2 className="text-sm font-bold text-text uppercase tracking-wider">Managed Signer Isolation</h2>
          <ul className="space-y-2 list-disc list-inside">
            <li><strong>Encrypted Private Keys:</strong> Managed agent keys are stored AES-256-GCM encrypted server-side and never exposed to client-side frontend code or static build assets.</li>
            <li><strong>Owner Rotation:</strong> Offline managed signers can be rotated from the Agents dashboard. Live vault signer rotation requires the owner wallet to authorize the vault&apos;s on-chain <code className="text-accent font-mono">rotateAgentKey</code> call first.</li>
            <li><strong>Vault Scope:</strong> Agent signers can only execute approved <code className="text-accent font-mono">vault.pay</code> actions; they cannot withdraw funds or change vault rules.</li>
            <li><strong>Honest outcomes:</strong> The hosted payment API never fabricates EXECUTED tx hashes. Offline vaults return FAILED / OFFLINE_VAULT after a successful policy preflight.</li>
          </ul>
        </div>

        <div className="rounded-xl border border-line bg-surface-raised p-6 space-y-3">
          <h2 className="text-sm font-bold text-text uppercase tracking-wider">Arc Blockchain & Circle USDC Integration</h2>
          <p>
            Built on <strong>Arc Testnet (Chain ID 5042002)</strong>, where USDC is the native gas token. The product records USDC amounts with 6-decimal accounting; live financial state remains the contract and receipt on Arc.
          </p>
          <div className="pt-2 flex flex-wrap gap-4">
            <Link href="/app/simulations" className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline">
              Run live prompt injection security audit →
            </Link>
            <Link href="/app/activity" className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline">
              View activity & export audit log →
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface-raised p-6 space-y-3">
          <h2 className="text-sm font-bold text-text uppercase tracking-wider">Audit Export</h2>
          <p>
            Export every allowed, blocked, and failed payment attempt for compliance and incident review.
          </p>
          <div className="pt-1">
            <Link href="/app/activity" className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent-deep">
              Open activity exports
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 space-y-2">
          <h2 className="text-sm font-bold text-text uppercase tracking-wider">Risk Disclosures</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Testnet only for this MVP; funds and gas on Arc Testnet have no mainnet value guarantee.</li>
            <li>Owner wallet compromise can still rotate rules or agent keys — protect owner credentials.</li>
            <li>Managed signer encryption keys must be stored securely in production (KMS / HSM).</li>
            <li>Product-layer preflight mirrors vault policy for UX speed; live financial finality is always on-chain.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
