"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchApi } from "@/lib/api-client";
import { SkeletonCard, SkeletonTableRows } from "@/app/components/Skeleton";
import { ExplorerBadge } from "@/app/components/ExplorerBadge";
import { OnboardingWizard } from "@/app/components/OnboardingWizard";
import { ArrowRight, ShieldCheck, Wallet } from "@phosphor-icons/react";

export default function DashboardOverviewPage() {
  const [stats, setStats] = useState({
    agentsCount: 0,
    vaultsCount: 0,
    payeesCount: 0,
    todaySpentUsdc: 0,
    dailyCapUsdc: 0,
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
          payeesCount: hasPayee ? payees.length : 0,
          todaySpentUsdc: prs
            .filter((pr: any) => pr.status === 'EXECUTED')
            .reduce((acc: number, cur: any) => acc + (cur.amountUsdc || 0), 0),
          dailyCapUsdc: Array.isArray(vaults)
            ? vaults.reduce((acc: number, vault: any) => acc + Number(vault.dailyCapUsdc || 0), 0)
            : 0,
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

  const setupComplete = Object.values(onboardingState).every(Boolean);
  const budgetUsage = stats.dailyCapUsdc > 0
    ? Math.min(100, (stats.todaySpentUsdc / stats.dailyCapUsdc) * 100)
    : 0;

  return (
    <div className="space-y-7 animate-in fade-in duration-300">
      <div className="flex flex-col gap-5 border-b border-line pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Workspace overview</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-text">Platform overview</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-text-muted">
            See what your agents can spend, the rules that contain them, and every decision those rules made.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/app/agents"
            className="rounded-lg bg-text px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-accent"
          >
            + Create Agent
          </Link>
          <Link
            href="/app/simulations"
            className="rounded-lg border border-line bg-surface-raised px-4 py-2.5 text-xs font-semibold text-text hover:border-line-strong hover:bg-surface"
          >
            Run Security Audit
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <section aria-label="Workspace metrics" className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="app-panel p-5">
            <div className="flex items-start justify-between"><p className="text-xs font-semibold text-text-muted">Protected agents</p><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-tint text-accent"><ShieldCheck size={16} weight="bold" /></span></div>
            <p className="mt-6 text-3xl font-semibold tracking-[-0.045em] text-text">{stats.agentsCount}</p>
            <p className="mt-2 text-xs leading-5 text-text-muted">Agents with a wallet boundary you define.</p>
          </div>
          <div className="app-panel p-5">
            <div className="flex items-start justify-between"><p className="text-xs font-semibold text-text-muted">Approved payees</p><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-text-muted"><Wallet size={16} weight="bold" /></span></div>
            <p className="mt-6 text-3xl font-semibold tracking-[-0.045em] text-text">{stats.payeesCount}</p>
            <p className="mt-2 text-xs leading-5 text-text-muted">Recipients that can receive agent payments.</p>
          </div>
          <div className="app-panel p-5">
            <div className="flex items-start justify-between"><p className="text-xs font-semibold text-text-muted">Daily budget</p><span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${stats.blockedAttemptsCount > 0 ? "bg-blocked-tint text-blocked" : "bg-accent-tint text-accent"}`}><span className={`h-1.5 w-1.5 rounded-full ${stats.blockedAttemptsCount > 0 ? "bg-blocked" : "bg-accent"}`} />{stats.blockedAttemptsCount > 0 ? `${stats.blockedAttemptsCount} blocked` : "All clear"}</span></div>
            <p className="mt-6 text-2xl font-semibold tracking-[-0.045em] text-text">
              {stats.dailyCapUsdc > 0 ? (
                <>{`$${stats.todaySpentUsdc.toFixed(2)}`} <span className="text-xs font-normal text-text-muted">/ ${stats.dailyCapUsdc.toFixed(2)} USDC</span></>
              ) : (
                <span className="text-lg text-text-muted">Not configured</span>
              )}
            </p>
            {stats.dailyCapUsdc > 0 ? (
              <>
                <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-line" aria-label={`${Math.round(budgetUsage)}% of daily budget used`}>
                  <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${budgetUsage}%` }} />
                </div>
                <p className="mt-2 text-xs text-text-muted">{Math.round(budgetUsage)}% of the configured limit used.</p>
              </>
            ) : (
              <p className="mt-2 text-xs text-text-muted">Create a vault to start tracking a daily spending limit.</p>
            )}
          </div>
        </section>
      )}

      {!setupComplete && <OnboardingWizard state={onboardingState} />}

      <div className="grid gap-5 xl:grid-cols-[1.5fr_0.8fr]">
      <section className="app-panel space-y-5 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold tracking-[-0.02em] text-text">Recent payment decisions</h2>
            <p className="mt-1 text-xs leading-5 text-text-muted">Live evidence from your protected agents.</p>
          </div>
          <Link href="/app/activity" className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-deep">
            View audit <ArrowRight size={13} weight="bold" />
          </Link>
        </div>

        {loading ? (
          <SkeletonTableRows rows={4} />
        ) : paymentRequests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line bg-surface px-5 py-12 text-center text-xs leading-5 text-text-muted">
            No payment decisions yet. Run a security simulation or trigger a policy-bound payment to create the first audit entry.
          </div>
        ) : (
          <div className="divide-y divide-line">
            {paymentRequests.slice(0, 5).map((pr: any) => (
              <div key={pr.id} className="flex flex-col gap-3 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                    pr.status === 'EXECUTED' ? 'border border-accent/20 bg-accent-tint text-accent' :
                    pr.status === 'BLOCKED' ? 'border border-blocked/20 bg-blocked-tint text-blocked' :
                    'border border-amber-600/20 bg-amber-50 text-amber-700'
                  }`}>
                    {pr.status}
                  </span>
                  <div className="min-w-0">
                    <span className="block truncate font-medium text-text" title={pr.payeeName || pr.payeeAddress}>{pr.payeeName || pr.payeeAddress}</span>
                    <p className="text-[11px] text-text-muted">{new Date(pr.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex w-full items-center justify-between gap-3 text-right sm:w-auto sm:justify-end">
                  {pr.txHash && <ExplorerBadge type="tx" hashOrAddress={pr.txHash} />}
                  <div>
                    <span className="font-mono font-semibold text-text">${pr.amountUsdc.toFixed(2)} USDC</span>
                    {pr.blockReasonCode && (
                      <p className="text-[10px] font-mono text-blocked">{pr.blockReasonCode}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <aside className="app-panel flex flex-col p-5 sm:p-6">
        <div>
          <h2 className="text-base font-semibold tracking-[-0.02em] text-text">Rule coverage</h2>
          <p className="mt-1 text-xs leading-5 text-text-muted">The controls active across this workspace.</p>
        </div>
        <dl className="mt-6 divide-y divide-line border-y border-line">
          <div className="flex items-center justify-between py-4"><dt className="text-sm text-text-muted">Agent vaults</dt><dd className="font-mono text-sm font-semibold text-text">{stats.vaultsCount}</dd></div>
          <div className="flex items-center justify-between py-4"><dt className="text-sm text-text-muted">Recipient rules</dt><dd className="font-mono text-sm font-semibold text-text">{stats.payeesCount}</dd></div>
          <div className="flex items-center justify-between py-4"><dt className="text-sm text-text-muted">Blocked decisions</dt><dd className={`font-mono text-sm font-semibold ${stats.blockedAttemptsCount ? "text-blocked" : "text-accent"}`}>{stats.blockedAttemptsCount}</dd></div>
        </dl>
        <Link href="/app/vaults" className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-xs font-semibold text-text hover:border-line-strong hover:bg-surface-raised">Review vault rules <ArrowRight size={14} weight="bold" /></Link>
      </aside>
      </div>
    </div>
  );
}
