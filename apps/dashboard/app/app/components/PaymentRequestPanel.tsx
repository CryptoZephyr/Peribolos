"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowSquareOut, CheckCircle, PaperPlaneTilt, WarningCircle } from "@phosphor-icons/react";
import { fetchApi } from "@/lib/api-client";
import { useToast } from "@/app/components/Toast";

type Payee = { id: string; name: string; address: string; verified?: boolean };
type Result = { status: string; txHash?: string; explorerUrl?: string; description?: string };

const API_KEY_STORAGE_KEY = "peribolos.apiKey.v1";

export function PaymentRequestPanel() {
  const [payees, setPayees] = useState<Payee[]>([]);
  const [payeeAddress, setPayeeAddress] = useState("");
  const [amount, setAmount] = useState("0.01");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const toast = useToast();

  async function loadPayees() {
    const hasKey = Boolean(window.localStorage.getItem(API_KEY_STORAGE_KEY));
    setConfigured(hasKey);
    if (!hasKey) return;
    try {
      const data = await fetchApi<Payee[]>("/v1/payees");
      setPayees(data);
      setPayeeAddress((current) => current || data[0]?.address || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load approved payees.");
    }
  }

  useEffect(() => {
    void loadPayees();
    window.addEventListener("peribolos-api-key-changed", loadPayees);
    return () => window.removeEventListener("peribolos-api-key-changed", loadPayees);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    if (!payeeAddress) {
      setError("Add an approved payee before sending a payment request.");
      return;
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter a positive USDC amount.");
      return;
    }
    if (!confirmed) {
      setError("Confirm that you want to send a real Arc testnet payment.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetchApi<Result>("/v1/payments", {
        method: "POST",
        body: JSON.stringify({
          payeeAddress,
          amountUsdc: numericAmount,
          actionType: 1,
          idempotencyKey: `dashboard_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        }),
      });
      setResult(response);
      toast.success(
        response.status === "EXECUTED" ? "Payment executed" : "Payment decision recorded",
        response.status === "EXECUTED" ? "The transaction is now in Activity & audit." : "Peribolos recorded the policy outcome.",
      );
      setConfirmed(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Payment request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="app-panel overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-line bg-surface px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <p className="eyebrow">Agent test lane</p>
          <h2 className="mt-1 text-base font-semibold tracking-[-0.02em] text-text">Send a policy-bound payment</h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-text-muted">Use a small amount to verify the managed agent, allowlist, vault caps, and audit trail from inside the workspace.</p>
        </div>
        <Link href="/app/activity" className="text-xs font-semibold text-accent hover:text-accent-deep">View audit →</Link>
      </div>
      <div className="p-5 sm:p-6">
        {!configured ? (
          <div className="rounded-lg border border-dashed border-line bg-surface px-4 py-4 text-xs text-text-muted">
            <p className="font-semibold text-text">Connect an agent API key to test payments</p>
            <p className="mt-1 leading-5">The key identifies which managed agent should sign the request. Add it from the header or open API keys.</p>
            <Link href="/app/api-keys" className="mt-3 inline-flex rounded-lg bg-text px-3 py-2 text-xs font-semibold text-white hover:bg-accent">Open API keys</Link>
          </div>
        ) : payees.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line bg-surface px-4 py-4 text-xs text-text-muted">
            <p className="font-semibold text-text">Add an approved payee first</p>
            <p className="mt-1 leading-5">Payments are fail-closed until the recipient is on your workspace allowlist.</p>
            <Link href="/app/payees" className="mt-3 inline-flex rounded-lg bg-text px-3 py-2 text-xs font-semibold text-white hover:bg-accent">Manage payees</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[1.3fr_0.55fr_auto] lg:items-end">
            <label className="text-xs font-semibold text-text">
              Approved payee
              <select value={payeeAddress} onChange={(event) => setPayeeAddress(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-line bg-surface px-3 text-xs font-normal text-text outline-none focus:border-accent">
                {payees.map((payee) => <option key={payee.id || payee.address} value={payee.address}>{payee.name} · {payee.address.slice(0, 8)}…</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-text">
              Amount
              <div className="mt-1.5 flex h-10 items-center rounded-lg border border-line bg-surface px-3 focus-within:border-accent">
                <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" className="min-w-0 flex-1 bg-transparent text-xs font-mono text-text outline-none" />
                <span className="text-[11px] text-text-muted">USDC</span>
              </div>
            </label>
            <button type="submit" disabled={busy} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-text px-4 text-xs font-semibold text-white transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60">
              <PaperPlaneTilt size={14} weight="bold" /> {busy ? "Sending…" : "Send test payment"}
            </button>
            <label className="flex items-start gap-2 text-[11px] text-text-muted lg:col-span-3">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-3.5 w-3.5 rounded border-line text-accent focus:ring-accent" />
              <span>I understand this can move real USDC on Arc testnet and will use a small amount.</span>
            </label>
          </form>
        )}
        {error && <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/25 bg-rose-500/5 px-3 py-3 text-xs text-rose-200"><WarningCircle size={15} className="mt-0.5 shrink-0" /> <span>{error}</span></div>}
        {result && (
          <div role="status" className="mt-4 flex flex-col gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-3 text-xs text-emerald-200 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2"><CheckCircle size={15} className="mt-0.5 shrink-0" /><span>{result.status === "EXECUTED" ? "Executed on Arc testnet." : `Request recorded as ${result.status}.`}</span></div>
            {result.explorerUrl && <a href={result.explorerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-emerald-300 hover:underline">View proof <ArrowSquareOut size={13} /></a>}
          </div>
        )}
      </div>
    </section>
  );
}
