"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) {
        setError("Supabase Auth is not configured.");
        return;
      }
      const code = searchParams.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (active) setError(exchangeError.message);
          return;
        }
      }
      router.replace("/app");
    })();
    return () => { active = false; };
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <p className="text-sm text-text-muted">{error ? `Unable to complete sign-in: ${error}` : "Completing sign-in…"}</p>
    </main>
  );
}
