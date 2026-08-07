"use client";

import { useState } from "react";
import { Copy, Check } from "@phosphor-icons/react";

/**
 * Static code block with a copy button. No syntax-highlighting dependency:
 * plain monospace on the raised surface, matching the rest of the site. The
 * copy affordance is the only interactive part, so this is a small client leaf.
 */
export function CodeBlock({
  code,
  label,
}: {
  code: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable (permissions / insecure context); the code
      // is still selectable by hand, so there's nothing to fail loudly about.
    }
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-line bg-surface-raised">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <span className="font-mono text-xs text-text-faint">{label ?? "example"}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-faint transition-colors hover:text-text"
          aria-label="Copy code"
        >
          {copied ? <Check size={13} weight="bold" className="text-accent" /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-4 font-mono text-[13px] leading-relaxed text-text-muted">
        <code>{code}</code>
      </pre>
    </div>
  );
}
