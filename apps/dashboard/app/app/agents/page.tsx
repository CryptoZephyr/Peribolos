"use client";

import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/api-client";
import { useToast } from "@/app/components/Toast";
import { SkeletonCard } from "@/app/components/Skeleton";
import { ExplorerBadge, CopyButton } from "@/app/components/ExplorerBadge";
import { Modal } from "@/app/components/Modal";
import { vaultAbi } from "../components/useVault";
import { useSession } from "../session";
import { isAddress, type Address } from "viem";

type SetupStatus = {
  signer: {
    provider: "circle-dcw" | "local-dev" | "unconfigured";
    circle: {
      configured: boolean;
      missingEnv: string[];
      entitySecretEnvName?: "ENTITY_SECRET" | "CIRCLE_ENTITY_SECRET";
    };
    network: {
      name: string;
      chainId: number;
      rpcUrlConfigured: boolean;
    };
    localFallbackEnabled: boolean;
  };
  vaultExecution: {
    authorizationModel: string;
  };
};

type SignerStatus = {
  agentId: string;
  vaultId?: string;
  vaultAddress?: string;
  vaultMode?: "live" | "offline";
  activeSignerAddress?: string;
  provider?: "circle" | "local";
  signerStatus?: "active" | "rotated" | "revoked";
  dbAligned: boolean;
  vaultSignerAddress?: string;
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [vaults, setVaults] = useState<any[]>([]);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [signerStatuses, setSignerStatuses] = useState<SignerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentFramework, setNewAgentFramework] = useState("langchain");
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [keySaved, setKeySaved] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    confirmVariant: "primary" | "danger";
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: "",
    description: "",
    confirmLabel: "Confirm",
    confirmVariant: "primary",
    action: async () => {},
  });
  const [actionLoading, setActionLoading] = useState(false);

  const toast = useToast();
  const { address: ownerAddress, isConnected, writeVault } = useSession();

  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    try {
      const [data, vaultData, setupData, signerData] = await Promise.all([
        fetchApi<any>("/v1/agents"),
        fetchApi<any>("/v1/vaults"),
        fetchApi<SetupStatus>("/v1/setup/status").catch(() => null),
        fetchApi<{ agents?: SignerStatus[] }>("/v1/signers/status").catch(() => null),
      ]);
      setAgents(data);
      setVaults(vaultData);
      setSetupStatus(setupData);
      setSignerStatuses(signerData?.agents || []);
    } catch (err) {
      console.warn("Failed to load agents:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAgent(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res: any = await fetchApi("/v1/agents", {
        method: "POST",
        body: JSON.stringify({
          name: newAgentName,
          framework: newAgentFramework,
          description: `Autonomous ${newAgentFramework} agent managed by Peribolos`,
        }),
      });

      if (res.apiKey) {
        setCreatedApiKey(res.apiKey);
        setKeySaved(false);
        toast.success("Agent provisioned", "The managed signer and payment key are ready.");
      }
      setShowCreateModal(false);
      setNewAgentName("");
      loadAgents();
    } catch (err: any) {
      toast.error("Agent Creation Failed", err.message);
    }
  }

  function promptRotateSigner(
    vaultId: string,
    agentId: string,
    agentName: string,
    vaultMode: "live" | "offline",
    vaultAddress?: string,
  ) {
    const liveRotation = vaultMode === "live";
    setConfirmModal({
      isOpen: true,
      title: liveRotation ? `Rotate On-Chain Agent Key for ${agentName}` : `Rotate Managed Signer for ${agentName}`,
      description: liveRotation
        ? "This provisions a new managed signer, then asks the connected owner wallet to authorize rotateAgentKey on Arc Testnet. The new signer is activated only after the chain confirms the owner transaction."
        : "This rotates the agent key used to initiate vault.pay. In Circle mode it provisions a new Arc Testnet DCW wallet; in local development it creates a new encrypted local signer.",
      confirmLabel: liveRotation ? "Prepare Owner Rotation" : "Rotate Signer",
      confirmVariant: "primary",
      action: async () => {
        setActionLoading(true);
        try {
          let res: any;
          if (liveRotation) {
            if (!isConnected || !ownerAddress || !writeVault || !vaultAddress || !isAddress(vaultAddress)) {
              throw new Error("Connect the vault owner wallet before rotating a live signer.");
            }
            const prepared: any = await fetchApi("/v1/signers/rotate/prepare", {
              method: "POST",
              body: JSON.stringify({ vaultId, agentId }),
            });
            const newExpiry = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
            const txHash = await writeVault({
              address: vaultAddress as Address,
              abi: vaultAbi,
              functionName: "rotateAgentKey",
              args: [prepared.newSignerAddress as Address, BigInt(newExpiry)],
            });
            res = await fetchApi("/v1/signers/rotate/confirm", {
              method: "POST",
              body: JSON.stringify({ vaultId, agentId, newSignerAddress: prepared.newSignerAddress, txHash }),
            });
          } else {
            res = await fetchApi("/v1/signers/rotate", {
              method: "POST",
              body: JSON.stringify({ vaultId, agentId }),
            });
          }
          toast.success(
            liveRotation ? "On-Chain Signer Rotated" : "Signer Rotated Successfully",
            `New Signer Address: ${(res.activeSignerAddress || res.newSignerAddress)?.substring(0, 12)}...`
          );
          await loadAgents();
        } catch (err: any) {
          toast.error("Signer Rotation Failed", err.message);
        } finally {
          setActionLoading(false);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  }

  function promptPauseVault(vaultId: string, currentPaused: boolean, agentName: string) {
    setConfirmModal({
      isOpen: true,
      title: `${currentPaused ? "Unpause" : "Pause"} Vault for ${agentName}`,
      description: currentPaused
        ? "Unpausing will resume allowing agent payments that satisfy budget policies."
        : "Pausing will block ALL future agent payments on-chain with VAULT_PAUSED until unpaused.",
      confirmLabel: currentPaused ? "Unpause Vault" : "Pause Vault",
      confirmVariant: currentPaused ? "primary" : "danger",
      action: async () => {
        setActionLoading(true);
        try {
          await fetchApi("/v1/signers/pause", {
            method: "POST",
            body: JSON.stringify({ vaultId, paused: !currentPaused }),
          });
          toast.info(
            `Vault ${currentPaused ? "Unpaused" : "Paused"}`,
            `Status updated for ${agentName}`
          );
          await loadAgents();
        } catch (err: any) {
          toast.error("Operation Failed", err.message);
        } finally {
          setActionLoading(false);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b border-line pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Autonomous Agents</h1>
          <p className="text-sm text-text-muted mt-1">
            Provision protected spending vaults and managed signers for AI agents without terminal usage.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white hover:opacity-90 shadow-sm transition-all"
        >
          + Provision New Agent
        </button>
      </div>

      {setupStatus?.signer && (
        <div
          className={`rounded-xl border p-5 text-xs ${
            setupStatus.signer.provider === "circle-dcw"
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-amber-500/25 bg-amber-500/10"
          }`}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1.5">
              <h3 className="font-bold uppercase tracking-wider text-text">
                Agent Signer Backend
              </h3>
              <p className="text-text-muted leading-relaxed">
                {setupStatus.signer.provider === "circle-dcw"
                  ? "Circle Developer-Controlled Wallets are ready. New agents will receive Arc Testnet EOA wallets managed by the backend."
                  : setupStatus.signer.provider === "local-dev"
                    ? "Explicit local signer mode is enabled for development only. These wallets are not Circle DCW wallets and cannot authorize production payments."
                    : "Circle DCW is not configured. Agent provisioning is paused so the dashboard cannot create a fake signer. Add the required Circle values, then reload."}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[11px] ${
                setupStatus.signer.provider === "circle-dcw"
                  ? "border-emerald-500/30 text-emerald-400"
                  : "border-amber-500/30 text-amber-400"
              }`}
            >
              {setupStatus.signer.provider === "circle-dcw"
                ? "Circle DCW"
                : setupStatus.signer.provider === "local-dev"
                  ? "Local dev (explicit)"
                  : "DCW unavailable"}
            </span>
          </div>
          {setupStatus.signer.circle.missingEnv.length > 0 && (
            <div className="mt-3 rounded-md border border-line bg-surface px-3 py-2 text-text-muted">
              Missing in <code className="font-mono text-text">apps/api/.env</code>:{" "}
              {setupStatus.signer.circle.missingEnv.map((key) => (
                <code key={key} className="mr-1 font-mono text-amber-300">
                  {key}
                </code>
              ))}
            </div>
          )}
        </div>
      )}

      {createdApiKey && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Agent API Key Generated
            </h3>
            <button onClick={() => setCreatedApiKey(null)} className="text-xs text-text-muted hover:text-text">
              ✕ Close
            </button>
          </div>
          <p className="text-xs text-text">
            Copy this Agent API Key now (`pb_live_...`). It will not be displayed again. You can also use it in this browser so the dashboard loads this workspace consistently:
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={createdApiKey}
              className="flex-1 rounded-md border border-emerald-500/40 bg-surface px-3 py-2 text-xs font-mono text-emerald-300 select-all"
            />
            <CopyButton text={createdApiKey} label="Copy API Key" />
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                window.localStorage.setItem("peribolos.apiKey.v1", createdApiKey);
                window.dispatchEvent(new Event("peribolos-api-key-changed"));
                setKeySaved(true);
                toast.success("Workspace connected", "This browser will now load this agent workspace.");
              }}
              disabled={keySaved}
              className="rounded-lg bg-text px-3 py-2 text-[11px] font-semibold text-white hover:bg-accent disabled:cursor-default disabled:bg-emerald-700"
            >
              {keySaved ? "Using this key in browser" : "Use this key in this browser"}
            </button>
            <span className="text-[11px] text-text-muted">Stored locally; never sent to Peribolos analytics.</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : agents.length === 0 ? (
        <div className="py-16 text-center text-xs text-text-muted border border-dashed border-line rounded-xl">
          No autonomous agents provisioned yet. Click "+ Provision New Agent" to start.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {agents.map((agent) => {
            const vault = vaults.find((v) => v.agentId === agent.id);
            const signerStatus = signerStatuses.find((s) => s.agentId === agent.id);
            const isCircleSigner = signerStatus?.provider === "circle";
            const isLegacyLocalSigner = signerStatus?.provider === "local";
            const displayedSigner = isCircleSigner
              ? signerStatus?.activeSignerAddress
              : setupStatus?.signer.provider === "local-dev"
                ? signerStatus?.activeSignerAddress || vault?.agentSignerAddress
                : undefined;
            return (
              <div
                key={agent.id}
                className="rounded-xl border border-line bg-surface-raised p-6 space-y-4 shadow-sm hover:border-accent/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-text">{agent.name}</h3>
                    <p className="text-xs text-text-muted mt-0.5">{agent.description}</p>
                  </div>
                  <span className="rounded bg-accent/10 border border-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent uppercase font-mono">
                    {agent.framework}
                  </span>
                </div>

                <div className="space-y-2.5 text-xs border-t border-b border-line py-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Managed Signer:</span>
                    {displayedSigner ? (
                      <div className="flex items-center gap-2">
                        <ExplorerBadge type="address" hashOrAddress={displayedSigner} />
                        <CopyButton text={displayedSigner} />
                      </div>
                    ) : isLegacyLocalSigner ? (
                      <span className="font-mono text-amber-300 text-[11px]">Legacy local signer — re-provision DCW</span>
                    ) : (
                      <span className="font-mono text-text-muted text-[11px]">No Circle wallet provisioned</span>
                    )}
                  </div>
                  {signerStatus && !signerStatus.dbAligned && signerStatus.activeSignerAddress && signerStatus.vaultSignerAddress && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
                      The active signer differs from the vault’s recorded agent key. Align them before funding or sending a live payment.
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Vault Contract Mode:</span>
                    <span className="font-mono text-[11px] font-medium text-text">
                      {!vault ? (
                        <span className="text-amber-400">○ NO VAULT</span>
                      ) : vault.mode === "live" ? (
                        <span className="text-emerald-400">● Arc Testnet Live</span>
                      ) : (
                        <span className="text-amber-400">○ Policy simulator (no funds)</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Vault Status:</span>
                    <span
                      className={`font-semibold text-[11px] ${
                        !vault ? "text-amber-400" : vault.paused ? "text-rose-400" : "text-emerald-400"
                      }`}
                    >
                      {!vault ? "NO VAULT" : vault.paused ? "PAUSED" : "ACTIVE"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Daily Budget Cap:</span>
                    {vault ? <span className="font-mono font-semibold text-text">${vault.dailyCapUsdc ?? 0} USDC</span> : <span className="font-mono font-semibold text-amber-400">Not configured</span>}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Per-Tx Cap:</span>
                    {vault ? <span className="font-mono font-semibold text-text">${vault.perTxCapUsdc ?? 0} USDC</span> : <span className="font-mono font-semibold text-amber-400">Not configured</span>}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() =>
                      vault && promptRotateSigner(vault.id, agent.id, agent.name, vault.mode, vault.address)
                    }
                    disabled={!vault}
                    title={!vault ? "Create or link a vault before rotating a signer." : undefined}
                    className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-xs font-semibold text-text hover:bg-surface-raised transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {!vault
                      ? "Vault required"
                      : vault.mode === "live"
                      ? "🔑 Rotate On-Chain Key"
                      : isLegacyLocalSigner
                        ? "♻ Re-provision DCW"
                        : "🔄 Rotate Signer"}
                  </button>
                  {vault?.mode === "live" ? (
                    <a href="/app/vaults" className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-center text-xs font-semibold text-text hover:border-accent hover:text-accent">
                      Owner controls
                    </a>
                  ) : (
                    <button
                      onClick={() => vault && promptPauseVault(vault.id, vault.paused, agent.name)}
                      disabled={!vault}
                      title={!vault ? "Create or link a vault before changing pause state." : undefined}
                      className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold text-white transition-opacity ${
                        vault?.paused ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500"
                      } disabled:cursor-not-allowed disabled:bg-surface-overlay disabled:text-text-faint disabled:hover:bg-surface-overlay`}
                    >
                      {vault ? (vault.paused ? "Resume preflight" : "Pause preflight") : "Vault required"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
        confirmLabel={confirmModal.confirmLabel}
        confirmVariant={confirmModal.confirmVariant}
        onConfirm={confirmModal.action}
        loading={actionLoading}
      >
        <p>{confirmModal.description}</p>
      </Modal>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-xl border border-line bg-surface-raised p-6 space-y-5 shadow-2xl">
            <h2 className="text-lg font-bold text-text">Provision New Autonomous Agent</h2>
            <form onSubmit={handleCreateAgent} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Agent Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LangChain Market Research Bot"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  className="w-full rounded-md border border-line bg-surface px-3 py-2 text-xs text-text focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Framework Integration</label>
                <select
                  value={newAgentFramework}
                  onChange={(e) => setNewAgentFramework(e.target.value)}
                  className="w-full rounded-md border border-line bg-surface px-3 py-2 text-xs text-text focus:border-accent focus:outline-none"
                >
                  <option value="langchain">LangChain / LangGraph</option>
                  <option value="openai-agents-sdk">OpenAI Agents SDK</option>
                  <option value="crewai">CrewAI (Python)</option>
                  <option value="custom">Custom Agent (REST API)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-md border border-line px-4 py-2 text-xs font-medium text-text hover:bg-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  Create & Provision Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
