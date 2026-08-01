"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabase";

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  signInWithOtp: (email: string) => Promise<void>;
  signInWithWeb3: () => Promise<void>;
  signInWithPasskey: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const fallbackTimer = window.setTimeout(() => {
      if (active) setLoading(false);
    }, 2500);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .catch(() => {
        if (active) setSession(null);
      })
      .finally(() => {
        window.clearTimeout(fallbackTimer);
        if (active) setLoading(false);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => {
      active = false;
      window.clearTimeout(fallbackTimer);
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    configured: supabaseConfigured,
    loading,
    session,
    user: session?.user ?? null,
    signInWithOtp: async (email) => {
      if (!supabase) throw new Error("Supabase Auth is not configured for this dashboard.");
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    },
    signInWithWeb3: async () => {
      if (!supabase) throw new Error("Supabase Auth is not configured for this dashboard.");
      const { error } = await supabase.auth.signInWithWeb3({
        chain: "ethereum",
        statement: "Sign in to Peribolos to manage rule-enforced agent vaults.",
      });
      if (error) throw error;
    },
    signInWithPasskey: async () => {
      if (!supabase) throw new Error("Supabase Auth is not configured for this dashboard.");
      const { error } = await supabase.auth.signInWithPasskey();
      if (error) throw error;
    },
    signOut: async () => {
      if (supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }
    },
  }), [loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSupabaseAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useSupabaseAuth must be used within SupabaseAuthProvider");
  return value;
}
