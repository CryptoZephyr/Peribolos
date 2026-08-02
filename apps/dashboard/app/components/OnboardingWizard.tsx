"use client";

import React from "react";
import Link from "next/link";

export interface OnboardingState {
  hasAgent: boolean;
  hasVault: boolean;
  hasPayee: boolean;
  hasApiKey: boolean;
  hasSimulationRun: boolean;
}

export function OnboardingWizard({ state }: { state: OnboardingState }) {
  const steps = [
    {
      id: 1,
      title: "1. Provision Agent",
      desc: "Create agent & server-side signer",
      link: "/app/agents",
      completed: state.hasAgent,
    },
    {
      id: 2,
      title: "2. Create & Fund Vault",
      desc: "On-chain vault + USDC balance",
      link: "/app/vaults",
      completed: state.hasVault,
    },
    {
      id: 3,
      title: "3. Register Payee",
      desc: "Add verified vendor wallet",
      link: "/app/payees",
      completed: state.hasPayee,
    },
    {
      id: 4,
      title: "4. Configure Policy",
      desc: "Set daily budget & per-tx cap",
      link: "/app/vaults",
      completed: state.hasVault,
    },
    {
      id: 5,
      title: "5. Issue API Key",
      desc: "Generate bearer token",
      link: "/app/api-keys",
      completed: state.hasApiKey,
    },
    {
      id: 6,
      title: "6. Security Audit",
      desc: "Run prompt-injection test",
      link: "/app/simulations",
      completed: state.hasSimulationRun,
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <section aria-labelledby="workspace-setup-title" className="rounded-xl border border-accent/20 bg-accent/5 p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 border-b border-accent/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="workspace-setup-title" className="text-sm font-semibold tracking-[-0.01em] text-text">Set up your workspace</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Complete the steps below to configure spending controls on Arc Testnet.
          </p>
        </div>
        <div className="flex items-center gap-3 sm:justify-end">
          <div className="text-right">
            <span className="text-xs font-mono font-bold text-accent">
              {completedCount} of {steps.length} complete
            </span>
          </div>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-line" aria-label={`${progressPercent}% setup complete`}>
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step) => (
          <Link
            key={step.id}
            href={step.link}
            className={`min-h-[96px] rounded-lg border p-3.5 transition-all group ${
              step.completed
                ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50"
                : "border-line bg-surface hover:border-accent/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[11px] font-bold ${
                  step.completed ? "text-emerald-400" : "text-accent group-hover:underline"
                }`}
              >
                {step.title.replace(/^\d+\.\s*/, "")}
              </span>
              {step.completed && <span className="text-xs text-emerald-400 font-bold">✓</span>}
            </div>
            <p className="text-xs text-text font-medium mt-1 leading-snug">{step.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
