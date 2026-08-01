"use client";

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
      desc: "Create agent & Circle signer",
      link: "/app/agents",
      completed: state.hasAgent,
    },
    {
      id: 2,
      title: "2. Create & Fund Vault",
      desc: "Owner deploys live Arc vault",
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
    <div className="rounded-xl border border-accent/20 bg-accent/5 p-6 space-y-4 shadow-sm animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-accent/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-accent animate-ping" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-accent">
              No-Terminal Quickstart Wizard
            </h2>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Follow the 6-step flow to configure spending controls on Arc Testnet
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs font-mono font-bold text-accent">
              {completedCount} / {steps.length} Completed ({progressPercent}%)
            </span>
          </div>
          <div className="h-2 w-28 bg-line rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {steps.map((step) => (
          <Link
            key={step.id}
            href={step.link}
            className={`p-3.5 rounded-lg border transition-all group ${
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
                {step.title}
              </span>
              {step.completed && <span className="text-xs text-emerald-400 font-bold">✓</span>}
            </div>
            <p className="text-xs text-text font-medium mt-1 leading-snug">{step.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
