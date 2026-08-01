"use client";

/**
 * Owner transaction session.
 *
 * Supabase owns identity (email, Web3, and passkey login). A connected
 * browser wallet owns on-chain approval. Circle DCW remains server-side for
 * agent wallets; Modular Wallets are intentionally not part of this runtime.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Abi, Address, Hex } from "viem";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSendTransaction,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { publicClient, CHAIN_ID } from "@/lib/chain";
import { useSupabaseAuth } from "@/app/auth/SupabaseAuthProvider";

const STORAGE_KEY = "peribolos.session.v1";

export type SignInMethod = "wallet";

interface PersistedSession {
  method: SignInMethod;
  address: Address;
}

export interface WriteVaultArgs {
  address: Address;
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}

interface SessionValue {
  address: Address | undefined;
  method: SignInMethod | null;
  isConnected: boolean;
  connectWallet: () => void;
  walletConnecting: boolean;
  disconnect: () => void;
  writeVault: (args: WriteVaultArgs) => Promise<Hex>;
  sendNative: (to: Address, value: bigint) => Promise<Hex>;
}

const SessionContext = createContext<SessionValue | null>(null);

function loadPersisted(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    return parsed?.method === "wallet" && parsed.address ? parsed : null;
  } catch {
    return null;
  }
}

function persist(session: PersistedSession | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage is optional; the wallet remains authoritative.
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const { user } = useSupabaseAuth();
  const { address: walletAddress, isConnected: walletConnected } = useAccount();
  const { connect, connectors, isPending: walletConnecting } = useConnect();
  const { disconnect: disconnectWallet } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Reading persisted identity keeps hydration deterministic; wagmi remains
    // the source of truth for whether a wallet can actually sign.
    loadPersisted();
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (walletConnected && walletAddress) persist({ method: "wallet", address: walletAddress });
    else if (loadPersisted()) persist(null);
  }, [hydrated, walletConnected, walletAddress]);

  const connectWallet = useCallback(() => {
    const connector = connectors[0];
    if (connector) connect({ connector });
  }, [connect, connectors]);

  const disconnect = useCallback(() => {
    if (walletConnected) disconnectWallet();
    persist(null);
  }, [walletConnected, disconnectWallet]);

  const writeVault = useCallback(async (w: WriteVaultArgs): Promise<Hex> => {
    if (!user) throw new Error("Sign in to Peribolos before approving an owner action.");
    if (!walletConnected) throw new Error("Connect your owner wallet before approving an on-chain action.");
    await switchChainAsync({ chainId: CHAIN_ID }).catch(() => {
      throw new Error("Switch your wallet to Arc testnet to continue.");
    });
    const hash = await writeContractAsync({
      address: w.address,
      abi: w.abi as Abi,
      functionName: w.functionName,
      args: (w.args ?? []) as never,
      value: w.value,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }, [user, walletConnected, switchChainAsync, writeContractAsync]);

  const sendNative = useCallback(async (to: Address, value: bigint): Promise<Hex> => {
    if (!user) throw new Error("Sign in to Peribolos before funding a vault.");
    if (!walletConnected) throw new Error("Connect your owner wallet before funding a vault.");
    await switchChainAsync({ chainId: CHAIN_ID }).catch(() => {
      throw new Error("Switch your wallet to Arc testnet to continue.");
    });
    const hash = await sendTransactionAsync({ to, value });
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }, [user, walletConnected, switchChainAsync, sendTransactionAsync]);

  const value = useMemo<SessionValue>(() => ({
    address: hydrated && walletConnected ? walletAddress : undefined,
    method: hydrated && walletConnected ? "wallet" : null,
    isConnected: hydrated && walletConnected,
    connectWallet,
    walletConnecting,
    disconnect,
    writeVault,
    sendNative,
  }), [hydrated, walletConnected, walletAddress, connectWallet, walletConnecting, disconnect, writeVault, sendNative]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within <SessionProvider>");
  return ctx;
}
