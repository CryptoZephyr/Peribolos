"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toast: (item: Omit<ToastItem, "id">) => void;
  success: (title: string, description?: string, action?: ToastItem["action"]) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string, action?: ToastItem["action"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (item: Omit<ToastItem, "id">) => {
      const id = `toast_${Math.random().toString(36).substring(2, 9)}`;
      const toastItem: ToastItem = { ...item, id };
      setToasts((prev) => [...prev.slice(-4), toastItem]);

      setTimeout(() => {
        removeToast(id);
      }, 5000);
    },
    [removeToast]
  );

  const success = useCallback(
    (title: string, description?: string, action?: ToastItem["action"]) =>
      addToast({ type: "success", title, description, action }),
    [addToast]
  );

  const error = useCallback(
    (title: string, description?: string) =>
      addToast({ type: "error", title, description }),
    [addToast]
  );

  const info = useCallback(
    (title: string, description?: string, action?: ToastItem["action"]) =>
      addToast({ type: "info", title, description, action }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ toast: addToast, success, error, info }}>
      {children}
      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 ${
              t.type === "success"
                ? "border-emerald-500/30 bg-surface-raised/95 text-emerald-400"
                : t.type === "error"
                ? "border-rose-500/30 bg-surface-raised/95 text-rose-400"
                : t.type === "warning"
                ? "border-amber-500/30 bg-surface-raised/95 text-amber-400"
                : "border-accent/30 bg-surface-raised/95 text-accent"
            }`}
          >
            <div className="mt-0.5 shrink-0 text-base">
              {t.type === "success" && "✓"}
              {t.type === "error" && "✕"}
              {t.type === "warning" && "⚠️"}
              {t.type === "info" && "ℹ"}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-text">{t.title}</h4>
              {t.description && (
                <p className="mt-0.5 text-[11px] text-text-muted leading-relaxed break-words">{t.description}</p>
              )}
              {t.action && (
                <button
                  onClick={t.action.onClick}
                  className="mt-2 text-[11px] font-bold text-accent hover:underline flex items-center gap-1"
                >
                  {t.action.label} →
                </button>
              )}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 text-text-muted hover:text-text text-xs p-1"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx;
}
