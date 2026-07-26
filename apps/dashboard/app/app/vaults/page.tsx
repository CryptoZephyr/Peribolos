"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { fetchApi } from "@/lib/api-client";
import { useToast } from "@/app/components/Toast";
import { SkeletonCard } from "@/app/components/Skeleton";
import { ExplorerBadge, CopyButton } from "@/app/components/ExplorerBadge";
import { CreateDomainWizard } from "../components/CreateDomainWizard";
import { FundVaultPanel } from "../components/FundVaultPanel";
import { OwnerControls } from "../components/OwnerControls";
import { ConnectButton } from "../components/ConnectButton";

type Vault = {
  id: string;
  address: string;
  agentId: string;
  ownerAddress?: string;
  dailyCapUsdc: number;
  perTxCapUsdc: number;
  allowedActionsBitmap: number;
  agentKeyExpiresAt: number;
  paused: boolean;
  mode: "offline" | "live";
  agentSignerAddress?: string;
};

export default function VaultsPage() {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dailyCap, setDailyCap] = useState("100");
  const [perTxCap, setPerTxCap] = useState("25");
  const [liveAddress, setLiveAddress] = useState("");
  const [allowedBitmap, setAllowedBitmap] = useState("255");
  const [saving, setSaving] = useState(false);
  const [showCreateDomain, setShowCreateDomain] = useState(false);
  const [linkVaultId, setLinkVaultId] = useState<string | null>(null);

  const toast = useToast();

  useEffect(() => {
    loadVaults();
  }, []);

  async function loadVaults() {
    try {
      const data: Vault[] = await fetchApi("/v1/vaults");
      setVaults(data);
      if (data.length > 0 && !linkVaultId) {
        setLinkVaultId(data[0].id);
      }
    } catch (err) {
      console.warn("Failed to fetch vaults:", err);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(vault: Vault) {
    setEditingId(vault.id);
    setDailyCap(String(vault.dailyCapUsdc));
    setPerTxCap(String(vault.perTxCapUsdc));
    setAllowedBitmap(String(vault.allowedActionsBitmap));
    setLiveAddress(vault.mode === "live" ? vault.address : "");
  }

  async function saveRules(vaultId: string) {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        dailyCapUsdc: Number(dailyCap),
        perTxCapUsdc: Number(perTxCap),
        allowedActionsBitmap: Number(allowedBitmap),
      };
      if (liveAddress && /^0x[0-9a-fA-F]{40}$/.test(liveAddress)) {
        body.address = liveAddress;
        body.mode = "live";
      }
      await fetchApi(`/v1/vaults/${vaultId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast.success("Spending Rules Updated", "Vault daily & per-tx limits saved.");
      setEditingId(null);
      await loadVaults();
    } catch (err: unknown) {
      toast.error("Failed to Update Rules", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function togglePause(vault: Vault) {
    try {
      await fetchApi("/v1/signers/pause", {
        method: "POST",
        body: JSON.stringify({ vaultId: vault.id, paused: !vault.paused }),
      });
      toast.info(
        `Vault ${vault.paused ? "Unpaused" : "Paused"}`,
        `Vault ${vault.id} status updated.`
      );
      await loadVaults();
    } catch (err: unknown) {
      toast.error("Pause Failed", err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDomainCreated(vaultAddress: Address) {
    const targetId = linkVaultId || vaults[0]?.id;
    if (!targetId) {
      toast.success("Domain Created", `Address: ${vaultAddress.substring(0, 10)}...`);
      setShowCreateDomain(false);
      return;
    }
    try {
      await fetchApi(`/v1/vaults/${targetId}`, {
        method: "PATCH",
        body: JSON.stringify({ address: vaultAddress, mode: "live" }),
      });
      toast.success("Domain Linked as Live Vault", `Arc Vault Address: ${vaultAddress}`);
      setShowCreateDomain(false);
      await loadVaults();
    } catch (err: unknown) {
      toast.error("Link Error", err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Protected Agent Vaults</h1>
          <p className="text-sm text-text-muted mt-1">
            Create and fund on-chain Peribolos vaults, set spending rules, and pause without terminal usage.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ConnectButton />
          <button
            onClick={() => setShowCreateDomain((v) => !v)}
            className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-all shadow-sm"
          >
            {showCreateDomain ? "Hide Create Domain" : "+ Create & Fund Domain"}
          </button>
        </div>
      </div>

      {showCreateDomain && (
        <div className="space-y-3 animate-in fade-in duration-200">
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 text-xs text-text-muted space-y-2">
            <p className="font-semibold text-accent uppercase tracking-wider">No-Terminal On-Chain Setup</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Provision an agent under Agents (generates AES-256 managed signer + API key).</li>
              <li>Set allowlist / budget caps & fund USDC; confirm via connected wallet or passkey.</li>
              <li>Vault is deployed & funded on Arc Testnet; linked dynamically to your agent.</li>
            </ol>
            {vaults.length > 0 && (
              <label className="block pt-2">
                Link created domain to product vault:{" "}
                <select
                  value={linkVaultId || ""}
                  onChange={(e) => setLinkVaultId(e.target.value)}
                  className="ml-1 rounded border border-line bg-surface px-2 py-1 font-mono text-[11px] text-text"
                >
                  {vaults.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.id} ({v.mode})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <CreateDomainWizard onCreated={handleDomainCreated} />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : vaults.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface-raised p-12 text-center text-xs text-text-muted space-y-3">
          <p>No vaults provisioned yet. Create an agent first, then deploy a protected domain.</p>
          <a href="/app/agents" className="text-accent hover:underline font-semibold">
            Go to Agents →
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          {vaults.map((vault) => (
            <div
              key={vault.id}
              className="rounded-xl border border-line bg-surface-raised p-6 space-y-6 shadow-sm hover:border-accent/30 transition-colors"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-text font-mono">Vault {vault.id}</h3>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase font-mono ${
                        vault.mode === "live"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {vault.mode || "offline"}
                    </span>
                    {vault.paused && (
                      <span className="rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold uppercase">
                        Paused
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-text-muted">Vault Address:</span>
                    <ExplorerBadge type="address" hashOrAddress={vault.address} />
                    <CopyButton text={vault.address} />
                  </div>
                  {vault.agentSignerAddress && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-text-muted">Managed Signer:</span>
                      <ExplorerBadge type="address" hashOrAddress={vault.agentSignerAddress} />
                      <CopyButton text={vault.agentSignerAddress} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => togglePause(vault)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-opacity ${
                      vault.paused ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500"
                    }`}
                  >
                    {vault.paused ? "Unpause Vault" : "Pause Vault"}
                  </button>
                  <button
                    onClick={() => startEdit(vault)}
                    className="rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface-raised transition-colors"
                  >
                    Edit Rules
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-line bg-surface p-4">
                  <span className="text-xs text-text-muted">Daily Budget Cap</span>
                  <p className="mt-1 text-lg font-bold text-text font-mono">${vault.dailyCapUsdc.toFixed(2)} USDC</p>
                </div>
                <div className="rounded-lg border border-line bg-surface p-4">
                  <span className="text-xs text-text-muted">Per-Transaction Cap</span>
                  <p className="mt-1 text-lg font-bold text-text font-mono">${vault.perTxCapUsdc.toFixed(2)} USDC</p>
                </div>
                <div className="rounded-lg border border-line bg-surface p-4">
                  <span className="text-xs text-text-muted">Allowed Action Bitmap</span>
                  <p className="mt-1 text-lg font-bold text-accent font-mono">
                    0b{vault.allowedActionsBitmap.toString(2)} ({vault.allowedActionsBitmap})
                  </p>
                </div>
              </div>

              {editingId === vault.id && (
                <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 space-y-3 animate-in fade-in duration-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-accent">Modify Spending Rules</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">Daily Cap (USDC)</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={dailyCap}
                        onChange={(e) => setDailyCap(e.target.value)}
                        className="w-full rounded-md border border-line bg-surface px-3 py-2 text-xs font-mono text-text"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">Per-Tx Cap (USDC)</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={perTxCap}
                        onChange={(e) => setPerTxCap(e.target.value)}
                        className="w-full rounded-md border border-line bg-surface px-3 py-2 text-xs font-mono text-text"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">Allowed Actions Bitmap</label>
                      <input
                        type="number"
                        min="0"
                        value={allowedBitmap}
                        onChange={(e) => setAllowedBitmap(e.target.value)}
                        className="w-full rounded-md border border-line bg-surface px-3 py-2 text-xs font-mono text-text"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-text-muted mb-1">
                      Live Arc Contract Address (Promotes to Live Mode)
                    </label>
                    <input
                      type="text"
                      placeholder="0x..."
                      value={liveAddress}
                      onChange={(e) => setLiveAddress(e.target.value)}
                      className="w-full rounded-md border border-line bg-surface px-3 py-2 text-xs font-mono text-text"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      disabled={saving}
                      onClick={() => saveRules(vault.id)}
                      className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 transition-opacity"
                    >
                      {saving ? "Saving Rules..." : "Save Rules"}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-md border border-line px-4 py-2 text-xs font-medium text-text hover:bg-surface"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <FundVaultPanel
                vaultId={vault.id}
                vaultAddress={vault.address as Address}
                mode={vault.mode || "offline"}
                onFunded={loadVaults}
              />

              {vault.mode === "live" && vault.ownerAddress && (
                <OwnerControls
                  vaultAddress={vault.address as Address}
                  owner={vault.ownerAddress as Address}
                  paused={vault.paused}
                  balance={0n}
                  onSettled={loadVaults}
                />
              )}

              {vault.mode !== "live" && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200/90 leading-relaxed">
                  <strong>Policy Simulator Mode:</strong> Preflight policy checks and security simulations work cleanly. Create a domain above or attach a live deployed Arc contract address under "Edit Rules" to execute live on-chain <code className="font-mono">vault.pay</code> transactions.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
