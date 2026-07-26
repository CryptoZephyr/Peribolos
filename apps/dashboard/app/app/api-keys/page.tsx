"use client";

import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/api-client";
import { useToast } from "@/app/components/Toast";
import { SkeletonTableRows } from "@/app/components/Skeleton";
import { CopyButton } from "@/app/components/ExplorerBadge";

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyName, setKeyName] = useState("");
  const [newRawKey, setNewRawKey] = useState<string | null>(null);

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
        body: JSON.stringify({ name: keyName || "Agent Key" }),
      });
      if (res.rawApiKey) {
        setNewRawKey(res.rawApiKey);
        toast.success("API Key Generated", "Copy the key string before closing.");
      }
      setKeyName("");
      loadKeys();
    } catch (err: any) {
      toast.error("Key Generation Failed", err.message);
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="border-b border-line pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-text">Agent API Keys</h1>
        <p className="text-sm text-text-muted mt-1">
          Secure bearer tokens (`pb_live_...`) for AI agents connecting to the Peribolos Hosted Payment API.
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
        <h2 className="text-xs font-bold text-accent uppercase tracking-wider mb-3">Generate Agent Key</h2>
        <form onSubmit={handleCreateKey} className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Key Description (e.g. LangChain Prod Key)"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-xs text-text focus:border-accent focus:outline-none"
          />
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
                <th className="px-4 py-3 font-semibold">Key Prefix</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Last Used</th>
                <th className="px-4 py-3 font-semibold text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {apiKeys.map((key) => (
                <tr key={key.id} className="hover:bg-surface/40 transition-colors">
                  <td className="px-4 py-3 font-bold text-text">{key.name}</td>
                  <td className="px-4 py-3 font-mono text-accent">{key.keyPrefix}...</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      {key.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "Never"}
                  </td>
                  <td className="px-4 py-3 text-text-muted text-right">
                    {new Date(key.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
