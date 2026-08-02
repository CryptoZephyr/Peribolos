"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ShieldCheck,
  Check,
  Wallet,
  Key,
  EnvelopeSimple,
  Globe,
  LockKey,
  Sparkle,
} from "@phosphor-icons/react";
import { useSupabaseAuth } from "@/app/auth/SupabaseAuthProvider";
import { PeribolosLogo } from "@/app/components/PeribolosLogo";

export default function LoginPage() {
  const router = useRouter();
  const { configured, loading, session, signInWithOtp, signInWithWeb3, signInWithPasskey } = useSupabaseAuth();

  // Mode and form states
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [subscribeUpdates, setSubscribeUpdates] = useState(true);
  const [walletAvailable, setWalletAvailable] = useState<boolean | null>(null);
  const [passkeyAvailable, setPasskeyAvailable] = useState<boolean | null>(null);

  // Status states
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [methodBusy, setMethodBusy] = useState<"web3" | "passkey" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Left panel interactive preview tab state (inspired by reference image widget)
  const [activePreviewTab, setActivePreviewTab] = useState<"firewall" | "usdc">("firewall");

  useEffect(() => {
    if (session) router.replace("/app");
  }, [router, session]);

  useEffect(() => {
    setWalletAvailable("ethereum" in window);
    setPasskeyAvailable(typeof window.PublicKeyCredential !== "undefined" && Boolean(navigator.credentials));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSent(false);
    const value = email.trim().toLowerCase();
    if (!value || !value.includes("@")) {
      setError("Please enter a valid work email address.");
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
    if (method === "web3" && walletAvailable === false) {
      setError("No Ethereum wallet detected. Open Peribolos in a browser with MetaMask, Rabby, or another injected wallet.");
      return;
    }
    if (method === "passkey" && passkeyAvailable === false) {
      setError("Passkeys are not available in this browser. Use a secure, passkey-capable browser on a device with Windows Hello, Touch ID, or another passkey manager.");
      return;
    }
    setMethodBusy(method);
    try {
      if (method === "web3") await signInWithWeb3();
      else await signInWithPasskey();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to complete sign-in.";
      setError(
        message.includes("webauthn_credential_not_found") || message.toLowerCase().includes("no passkey")
          ? "No passkey is registered for this account yet. Sign in with email first, then register this device from Settings."
          : message,
      );
    } finally {
      setMethodBusy(null);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-[#eef0f3] p-4 sm:p-6 lg:p-10 flex items-center justify-center font-sans antialiased">
      {/* Main Split-Card Container */}
      <div className="w-full max-w-[1140px] bg-white rounded-[32px] overflow-hidden border border-slate-200/80 shadow-[0_24px_70px_rgba(15,23,42,0.08)] grid grid-cols-1 lg:grid-cols-12 min-h-[680px]">
        
        {/* LEFT PANEL - Visual Showcase & Interactive Policy Card (Matching reference design) */}
        <section className="relative hidden lg:flex lg:col-span-6 flex-col justify-between bg-[#f5f7fa] p-10 xl:p-12 border-r border-slate-100/90 overflow-hidden select-none">
          {/* Top brand bar */}
          <div className="relative z-10 flex items-center justify-between">
            <PeribolosLogo size={30} showBadge={false} />
            <span className="text-[11px] font-semibold tracking-[0.08em] text-slate-500">ARC TESTNET</span>
          </div>

          {/* CENTER FLOATING CARD (Directly mirroring the voice aura interactive widget) */}
          <div className="relative z-10 mx-auto my-auto w-full max-w-[430px] rounded-2xl border border-slate-200/70 bg-white/95 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-md">
            {/* Widget Header Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-100 pb-3">
              <button
                type="button"
                onClick={() => setActivePreviewTab("firewall")}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activePreviewTab === "firewall"
                    ? "bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-200/50"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                <ShieldCheck size={14} weight="bold" />
                Agent Firewall
              </button>

              <button
                type="button"
                onClick={() => setActivePreviewTab("usdc")}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activePreviewTab === "usdc"
                    ? "bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-200/50"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                <Wallet size={14} weight="bold" />
                USDC Policy
              </button>
            </div>

            {/* Tab Description Body */}
            <p className="mt-3.5 text-xs leading-relaxed text-slate-600">
              {activePreviewTab === "firewall"
                ? "Unlock zero-trust security for autonomous AI agents. Enforce daily spending limits, allowlisted contracts, and instant payment validation."
                : "Non-custodial smart vault policies powered by Circle DCW. Prevent unauthorized agent drains before transactions hit the mempool."}
            </p>

            {/* Interactive Category Chips / Pills */}
            <div className="mt-4 flex flex-wrap items-center gap-1.5 pt-1">
              {activePreviewTab === "firewall" ? (
                <>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                    <Globe size={12} className="text-emerald-600" /> Arc Testnet
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                    <ShieldCheck size={12} className="text-emerald-600" /> $500/day Cap
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                    <LockKey size={12} className="text-emerald-600" /> 18 Allowlisted
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    <Check size={12} weight="bold" /> Enforced
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                    <Wallet size={12} className="text-emerald-600" /> Circle DCW
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                    <Sparkle size={12} className="text-emerald-600" /> Smart Vault
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700">
                    12 Blocked
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    <Check size={12} weight="bold" /> Vault V2
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Bottom Left Headline & Subtext */}
          <div className="relative z-10 max-w-md pt-6">
            <h2 className="font-serif text-3xl font-normal tracking-tight text-slate-900 xl:text-4xl leading-[1.18]">
              One Click Away from Studio-Grade Security
            </h2>
            <p className="mt-2.5 text-xs sm:text-sm text-slate-500 leading-relaxed">
              A spending wall your autonomous AI agents cannot pass without explicit contract policy validation.
            </p>
          </div>
        </section>

        {/* RIGHT PANEL - Clean Sign In / Register Form Panel */}
        <section className="col-span-1 lg:col-span-6 p-8 sm:p-12 xl:p-14 flex flex-col justify-between bg-white">
          
          {/* Mobile Header */}
          <header className="flex items-center justify-between lg:hidden mb-8">
            <Link href="/" aria-label="Peribolos home">
              <PeribolosLogo size={28} showBadge={false} />
            </Link>
            <Link href="/" className="text-xs font-medium text-slate-500 hover:text-slate-900">
              Back home
            </Link>
          </header>

          <div className="max-w-[400px] w-full mx-auto my-auto">
            {/* Form Header Title */}
            <div>
              <h1 className="font-serif text-3xl sm:text-3xl font-medium tracking-tight text-slate-900">
                {mode === "signup" ? "Create an Account" : "Welcome Back"}
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed">
                {mode === "signup"
                  ? "You are a few moments away from getting started!"
                  : "Sign in to access your Peribolos agent vault workspace."}
              </p>
            </div>

            {/* Security updates checkbox (matching reference design) */}
            <div className="mt-5 flex items-start gap-2.5">
              <input
                id="subscribe-updates"
                type="checkbox"
                checked={subscribeUpdates}
                onChange={(e) => setSubscribeUpdates(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <label htmlFor="subscribe-updates" className="text-xs text-slate-600 select-none cursor-pointer">
                Send me security tips, updates and policy advisories
              </label>
            </div>

            {/* Main Auth Form */}
            <form onSubmit={submit} className="mt-6 space-y-4">
              {/* Email Input */}
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Work email
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter your email"
                    disabled={!configured || busy}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-60"
                  />
                  <EnvelopeSimple size={18} className="absolute right-3.5 top-3.5 text-slate-400 pointer-events-none" />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                  We&apos;ll send a secure sign-in link. No password to remember.
                </p>
              </div>

              {/* Terms of Service Disclaimer */}
              <p className="text-[11px] leading-relaxed text-slate-500 pt-1">
                {mode === "signup" ? "By creating an account, you accept Peribolos " : "By continuing, you accept Peribolos "}
                <Link href="/docs" className="font-semibold text-slate-800 underline underline-offset-2">
                  privacy policy
                </Link>{" "}
                and{" "}
                <Link href="/docs" className="font-semibold text-slate-800 underline underline-offset-2">
                  terms of service
                </Link>
                .
              </p>

              {/* Primary CTA Button */}
              <button
                type="submit"
                disabled={!configured || busy || loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-950 py-3.5 px-6 text-sm font-semibold text-white shadow-md hover:bg-slate-800 focus:ring-2 focus:ring-slate-900 transition-all disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Sending secure link..." : "Continue with email"}
                {!busy && <ArrowRight size={16} weight="bold" />}
              </button>
            </form>

            {/* Divider "or" */}
            <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              <span>or</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            {/* OAuth / Web3 / Passkey Buttons (Matching reference layout) */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => signInWith("web3")}
                disabled={!configured || Boolean(methodBusy) || busy || walletAvailable === false}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 px-4 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50/80 transition-all disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Wallet size={16} className="text-emerald-600" />
                {methodBusy === "web3" ? "Connecting wallet..." : walletAvailable === false ? "Wallet not detected" : "Continue with Web3 Wallet"}
              </button>

              <button
                type="button"
                onClick={() => signInWith("passkey")}
                disabled={!configured || Boolean(methodBusy) || busy || passkeyAvailable === false}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 px-4 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50/80 transition-all disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Key size={16} className="text-slate-600" />
                {methodBusy === "passkey" ? "Checking passkey..." : passkeyAvailable === false ? "Passkey unavailable" : "Continue with Passkey"}
              </button>
            </div>

            <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
              New to passkeys? Sign in with email first, then register this device from Settings.
            </p>

            {/* Already have an account? Log In toggle */}
            <p className="mt-5 text-center text-xs text-slate-500">
              {mode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signup" ? "login" : "signup");
                  setError(null);
                  setSent(false);
                }}
                className="font-semibold text-slate-900 underline underline-offset-2 hover:text-emerald-700 transition-colors"
              >
                {mode === "signup" ? "Log In" : "Sign Up"}
              </button>
            </p>

            {/* Notification messages */}
            {sent && (
              <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs leading-relaxed text-emerald-800">
                Check your inbox for the secure sign-in link.
              </p>
            )}
            {error && (
              <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs leading-relaxed text-rose-700">
                {error}
              </p>
            )}
            {!configured && (
              <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-800">
                Supabase Auth is not configured in the dashboard environment yet.
              </p>
            )}

            {/* Live Demo Link */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Want to test without signing up?</span>
              <Link
                href="/app?demo=1"
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
              >
                View Live Demo <ArrowRight size={13} weight="bold" />
              </Link>
            </div>
          </div>

          {/* Footer note */}
          <footer className="mt-8 text-center text-[11px] leading-relaxed text-slate-400">
            Circle DCW manages agent wallets server-side. Identity handled by Supabase.
          </footer>
        </section>
      </div>
    </main>
  );
}
