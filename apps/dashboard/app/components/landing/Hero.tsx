"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "@phosphor-icons/react";
import PeribolosArtwork from "../../../../../Peribolos_redesign/Peribolos_logo.png";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-surface-raised">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70" style={{ background: "radial-gradient(circle at 78% 34%, rgba(4,120,87,0.11), transparent 28%), linear-gradient(135deg, transparent 0%, rgba(4,120,87,0.035) 100%)" }} />
      <div className="relative mx-auto grid min-h-[calc(100dvh-72px)] max-w-[1240px] items-center gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-8 lg:py-14">
        <div className="relative z-10 max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-md border border-accent/20 bg-accent-tint px-3 py-1.5 text-xs font-semibold text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Live on Arc testnet
          </span>

          <h1 className="mt-6 max-w-[560px] text-5xl font-semibold leading-[0.98] tracking-[-0.06em] text-text sm:text-6xl">
            Rules agents cannot cross.
          </h1>

          <p className="mt-6 max-w-md text-base leading-7 text-text-muted sm:text-lg">
            Prompt injection can fool the model. It cannot cross a spending rule enforced on-chain.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="group flex items-center gap-2 rounded-lg bg-text px-6 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(16,24,40,0.14)] hover:bg-accent"
            >
              Start with one protected payment
              <ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#path"
              className="rounded-lg border border-line bg-surface-raised px-6 py-3.5 text-sm font-semibold text-text hover:border-line-strong hover:bg-surface"
            >
              See the path
            </a>
          </div>

          <div className="mt-12 flex flex-wrap gap-x-7 gap-y-3 border-t border-line pt-5 text-xs text-text-muted">
            <span><strong className="font-semibold text-text">On-chain</strong> policy enforcement</span>
            <span><strong className="font-semibold text-text">Budgeted</strong> agent spending</span>
          </div>
        </div>

        <figure className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-[28px] border border-line bg-[#f0faf5] shadow-[0_20px_60px_rgba(4,120,87,0.11)] sm:min-h-[540px]">
          <div aria-hidden className="absolute inset-0 opacity-80" style={{ backgroundImage: "radial-gradient(rgba(4,120,87,0.16) 1px, transparent 1px)", backgroundSize: "22px 22px", maskImage: "radial-gradient(ellipse at center, black, transparent 72%)" }} />
          <Image
            src={PeribolosArtwork}
            alt="Peribolos logo"
            priority
            sizes="(min-width: 1024px) 52vw, 100vw"
            className="relative z-10 h-auto w-[78%] max-w-[500px] mix-blend-multiply"
          />
          <div className="absolute bottom-5 left-5 right-5 z-20 rounded-2xl border border-white/70 bg-white/90 p-4 shadow-[0_14px_34px_rgba(16,24,40,0.14)] backdrop-blur sm:bottom-7 sm:left-7 sm:right-7 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-tint text-accent">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-text">Agent spend policy</p>
                  <p className="text-[11px] text-text-faint">Managed vault · Arc testnet</p>
                </div>
              </div>
              <span className="rounded-md bg-accent-tint px-2 py-1 text-[10px] font-semibold text-accent">Enforced</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-[11px]">
              <span><strong className="block text-sm font-semibold text-text">Configured</strong><span className="text-text-faint">daily policy</span></span>
              <span><strong className="block text-sm font-semibold text-text">Allowlisted</strong><span className="text-text-faint">recipients only</span></span>
              <span><strong className="block text-sm font-semibold text-blocked">Blocked</strong><span className="text-text-faint">by rules</span></span>
            </div>
          </div>
        </figure>
      </div>
    </section>
  );
}
