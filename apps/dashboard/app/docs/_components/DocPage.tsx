import Link from "next/link";

export type TocItem = { id: string; label: string };

export function DocPage({ eyebrow, title, description, toc, children }: { eyebrow: string; title: string; description: string; toc: TocItem[]; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-[1120px] gap-12 px-5 py-12 sm:px-8 sm:py-16 xl:grid-cols-[minmax(0,720px)_190px]">
      <article className="min-w-0">
        <header className="border-b border-line pb-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-text sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-text-muted sm:text-lg">{description}</p>
        </header>
        <div className="space-y-14 pt-12">{children}</div>
        <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-7 text-xs text-text-faint">
          <span>Peribolos documentation · Arc Testnet</span>
          <div className="flex gap-4"><Link href="/privacy" className="hover:text-text">Privacy</Link><Link href="/terms" className="hover:text-text">Terms</Link></div>
        </footer>
      </article>
      <aside className="hidden xl:block">
        <div className="sticky top-28 border-l border-line pl-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-faint">On this page</p>
          <ul className="mt-3 space-y-2.5">
            {toc.map((item) => <li key={item.id}><a href={`#${item.id}`} className="text-xs leading-5 text-text-muted hover:text-accent">{item.label}</a></li>)}
          </ul>
        </div>
      </aside>
    </div>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return <section id={id} className="scroll-mt-28"><h2 className="text-2xl font-semibold tracking-[-0.03em] text-text">{title}</h2><div className="mt-4 space-y-4 text-[15px] leading-7 text-text-muted">{children}</div></section>;
}

export function Callout({ tone = "info", title, children }: { tone?: "info" | "warning" | "success"; title: string; children: React.ReactNode }) {
  const style = tone === "warning" ? "border-amber-300 bg-amber-50" : tone === "success" ? "border-emerald-300 bg-emerald-50" : "border-line-strong bg-surface-raised";
  return <div className={`rounded-xl border p-5 ${style}`}><p className="text-sm font-semibold text-text">{title}</p><div className="mt-1.5 text-sm leading-6 text-text-muted">{children}</div></div>;
}

export function Endpoint({ method, path, description }: { method: string; path: string; description: string }) {
  return <div className="grid gap-2 rounded-xl border border-line bg-surface-raised p-4 sm:grid-cols-[64px_minmax(0,1fr)]"><span className="font-mono text-xs font-bold text-accent">{method}</span><div><code className="font-mono text-sm text-text">{path}</code><p className="mt-1 text-sm leading-6 text-text-muted">{description}</p></div></div>;
}
