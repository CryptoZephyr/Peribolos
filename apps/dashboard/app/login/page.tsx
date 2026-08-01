"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck } from "@phosphor-icons/react";
import { useSupabaseAuth } from "@/app/auth/SupabaseAuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { configured, loading, session, signInWithOtp, signInWithWeb3, signInWithPasskey } = useSupabaseAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [methodBusy, setMethodBusy] = useState<"web3" | "passkey" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) router.replace("/app");
  }, [router, session]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSent(false);
    const value = email.trim().toLowerCase();
    if (!value || !value.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      await signInWithOtp(value);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send the sign-in link.");
    } finally {
      setBusy(false);
    }
  }

  async function signInWith(method: "web3" | "passkey") {
    setError(null);
    setSent(false);
    setMethodBusy(method);
    try {
      if (method === "web3") await signInWithWeb3();
      else await signInWithPasskey();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete sign-in.");
    } finally {
      setMethodBusy(null);
    }
  }

  return (
    <main className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-surface">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[-10%] h-[520px] w-[520px] -translate-x-1/2 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle, rgba(52,211,153,0.16), transparent 70%)" }} />
      <header className="relative px-6 py-6">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between">
          <Link href="/" className="text-[15px] font-medium tracking-tight text-text">Peribolos</Link>
          <Link href="/" className="text-sm text-text-muted transition-colors hover:text-text">Back home</Link>
        </div>
      </header>
      <div className="relative flex flex-1 items-center justify-center px-6 pb-24">
        <div className="w-full max-w-[400px]">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-surface-raised"><ShieldCheck size={20} weight="bold" className="text-accent" /></span>
            <h1 className="mt-6 text-2xl font-medium tracking-tight text-text">Sign in to Peribolos</h1>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">Use your email to access your workspace. Owner wallet approval is requested only when an on-chain vault action needs it.</p>
          </div>

          <form onSubmit={submit} className="mt-8 space-y-3">
            <label htmlFor="email" className="block text-xs font-medium text-text-muted">Work email</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" disabled={!configured || busy} className="w-full rounded-2xl border border-line bg-surface-raised px-4 py-3.5 text-sm text-text outline-none focus:border-accent disabled:opacity-60" />
            <button type="submit" disabled={!configured || busy || loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-3.5 text-sm font-semibold text-surface transition-all hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? "Sending…" : "Email me a sign-in link"}
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-text-faint">
            <span className="h-px flex-1 bg-line" />
            <span>or continue with</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => signInWith("web3")} disabled={!configured || Boolean(methodBusy) || busy} className="rounded-2xl border border-line px-3 py-3 text-sm font-medium text-text transition-colors hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-60">
              {methodBusy === "web3" ? "Waiting…" : "Web3 wallet"}
            </button>
            <button type="button" onClick={() => signInWith("passkey")} disabled={!configured || Boolean(methodBusy) || busy} className="rounded-2xl border border-line px-3 py-3 text-sm font-medium text-text transition-colors hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-60">
              {methodBusy === "passkey" ? "Waiting…" : "Passkey"}
            </button>
          </div>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-text-faint">Wallet sign-in uses SIWE. Passkey sign-in requires a passkey already registered to your Supabase account.</p>

          {sent && <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs leading-relaxed text-emerald-300">Check your inbox for the secure sign-in link.</p>}
          {error && <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs leading-relaxed text-rose-300">{error}</p>}
          {!configured && <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">Supabase Auth is not configured in the dashboard environment yet.</p>}

          <Link href="/app" className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-line px-6 py-3.5 text-sm font-medium text-text transition-colors hover:border-line-strong">View the live demo <ArrowRight size={15} /></Link>
          <p className="mt-8 text-center text-xs leading-relaxed text-text-faint">Circle DCW manages agent wallets server-side. Your account and workspace identity are handled by Supabase.</p>
        </div>
      </div>
    </main>
  );
}
