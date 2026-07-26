"use client";

import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/api-client";
import { useToast } from "@/app/components/Toast";
import { SkeletonCard } from "@/app/components/Skeleton";
import { ExplorerBadge, CopyButton } from "@/app/components/ExplorerBadge";
import { Modal } from "@/app/components/Modal";

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [vaults, setVaults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentFramework, setNewAgentFramework] = useState("langchain");
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);

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

  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    try {
      const data: any = await fetchApi("/v1/agents");
      const vaultData: any = await fetchApi("/v1/vaults");
      setAgents(data);
      setVaults(vaultData);
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
        toast.success("Agent Provisioned!", "New agent, vault & API key generated.");
      }
      setShowCreateModal(false);
      setNewAgentName("");
      loadAgents();
    } catch (err: any) {
      toast.error("Agent Creation Failed", err.message);
    }
  }

  function promptRotateSigner(vaultId: string, agentId: string, agentName: string) {
    setConfirmModal({
      isOpen: true,
      title: `Rotate Managed Signer for ${agentName}`,
      description:
        "This will generate a new AES-256 encrypted private key for this agent's managed signer. The old signer address will be revoked.",
      confirmLabel: "Rotate Signer",
      confirmVariant: "primary",
      action: async () => {
        setActionLoading(true);
        try {
          const res: any = await fetchApi("/v1/signers/rotate", {
            method: "POST",
            body: JSON.stringify({ vaultId, agentId }),
          });
          toast.success(
            "Signer Rotated Successfully",
            `New Signer Address: ${res.newSignerAddress?.substring(0, 12)}...`
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
            Copy your Agent API Key now (`pb_live_...`). It will not be displayed again:
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
                    {vault?.agentSignerAddress ? (
                      <div className="flex items-center gap-2">
                        <ExplorerBadge type="address" hashOrAddress={vault.agentSignerAddress} />
                        <CopyButton text={vault.agentSignerAddress} />
                      </div>
                    ) : (
                      <span className="font-mono text-emerald-400 text-[11px]">Server-side AES-256</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Vault Contract Mode:</span>
                    <span className="font-mono text-[11px] font-medium text-text">
                      {vault?.mode === "live" ? (
                        <span className="text-emerald-400">● Arc Testnet Live</span>
                      ) : (
                        <span className="text-amber-400">○ Policy Simulator</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Vault Status:</span>
                    <span
                      className={`font-semibold text-[11px] ${
                        vault?.paused ? "text-rose-400" : "text-emerald-400"
                      }`}
                    >
                      {vault?.paused ? "PAUSED" : "ACTIVE"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Daily Budget Cap:</span>
                    <span className="font-mono font-semibold text-text">${vault?.dailyCapUsdc || 100} USDC</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Per-Tx Cap:</span>
                    <span className="font-mono font-semibold text-text">${vault?.perTxCapUsdc || 25} USDC</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() =>
                      vault && promptRotateSigner(vault.id, agent.id, agent.name)
                    }
                    className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-xs font-semibold text-text hover:bg-surface-raised transition-colors"
                  >
                    🔄 Rotate Signer
                  </button>
                  <button
                    onClick={() =>
                      vault && promptPauseVault(vault.id, vault.paused, agent.name)
                    }
                    className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold text-white transition-opacity ${
                      vault?.paused
                        ? "bg-emerald-600 hover:bg-emerald-500"
                        : "bg-rose-600 hover:bg-rose-500"
                    }`}
                  >
                    {vault?.paused ? "▶ Unpause Vault" : "⏸ Pause Vault"}
                  </button>
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
