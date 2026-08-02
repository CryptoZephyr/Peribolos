"use client";

import type { ReactNode } from "react";

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  confirmLabel = "Confirm",
  onConfirm,
  confirmVariant = "primary",
  loading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  onConfirm?: () => void;
  confirmVariant?: "primary" | "danger";
  loading?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center sm:p-6 animate-in fade-in duration-200">
      <div className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md space-y-4 overflow-y-auto rounded-xl border border-line-strong bg-surface-raised p-5 shadow-[0_28px_80px_rgba(16,24,40,0.24)] sm:max-h-[calc(100dvh-3rem)] sm:p-6">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h3 className="text-base font-bold text-text">{title}</h3>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text text-sm p-1 rounded hover:bg-surface"
          >
            ✕
          </button>
        </div>
        <div className="text-xs text-text-muted space-y-2">{children}</div>
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-line px-4 py-2 text-xs font-semibold text-text-muted hover:bg-surface hover:text-text transition-colors"
          >
            Cancel
          </button>
          {onConfirm && (
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`rounded-md px-4 py-2 text-xs font-semibold text-white transition-opacity ${
                confirmVariant === "danger"
                  ? "bg-rose-600 hover:bg-rose-500"
                  : "bg-accent hover:opacity-90"
              } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {loading ? "Processing..." : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
