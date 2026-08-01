import Link from "next/link";
import { Reveal } from "./Reveal";

export function FinalCta() {
  return (
    <section className="border-t border-line px-5 py-24 sm:px-8 sm:py-32">
      <Reveal className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-8 rounded-[24px] border border-accent/20 bg-accent-tint p-10 sm:flex-row sm:items-center sm:p-14">
        <h2 className="max-w-lg text-2xl font-medium leading-tight tracking-tight text-text sm:text-3xl">
          Give your agent a wall it can&rsquo;t talk its way through.
        </h2>
        <Link
          href="/login"
          className="shrink-0 rounded-lg bg-text px-6 py-3 text-sm font-semibold text-white hover:bg-accent"
        >
          Open app
        </Link>
      </Reveal>
    </section>
  );
}
