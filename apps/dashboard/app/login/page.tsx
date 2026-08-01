"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck } from "@phosphor-icons/react";
import { useSupabaseAuth } from "@/app/auth/SupabaseAuthProvider";
import { PeribolosLogo } from "@/app/components/PeribolosLogo";
import Image from "next/image";
import PeribolosArtwork from "../../../../Peribolos_redesign/Peribolos_logo.png";

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
    <main className="min-h-[100dvh] bg-[#edf0f2] p-3 sm:p-6 lg:p-8">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-[1360px] flex-col overflow-hidden rounded-[26px] border border-white/80 bg-surface-raised shadow-[0_24px_80px_rgba(16,24,40,0.12)] lg:min-h-[calc(100dvh-4rem)] lg:flex-row">
        <section className="relative hidden min-h-[460px] overflow-hidden bg-[#f0faf5] lg:flex lg:w-[54%] lg:flex-col lg:justify-between lg:p-10 xl:p-14">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: "radial-gradient(rgba(4,120,87,0.18) 1px, transparent 1px)", backgroundSize: "18px 18px", maskImage: "radial-gradient(ellipse at center, black, transparent 72%)" }} />
          <div className="relative z-10"><PeribolosLogo size={29} showBadge={false} /></div>
          <Image src={PeribolosArtwork} alt="Peribolos brand mark" priority sizes="54vw" className="absolute inset-0 z-[1] m-auto h-[58%] w-[58%] object-contain mix-blend-multiply" />
          <div className="absolute left-[13%] right-[9%] top-[37%] z-20 rounded-2xl border border-white/80 bg-white/90 p-4 shadow-[0_18px_42px_rgba(16,24,40,0.14)] backdrop-blur sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-text">Arc wallet policy</p>
                <p className="mt-1 text-[11px] text-text-faint">vault_01 · USDC controls</p>
              </div>
              <span className="rounded-md bg-accent-tint px-2 py-1 text-[10px] font-semibold text-accent">Enforced</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-[11px]">
              <span><strong className="block text-sm font-semibold text-text">$500</strong><span className="text-text-faint">daily cap</span></span>
              <span><strong className="block text-sm font-semibold text-text">18</strong><span className="text-text-faint">allowlisted</span></span>
              <span><strong className="block text-sm font-semibold text-blocked">12</strong><span className="text-text-faint">blocked</span></span>
            </div>
          </div>
          <div className="relative z-10 max-w-md">
            <span className="inline-flex items-center gap-2 rounded-md border border-accent/20 bg-white/85 px-3 py-1.5 text-xs font-semibold text-accent"><ShieldCheck size={14} weight="bold" /> Contract-enforced safety</span>
            <h2 className="mt-5 text-4xl font-semibold leading-[0.98] tracking-[-0.055em] text-text xl:text-5xl">A spending wall your agent cannot talk through.</h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-text-muted">Create vaults, set policy, and review every payment from one calm workspace.</p>
          </div>
        </section>

        <section className="flex flex-1 flex-col px-6 py-7 sm:px-12 sm:py-10 lg:max-w-[590px] lg:justify-center lg:px-16 xl:px-20">
          <header className="flex items-center justify-between lg:hidden">
            <Link href="/" aria-label="Peribolos home"><PeribolosLogo size={26} showBadge={false} /></Link>
            <Link href="/" className="text-sm text-text-muted hover:text-text">Back home</Link>
          </header>

          <div className="mt-12 max-w-[410px] lg:mt-0">
            <p className="eyebrow text-accent">Arc testnet workspace</p>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent/20 bg-accent-tint"><ShieldCheck size={20} weight="bold" className="text-accent" /></div>
            <h1 className="mt-6 text-3xl font-semibold tracking-[-0.045em] text-text">Sign in to Peribolos</h1>
            <p className="mt-3 text-sm leading-6 text-text-muted">Use your email to access your workspace. Owner wallet approval is requested only when an on-chain vault action needs it.</p>
          </div>

          <form onSubmit={submit} className="mt-8 max-w-[410px] space-y-3">
            <label htmlFor="email" className="block text-xs font-semibold text-text">Work email</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" disabled={!configured || busy} className="w-full rounded-xl border border-line bg-white px-4 py-3.5 text-sm text-text outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 disabled:opacity-60" />
            <button type="submit" disabled={!configured || busy || loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-text px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? "Sending…" : "Email me a sign-in link"}
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>

          <div className="my-5 flex max-w-[410px] items-center gap-3 text-[11px] uppercase tracking-wider text-text-faint">
            <span className="h-px flex-1 bg-line" />
            <span>or continue with</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="grid max-w-[410px] grid-cols-2 gap-3">
            <button type="button" onClick={() => signInWith("web3")} disabled={!configured || Boolean(methodBusy) || busy} className="rounded-xl border border-line bg-white px-3 py-3 text-sm font-medium text-text hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-60">
              {methodBusy === "web3" ? "Waiting…" : "Web3 wallet"}
            </button>
            <button type="button" onClick={() => signInWith("passkey")} disabled={!configured || Boolean(methodBusy) || busy} className="rounded-xl border border-line bg-white px-3 py-3 text-sm font-medium text-text hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-60">
              {methodBusy === "passkey" ? "Waiting…" : "Passkey"}
            </button>
          </div>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-text-faint">Wallet sign-in uses SIWE. Passkey sign-in requires a passkey already registered to your Supabase account.</p>

          {sent && <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs leading-relaxed text-emerald-300">Check your inbox for the secure sign-in link.</p>}
          {error && <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs leading-relaxed text-rose-300">{error}</p>}
          {!configured && <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">Supabase Auth is not configured in the dashboard environment yet.</p>}

          <Link href="/app?demo=1" className="mt-4 flex max-w-[410px] items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-6 py-3.5 text-sm font-medium text-text hover:border-line-strong">View the live demo <ArrowRight size={15} /></Link>
          <p className="mt-8 max-w-[410px] text-center text-xs leading-relaxed text-text-faint">Circle DCW manages agent wallets server-side. Your account and workspace identity are handled by Supabase.</p>
        </section>
      </div>
    </main>
  );
}
