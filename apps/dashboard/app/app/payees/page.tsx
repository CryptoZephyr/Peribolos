"use client";

import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/api-client";
import { useToast } from "@/app/components/Toast";
import { SkeletonCard } from "@/app/components/Skeleton";
import { ExplorerBadge, CopyButton } from "@/app/components/ExplorerBadge";

export default function PayeesPage() {
  const [payees, setPayees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [category, setCategory] = useState("api");
  const [description, setDescription] = useState("");

  const toast = useToast();

  useEffect(() => {
    loadPayees();
  }, []);

  async function loadPayees() {
    try {
      const data: any = await fetchApi("/v1/payees");
      setPayees(data);
    } catch (err) {
      console.warn("Failed to fetch payees:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddPayee(e: React.FormEvent) {
    e.preventDefault();
    try {
      await fetchApi("/v1/payees", {
        method: "POST",
        body: JSON.stringify({ name, address, category, description }),
      });
      toast.success("Payee Added", `${name} added to approved on-chain registry.`);
      setShowModal(false);
      setName("");
      setAddress("");
      setDescription("");
      loadPayees();
    } catch (err: any) {
      toast.error("Failed to Add Payee", err.message);
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b border-line pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Approved Payee Registry</h1>
          <p className="text-sm text-text-muted mt-1">
            Maintain named payee allowlists so AI agents can only send USDC to verified APIs and services.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white hover:opacity-90 shadow-sm transition-all"
        >
          + Add Approved Payee
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : payees.length === 0 ? (
        <div className="py-16 text-center text-xs text-text-muted border border-dashed border-line rounded-xl">
          No approved payees registered yet. Click "+ Add Approved Payee" to register a vendor wallet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {payees.map((payee) => (
            <div
              key={payee.id}
              className="rounded-xl border border-line bg-surface-raised p-5 space-y-3 shadow-sm hover:border-accent/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-text">{payee.name}</h3>
                    {payee.verified && (
                      <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                        VERIFIED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">{payee.description}</p>
                </div>
                <span className="rounded bg-surface px-2 py-0.5 text-[10px] font-mono text-text-muted border border-line uppercase">
                  {payee.category}
                </span>
              </div>

              <div className="border-t border-line pt-3 flex items-center justify-between text-xs">
                <span className="text-text-muted">On-chain Address:</span>
                <div className="flex items-center gap-2">
                  <ExplorerBadge type="address" hashOrAddress={payee.address} />
                  <CopyButton text={payee.address} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-xl border border-line bg-surface-raised p-6 space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold text-text">Add Approved Payee</h2>
            <form onSubmit={handleAddPayee} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Payee Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Weather Data API Provider"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-line bg-surface px-3 py-2 text-xs text-text focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">On-Chain Wallet Address</label>
                <input
                  type="text"
                  required
                  placeholder="0x7099...79C8"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-md border border-line bg-surface px-3 py-2 text-xs font-mono text-text focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-md border border-line bg-surface px-3 py-2 text-xs text-text focus:border-accent focus:outline-none"
                >
                  <option value="api">API Endpoint (x402)</option>
                  <option value="data">Data Feed</option>
                  <option value="compute">Decentralized Compute</option>
                  <option value="service">Service Provider</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="Short description of service provided"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-md border border-line bg-surface px-3 py-2 text-xs text-text focus:border-accent focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-md border border-line px-4 py-2 text-xs font-medium text-text hover:bg-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  Save Payee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
