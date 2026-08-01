"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "@/app/auth/SupabaseAuthProvider";

const API_KEY_STORAGE = "peribolos.apiKey.v1";

export function AppAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { loading, session } = useSupabaseAuth();
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setApiKey(window.localStorage.getItem(API_KEY_STORAGE));
    const clearInvalid = () => {
      window.localStorage.removeItem(API_KEY_STORAGE);
      sync();
    };
    sync();
    window.addEventListener("peribolos-api-key-changed", sync);
    window.addEventListener("peribolos-api-key-invalid", clearInvalid);
    return () => {
      window.removeEventListener("peribolos-api-key-changed", sync);
      window.removeEventListener("peribolos-api-key-invalid", clearInvalid);
    };
  }, []);

  useEffect(() => {
    if (!loading && !session && !apiKey) router.replace("/login");
  }, [loading, session, apiKey, router]);

  if (loading || (!session && !apiKey)) {
    return <div className="flex min-h-[40vh] items-center justify-center text-sm text-text-muted">Checking your Peribolos session…</div>;
  }

  return <>{children}</>;
}
