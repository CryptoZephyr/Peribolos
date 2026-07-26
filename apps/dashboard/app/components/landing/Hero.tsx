import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { HeroCanvas } from "./HeroCanvas";

export function Hero() {
  return (
    <section className="relative isolate flex min-h-[90dvh] items-center overflow-hidden">
      {/* Three.js perimeter-wall scene */}
      <HeroCanvas />

      {/* Legibility scrims: darken the left for text, fade the base into the page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, var(--color-surface) 0%, rgba(11,11,13,0.72) 38%, rgba(11,11,13,0.1) 70%, transparent 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style={{ background: "linear-gradient(180deg, transparent, var(--color-surface))" }}
      />

      <div className="relative mx-auto w-full max-w-[1200px] px-6 pt-16">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-raised/70 px-3 py-1 text-xs font-medium text-text-muted backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Live on Arc testnet
          </span>

          <h1 className="mt-6 text-4xl font-medium leading-[1.1] tracking-tight text-text sm:text-6xl">
            AI agents can be talked into anything.
            <br />
            Your vault can&rsquo;t.
          </h1>

          <p className="mt-6 max-w-md text-lg leading-relaxed text-text-muted">
            Prompt injection can fool the model. It cannot cross a spending rule
            enforced on-chain.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="group flex items-center gap-2 rounded-[12px] bg-accent px-6 py-3 text-sm font-medium text-surface transition-all hover:bg-accent-deep active:scale-[0.99]"
            >
              Open app
              <ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#how"
              className="rounded-[12px] border border-line bg-surface-raised/40 px-6 py-3 text-sm font-medium text-text backdrop-blur transition-colors hover:border-line-strong"
            >
              How it works
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
