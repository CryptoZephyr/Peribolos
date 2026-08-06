"use client";

import { memo, useState } from "react";
import { addressUrl, txUrl } from "@/lib/chain";

export const ExplorerBadge = memo(function ExplorerBadge({
  type,
  hashOrAddress,
  label,
}: {
  type: "tx" | "address";
  hashOrAddress: string;
  label?: string;
}) {
  const url = type === "tx" ? txUrl(hashOrAddress) : addressUrl(hashOrAddress);
  const truncated =
    hashOrAddress.length > 16
      ? `${hashOrAddress.substring(0, 6)}...${hashOrAddress.substring(hashOrAddress.length - 4)}`
      : hashOrAddress;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded border border-accent/20 bg-accent/10 px-2 py-0.5 font-mono text-[10px] font-medium text-accent transition-colors hover:border-accent/40 hover:bg-accent/20"
      title={`View ${type === "tx" ? "transaction" : "address"} on Arcscan`}
    >
      <span>{label || truncated}</span>
      <span className="text-[9px]">↗</span>
    </a>
  );
});

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("failed");
      setTimeout(() => setCopyState("idle"), 2500);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-text-muted hover:text-text hover:bg-surface-raised transition-colors"
      title={copyState === "failed" ? "Clipboard access failed. Copy the value manually." : "Copy to clipboard"}
    >
      <span>{copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : label}</span>
    </button>
  );
}
