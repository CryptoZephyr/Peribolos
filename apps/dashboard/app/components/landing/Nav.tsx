import Link from "next/link";

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
        <Link href="/" className="text-[15px] font-medium tracking-tight text-text">
          Peribolos
        </Link>
        <nav className="flex items-center gap-6">
          <a
            href="#how"
            className="hidden text-sm text-text-muted transition-colors hover:text-text sm:inline"
          >
            How it works
          </a>
          <Link
            href="/docs"
            className="hidden text-sm text-text-muted transition-colors hover:text-text sm:inline"
          >
            Docs
          </Link>
          <Link
            href="/login"
            className="rounded-[12px] bg-accent px-4 py-2 text-sm font-medium text-surface transition-opacity hover:opacity-90"
          >
            Open app
          </Link>
        </nav>
      </div>
    </header>
  );
}
