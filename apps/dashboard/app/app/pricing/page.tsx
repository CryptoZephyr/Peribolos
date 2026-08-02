"use client";

import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="space-y-8">
      <div className="text-center max-w-2xl mx-auto space-y-3 border-b border-line pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-text">Plans for testing and production</h1>
        <p className="text-sm text-text-muted">
          Give your autonomous AI agents safe spending power with contract-level financial enforcement.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Developer Free Tier */}
        <div className="rounded-xl border border-line bg-surface-raised p-6 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <span className="rounded bg-surface px-2.5 py-1 text-[10px] font-semibold text-text-muted border border-line">Developer</span>
              <h3 className="text-xl font-bold text-text mt-3">Free</h3>
              <p className="text-xs text-text-muted mt-1">For hacking, testing, & local agent development.</p>
            </div>
            <div className="text-3xl font-extrabold text-text font-mono">$0 <span className="text-xs font-normal text-text-muted">/ month</span></div>

            <ul className="space-y-2.5 text-xs text-text-muted border-t border-line pt-4">
              <li className="flex items-center gap-2">✓ <span className="text-text font-medium">1 Autonomous Agent</span></li>
              <li className="flex items-center gap-2">✓ <span className="text-text font-medium">$100 / day Vault Cap</span></li>
              <li className="flex items-center gap-2">✓ <span className="text-text font-medium">1,000 Hosted API Payments</span></li>
              <li className="flex items-center gap-2">✓ <span className="text-text font-medium">Arc Testnet Support</span></li>
              <li className="flex items-center gap-2">✓ <span className="text-text font-medium">Prompt-Injection Audit</span></li>
            </ul>
          </div>

          <Link href="/app/agents" className="w-full text-center rounded-md border border-line bg-surface py-2.5 text-xs font-semibold text-text hover:bg-surface/80">
            Get Started Free
          </Link>
        </div>

        {/* Pro Startup Tier */}
        <div className="rounded-xl border-2 border-accent bg-accent/5 p-6 space-y-6 flex flex-col justify-between relative shadow-lg">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
            Most Popular
          </div>
          <div className="space-y-4">
            <div>
              <span className="rounded bg-accent/20 px-2.5 py-1 text-[10px] font-semibold text-accent">Startup Pro</span>
              <h3 className="text-xl font-bold text-text mt-3">Pro</h3>
              <p className="text-xs text-text-muted mt-1">For teams deploying production agents with real budgets.</p>
            </div>
            <div className="text-3xl font-extrabold text-text font-mono">$49 <span className="text-xs font-normal text-text-muted">/ month</span></div>

            <ul className="space-y-2.5 text-xs text-text border-t border-line pt-4">
              <li className="flex items-center gap-2">✓ <strong>Up to 5 Agents</strong></li>
              <li className="flex items-center gap-2">✓ <strong>$2,500 / day Vault Cap</strong></li>
              <li className="flex items-center gap-2">✓ <strong>50,000 Hosted API Payments</strong></li>
              <li className="flex items-center gap-2">✓ <strong>Managed Server-Side Signers</strong></li>
              <li className="flex items-center gap-2">✓ <strong>Real-time Arc Log Indexer</strong></li>
              <li className="flex items-center gap-2">✓ <strong>CSV / JSON Audit Export</strong></li>
            </ul>
          </div>

          <a
            href="mailto:security@peribolos.io?subject=Peribolos%20Pro%20access"
            className="w-full text-center rounded-md bg-accent py-2.5 text-xs font-semibold text-white hover:bg-accent-deep shadow-sm"
          >
            Talk to us about Pro
          </a>
        </div>

        {/* Team Enterprise Tier */}
        <div className="rounded-xl border border-line bg-surface-raised p-6 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <span className="rounded bg-surface px-2.5 py-1 text-[10px] font-bold text-text-muted uppercase border border-line">Enterprise</span>
              <h3 className="text-xl font-bold text-text mt-3">Team</h3>
              <p className="text-xs text-text-muted mt-1">For enterprises needing dedicated KMS signers & SLAs.</p>
            </div>
            <div className="text-3xl font-extrabold text-text font-mono">$249 <span className="text-xs font-normal text-text-muted">/ month</span></div>

            <ul className="space-y-2.5 text-xs text-text-muted border-t border-line pt-4">
              <li className="flex items-center gap-2">✓ <span className="text-text font-medium">Unlimited Agents & Vaults</span></li>
              <li className="flex items-center gap-2">✓ <span className="text-text font-medium">Custom Vault Caps & Rules</span></li>
              <li className="flex items-center gap-2">✓ <span className="text-text font-medium">Dedicated Cloud KMS Signers</span></li>
              <li className="flex items-center gap-2">✓ <span className="text-text font-medium">Custom Webhooks & Indexing</span></li>
              <li className="flex items-center gap-2">✓ <span className="text-text font-medium">24/7 Security Audit Support</span></li>
            </ul>
          </div>

          <a
            href="mailto:security@peribolos.io?subject=Peribolos%20Team%20plan"
            className="w-full text-center rounded-md border border-line bg-surface py-2.5 text-xs font-semibold text-text hover:bg-surface/80"
          >
            Contact the team
          </a>
        </div>
      </div>
    </div>
  );
}
