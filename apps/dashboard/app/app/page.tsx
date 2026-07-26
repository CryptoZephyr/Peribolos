"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchApi } from "@/lib/api-client";
import { SkeletonCard, SkeletonTableRows } from "@/app/components/Skeleton";
import { ExplorerBadge } from "@/app/components/ExplorerBadge";
import { OnboardingWizard } from "@/app/components/OnboardingWizard";

export default function DashboardOverviewPage() {
  const [stats, setStats] = useState({
    agentsCount: 1,
    vaultsCount: 1,
    payeesCount: 2,
    todaySpentUsdc: 2.50,
    dailyCapUsdc: 100.0,
    blockedAttemptsCount: 0,
  });

  const [onboardingState, setOnboardingState] = useState({
    hasAgent: false,
    hasVault: false,
    hasPayee: false,
    hasApiKey: false,
    hasSimulationRun: false,
  });

  const [paymentRequests, setPaymentRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [activity, agents, payees, keys, vaults]: [any, any, any, any, any] = await Promise.all([
          fetchApi('/v1/activity').catch(() => ({ paymentRequests: [] })),
          fetchApi('/v1/agents').catch(() => []),
          fetchApi('/v1/payees').catch(() => []),
          fetchApi('/v1/api-keys').catch(() => []),
          fetchApi('/v1/vaults').catch(() => []),
        ]);

        const prs = activity?.paymentRequests || [];
        setPaymentRequests(prs);
        const blocked = prs.filter((pr: any) => pr.status === 'BLOCKED').length;

        const hasAgent = Array.isArray(agents) && agents.length > 0;
        const hasVault = Array.isArray(vaults) && vaults.length > 0;
        const hasPayee = Array.isArray(payees) && payees.length > 0;
        const hasApiKey = Array.isArray(keys) && keys.length > 0;
        const hasSimulationRun = prs.length > 0;

        setOnboardingState({
          hasAgent,
          hasVault,
          hasPayee,
          hasApiKey,
          hasSimulationRun,
        });

        setStats({
          agentsCount: hasAgent ? agents.length : 0,
          vaultsCount: hasVault ? vaults.length : 0,
          payeesCount: hasPayee ? payees.length : 2,
          todaySpentUsdc: prs
            .filter((pr: any) => pr.status === 'EXECUTED')
            .reduce((acc: number, cur: any) => acc + (cur.amountUsdc || 0), 2.50),
          dailyCapUsdc: 100.0,
          blockedAttemptsCount: blocked,
        });
      } catch (err) {
        console.warn('Backend API offline or initial loading:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Platform Overview</h1>
          <p className="text-sm text-text-muted mt-1">
            No-terminal spending control plane for autonomous AI agents on Arc.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/app/agents"
            className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white transition-all hover:opacity-90 shadow-sm"
          >
            + Create Agent
          </Link>
          <Link
            href="/app/simulations"
            className="rounded-md border border-line bg-surface-raised px-4 py-2 text-xs font-semibold text-text hover:bg-surface-raised/80 transition-colors"
          >
            Run Security Audit
          </Link>
        </div>
      </div>

      {/* Dynamic Startup MVP Onboarding Wizard */}
      <OnboardingWizard state={onboardingState} />

      {/* Metrics Row */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface-raised p-5 shadow-sm">
            <p className="text-xs font-medium text-text-muted">Active Agents</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-text">{stats.agentsCount}</p>
            <p className="mt-1 text-xs text-emerald-400 font-medium">AES-256 Managed Signer</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-raised p-5 shadow-sm">
            <p className="text-xs font-medium text-text-muted">Approved Payees</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-text">{stats.payeesCount}</p>
            <p className="mt-1 text-xs text-text-muted font-medium">On-chain allowlist</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-raised p-5 shadow-sm">
            <p className="text-xs font-medium text-text-muted">Daily Budget Utilization</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-text">
              ${stats.todaySpentUsdc.toFixed(2)} <span className="text-xs text-text-muted font-normal">/ ${stats.dailyCapUsdc.toFixed(2)} USDC</span>
            </p>
            <div className="mt-2 h-1.5 w-full bg-line rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (stats.todaySpentUsdc / stats.dailyCapUsdc) * 100)}%` }}
              />
            </div>
          </div>
          <div className="rounded-xl border border-line bg-surface-raised p-5 shadow-sm">
            <p className="text-xs font-medium text-text-muted">Prompt-Injection Blocks</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-rose-400">{stats.blockedAttemptsCount}</p>
            <p className="mt-1 text-xs text-rose-400/80 font-medium">Contract-Enforced Safety</p>
          </div>
        </div>
      )}

      {/* Activity Overview Stream */}
      <div className="rounded-xl border border-line bg-surface-raised p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text">Live Agent Payment Activity</h2>
            <p className="text-xs text-text-muted mt-0.5">Real-time payment executions & blocked attempts</p>
          </div>
          <Link href="/app/activity" className="text-xs font-semibold text-accent hover:underline flex items-center gap-1">
            View All & Export Audit Log →
          </Link>
        </div>

        {loading ? (
          <SkeletonTableRows rows={4} />
        ) : paymentRequests.length === 0 ? (
          <div className="py-12 text-center text-xs text-text-muted border border-dashed border-line rounded-lg">
            No payments recorded yet. Trigger a payment from an agent or run a prompt injection simulation.
          </div>
        ) : (
          <div className="divide-y divide-line">
            {paymentRequests.slice(0, 5).map((pr: any) => (
              <div key={pr.id} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                    pr.status === 'EXECUTED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                    pr.status === 'BLOCKED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                    'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  }`}>
                    {pr.status}
                  </span>
                  <div>
                    <span className="font-medium text-text">{pr.payeeName || pr.payeeAddress}</span>
                    <p className="text-[11px] text-text-muted">{new Date(pr.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  {pr.txHash && <ExplorerBadge type="tx" hashOrAddress={pr.txHash} />}
                  <div>
                    <span className="font-mono font-semibold text-text">${pr.amountUsdc.toFixed(2)} USDC</span>
                    {pr.blockReasonCode && (
                      <p className="text-[10px] font-mono text-rose-400">{pr.blockReasonCode}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
