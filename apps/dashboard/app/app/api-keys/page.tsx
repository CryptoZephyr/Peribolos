"use client";

import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/api-client";
import { useToast } from "@/app/components/Toast";
import { SkeletonTableRows } from "@/app/components/Skeleton";
import { CopyButton } from "@/app/components/ExplorerBadge";
import { Modal } from "@/app/components/Modal";

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyName, setKeyName] = useState("");
  const [keyRole, setKeyRole] = useState<"agent" | "operator">("agent");
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [keyToRevoke, setKeyToRevoke] = useState<any | null>(null);
  const [revoking, setRevoking] = useState(false);

  const toast = useToast();

  useEffect(() => {
    loadKeys();
  }, []);

  async function loadKeys() {
    try {
      const data: any = await fetchApi("/v1/api-keys");
      setApiKeys(data);
    } catch (err) {
      console.warn("Failed to load API keys:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res: any = await fetchApi("/v1/api-keys", {
        method: "POST",
        body: JSON.stringify({
          name: keyName || (keyRole === "operator" ? "Workspace Operator Key" : "Agent Key"),
          role: keyRole,
        }),
      });
      if (res.rawApiKey) {
        setNewRawKey(res.rawApiKey);
        toast.success("API Key Generated", "Copy the key string before closing.");
      }
      setKeyName("");
      setKeyRole("agent");
      loadKeys();
    } catch (err: any) {
      toast.error("Key Generation Failed", err.message);
    }
  }

  async function revokeKey() {
    if (!keyToRevoke) return;
    setRevoking(true);
    try {
      await fetchApi(`/v1/api-keys/${keyToRevoke.id}/revoke`, { method: "POST" });
      toast.success("API key revoked", `${keyToRevoke.name} can no longer authenticate requests.`);
      setKeyToRevoke(null);
      await loadKeys();
    } catch (err: any) {
      toast.error("Key revocation failed", err.message);
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="border-b border-line pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-text">Workspace API Keys</h1>
        <p className="text-sm text-text-muted mt-1">
          Issue payment-only agent keys or operator keys for workspace administration. Keep operator keys out of agent runtimes.
        </p>
      </div>

      {newRawKey && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              New API Key Provisioned
            </h3>
            <button onClick={() => setNewRawKey(null)} className="text-xs text-text-muted hover:text-text">
              ✕ Close
            </button>
          </div>
          <p className="text-xs text-text">
            Store this API key in your agent's environment variables. It will not be displayed again:
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={newRawKey}
              className="flex-1 rounded-md border border-emerald-500/40 bg-surface px-3 py-2 text-xs font-mono text-emerald-300 select-all"
            />
            <CopyButton text={newRawKey} label="Copy Key" />
          </div>
        </div>
      )}

      {/* Create Key Card */}
      <div className="rounded-xl border border-line bg-surface-raised p-6 shadow-sm">
        <h2 className="text-xs font-bold text-accent uppercase tracking-wider mb-3">Generate Workspace Key</h2>
        <form onSubmit={handleCreateKey} className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Key Description (e.g. LangChain Prod Key)"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-xs text-text focus:border-accent focus:outline-none"
          />
          <select
            value={keyRole}
            onChange={(e) => setKeyRole(e.target.value as "agent" | "operator")}
            className="rounded-md border border-line bg-surface px-3 py-2 text-xs text-text focus:border-accent focus:outline-none"
          >
            <option value="agent">Agent — payments only</option>
            <option value="operator">Operator — workspace management</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white hover:opacity-90 shadow-sm transition-all"
          >
            + Generate Key
          </button>
        </form>
      </div>

      {/* Keys List */}
      {loading ? (
        <div className="rounded-xl border border-line bg-surface-raised p-6">
          <SkeletonTableRows rows={3} />
        </div>
      ) : apiKeys.length === 0 ? (
        <div className="py-16 text-center text-xs text-text-muted border border-dashed border-line rounded-xl bg-surface-raised">
          No API keys created yet. Enter a description above to generate an API key.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface-raised shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-surface/50 text-text-muted uppercase text-[10px]">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Key Prefix</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Last Used</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {apiKeys.map((key) => (
                <tr key={key.id} className="hover:bg-surface/40 transition-colors">
                  <td className="px-4 py-3 font-bold text-text">{key.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${key.role === "operator" ? "bg-amber-500/10 text-amber-300 border-amber-500/30" : "bg-accent/10 text-accent border-accent/30"}`}>
                      {key.role || "agent"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-accent">{key.keyPrefix}...</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${key.status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-rose-500/10 text-rose-300 border-rose-500/30"}`}>
                      {key.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "Never"}
                  </td>
                  <td className="px-4 py-3 text-text-muted text-right">
                    {new Date(key.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {key.status === "active" ? (
                      <button type="button" onClick={() => setKeyToRevoke(key)} className="rounded-md border border-rose-500/30 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/10">
                        Revoke
                      </button>
                    ) : <span className="text-[11px] text-text-faint">Unavailable</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={Boolean(keyToRevoke)}
        onClose={() => { if (!revoking) setKeyToRevoke(null); }}
        title="Revoke API key"
        confirmLabel="Revoke key"
        confirmVariant="danger"
        onConfirm={() => void revokeKey()}
        loading={revoking}
      >
        <p>Revoke <strong className="text-text">{keyToRevoke?.name}</strong>? Any agent using this credential will be rejected immediately, and this cannot be undone.</p>
      </Modal>
    </div>
  );
}
