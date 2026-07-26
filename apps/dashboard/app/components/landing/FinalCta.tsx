import Link from "next/link";
import { Reveal } from "./Reveal";

export function FinalCta() {
  return (
    <section className="border-t border-line px-6 py-24 sm:py-32">
      <Reveal className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-8 rounded-[12px] border border-line bg-surface-raised p-10 sm:flex-row sm:items-center sm:p-14">
        <h2 className="max-w-lg text-2xl font-medium leading-tight tracking-tight text-text sm:text-3xl">
          Give your agent a wall it can&rsquo;t talk its way through.
        </h2>
        <Link
          href="/login"
          className="shrink-0 rounded-[12px] bg-accent px-6 py-3 text-sm font-medium text-surface transition-opacity hover:opacity-90"
        >
          Open app
        </Link>
      </Reveal>
    </section>
  );
}
