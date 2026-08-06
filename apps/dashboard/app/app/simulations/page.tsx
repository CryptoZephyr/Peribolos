"use client";

import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/api-client";
import { useToast } from "@/app/components/Toast";
import { ExplorerBadge } from "@/app/components/ExplorerBadge";

export default function SimulationsPage() {
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string>("scen_untrusted_drain");
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [running, setRunning] = useState(false);

  const toast = useToast();

  useEffect(() => {
    fetchApi("/v1/simulations/scenarios")
      .then((data: any) => setScenarios(data))
      .catch((err) => console.warn("Failed to load scenarios:", err));
  }, []);

  async function handleRunSimulation() {
    setRunning(true);
    setSimulationResult(null);
    try {
      const res: any = await fetchApi("/v1/simulations/prompt-injection", {
        method: "POST",
        body: JSON.stringify({ scenarioId: selectedScenario }),
      });
      setSimulationResult(res);
      if (res.outcome === "BLOCKED_BY_POLICY") {
        toast.success("Security Audit Passed", "Adversarial prompt blocked by policy preflight.");
      } else {
        toast.info("Audit Completed", "Policy preflight allowed attempt under current rules.");
      }
    } catch (err: any) {
      toast.error("Simulation Error", err.message);
    } finally {
      setRunning(false);
    }
  }

  const blocked = simulationResult?.outcome === "BLOCKED_BY_POLICY";

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="border-b border-line pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-text">Prompt-Injection Security Audit</h1>
        <p className="text-sm text-text-muted mt-1">
          Simulate adversarial prompts against product policy preflight (mirrors PeribolosVault contract rules).
          Test attacks in a safe environment without executing live Arc payments.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-5 rounded-xl border border-line bg-surface-raised p-6 space-y-5 shadow-sm">
          <h2 className="text-xs font-bold text-accent uppercase tracking-wider">Select Attack Fixture</h2>

          <div className="space-y-3">
            {scenarios.map((scen) => (
              <label
                key={scen.id}
                className={`block rounded-lg border p-4 cursor-pointer transition-colors ${
                  selectedScenario === scen.id
                    ? "border-accent bg-accent/5"
                    : "border-line bg-surface hover:border-accent/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text">{scen.name}</span>
                  <input
                    type="radio"
                    name="scenario"
                    value={scen.id}
                    checked={selectedScenario === scen.id}
                    onChange={() => setSelectedScenario(scen.id)}
                    className="text-accent"
                  />
                </div>
                <p className="text-[11px] text-text-muted mt-1 leading-relaxed">{scen.maliciousInstruction}</p>
                <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-text-muted border-t border-line/60 pt-2">
                  <span>Target: ${scen.requestedAmountUsdc} USDC</span>
                  <span className="text-amber-400 font-semibold">Blocks if: {scen.expectedBlockReason}</span>
                </div>
              </label>
            ))}
          </div>

          <button
            onClick={handleRunSimulation}
            disabled={running}
            className="w-full rounded-md bg-accent py-2.5 text-xs font-semibold text-white hover:opacity-90 shadow-sm transition-all disabled:opacity-50"
          >
            {running ? "Executing preflight audit..." : "⚡ Run Prompt-Injection Test"}
          </button>
        </div>

        <div className="lg:col-span-7 rounded-xl border border-line bg-surface-raised p-6 space-y-6 shadow-sm">
          <h2 className="text-xs font-bold text-accent uppercase tracking-wider">Security Proof Report</h2>

          {!simulationResult ? (
            <div className="py-20 text-center text-xs text-text-muted border border-dashed border-line rounded-lg">
              Select an attack fixture on the left and click "Run Prompt-Injection Test" to generate a security proof.
            </div>
          ) : (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div
                className={`rounded-lg border p-4 space-y-2 ${
                  blocked
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-amber-500/30 bg-amber-500/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${
                      blocked ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {blocked ? "✓ Policy Blocked Attack" : "⚠️ Unexpected Pass — Policy Review Required"}
                  </span>
                  <span className="rounded bg-surface/50 px-2 py-0.5 text-[10px] font-mono font-bold text-text border border-line">
                    {simulationResult.outcome}
                  </span>
                </div>
                <p className={`text-xs ${blocked ? "text-emerald-200" : "text-amber-100"} leading-relaxed`}>
                  {blocked ? (
                    <>
                      The injected payment attempt was <strong>blocked by product policy preflight</strong>{" "}
                      (mirrors on-chain vault allowlist & caps). No funds moved.
                    </>
                  ) : (
                    <>
                      Preflight <strong>allowed</strong> this attempt under current vault rules. Restrict{" "}
                      <code className="font-mono">allowedActionsBitmap</code> or caps if this scenario should fail closed.
                    </>
                  )}
                </p>
                <div className="text-[10px] text-text-muted font-mono pt-1">
                  Enforcement: <span className="text-accent">{simulationResult.enforcementLayer || "product_preflight"}</span> | Preflight Passed: {String(simulationResult.preflightAllowed)}
                </div>
              </div>

              <div className="rounded-lg border border-line bg-surface p-4 space-y-3.5 text-xs">
                <div>
                  <span className="text-text-muted font-medium">Injected Adversarial Prompt:</span>
                  <p className="font-mono text-rose-300 bg-rose-950/40 p-3 rounded-md mt-1.5 border border-rose-500/20 leading-relaxed text-[11px]">
                    "{simulationResult.promptPayload}"
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-line">
                  <div>
                    <span className="text-text-muted">Target Payee Address:</span>
                    <div className="mt-1 flex items-center gap-1.5">
                      <ExplorerBadge type="address" hashOrAddress={simulationResult.attemptedPayment?.payeeAddress} />
                    </div>
                  </div>
                  <div>
                    <span className="text-text-muted">Attempted Amount:</span>
                    <p className="font-mono font-semibold text-text mt-1">${simulationResult.attemptedPayment?.amountUsdc} USDC</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-line">
                  {blocked ? (
                    <>
                      <span className="text-text-muted">Enforced Block Reason:</span>
                      <p className="font-mono text-rose-400 font-bold mt-1 text-xs">{simulationResult.blockReasonCode}</p>
                      <p className="text-text-muted text-[11px] mt-0.5 leading-relaxed">{simulationResult.blockReasonDescription}</p>
                    </>
                  ) : (
                    <>
                      <span className="text-text-muted font-medium">Would-block reason if configured:</span>
                      <p className="font-mono text-amber-400 font-bold mt-1 text-xs">{simulationResult.expectedBlockReason}</p>
                      <p className="text-text-muted text-[11px] mt-0.5 leading-relaxed">{simulationResult.blockReasonDescription}</p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-xs">
                {simulationResult.explorerUrl ? (
                  <ExplorerBadge type="address" hashOrAddress={simulationResult.vaultAddress} label="View Vault on Arcscan ↗" />
                ) : (
                  <span className="text-text-muted text-[11px] font-mono">Vault Mode: Policy Simulator</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
