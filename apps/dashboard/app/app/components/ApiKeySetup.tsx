"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "peribolos.apiKey.v1";

export function ApiKeySetup() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    const sync = () => {
      const saved = Boolean(window.localStorage.getItem(STORAGE_KEY));
      setConfigured(saved);
    };
    sync();
    window.addEventListener("peribolos-api-key-changed", sync);
    return () => window.removeEventListener("peribolos-api-key-changed", sync);
  }, []);

  function save() {
    const trimmed = value.trim();
    if (!trimmed.startsWith("pb_live_") || trimmed.length < 20) return;
    window.localStorage.setItem(STORAGE_KEY, trimmed);
    window.dispatchEvent(new Event("peribolos-api-key-changed"));
    setValue("");
    setOpen(false);
    window.location.reload();
  }

  function clear() {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("peribolos-api-key-changed"));
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              configured
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
            : "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
        }`}
      >
        {configured ? "API key set" : "Set API key"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center sm:p-6">
          <div className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-line bg-surface-raised p-5 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:p-6">
            <h2 className="text-base font-semibold text-text">Connect management API</h2>
            <p className="mt-2 text-xs leading-relaxed text-text-muted">
              Paste the <code>pb_live_...</code> key shown once when you provision an agent. It stays in this browser only.
            </p>
            <input
              type="password"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="pb_live_..."
              autoFocus
              className="mt-4 w-full rounded-md border border-line bg-surface px-3 py-2 text-xs font-mono text-text outline-none focus:border-accent"
            />
            <div className="mt-5 flex items-center justify-between gap-3">
              <button type="button" onClick={clear} className="text-xs text-text-muted hover:text-text">
                Clear saved key
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-line px-3 py-2 text-xs text-text-muted hover:text-text">
                  Cancel
                </button>
                <button type="button" onClick={save} disabled={!value.trim().startsWith("pb_live_")} className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-surface disabled:cursor-not-allowed disabled:opacity-50">
                  Save key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
