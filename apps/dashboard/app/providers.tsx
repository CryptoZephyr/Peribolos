"use client";

import { useState, type ReactNode } from "react";
import { WagmiProvider, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { arcTestnet } from "@peribolos/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/app/app/session";
import { ToastProvider } from "@/app/components/Toast";
import { arcTransport } from "@/lib/chain";
import { SupabaseAuthProvider } from "@/app/auth/SupabaseAuthProvider";

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: arcTransport,
  },
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 60_000,
            gcTime: 300_000,
            retry: 2,
            retryDelay: (i) => Math.min(1_000 * 2 ** i, 8_000),
          },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SupabaseAuthProvider>
          <SessionProvider>
            <ToastProvider>{children}</ToastProvider>
          </SessionProvider>
        </SupabaseAuthProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
