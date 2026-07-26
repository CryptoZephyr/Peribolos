"use client";

/**
 * Unified owner session for the Peribolos app.
 *
 * Two ways to sign in, one identity downstream:
 *   - wallet  : an injected wallet (MetaMask) via wagmi.
 *   - passkey : a Circle Smart Account (ERC-4337) on Arc testnet whose signer
 *               is a device passkey, via @circle-fin/modular-wallets-core.
 *
 * Everything in the app reads `useSession()` instead of wagmi's useAccount, so
 * owner actions (create domain, pause, sweep) work the same regardless of how
 * the owner signed in. `writeVault()` routes the write to the right signer:
 * a normal transaction for wallets, a gasless UserOperation for passkeys.
 *
 * Persistence & privacy: we persist ONLY the public identity (method, address,
 * display name) to localStorage so a reload keeps you signed in and can show
 * your vaults immediately. No private key or passkey secret is ever stored —
 * passkeys live in the device secure enclave, wallets hold their own keys, and
 * the record of which vaults you own lives on-chain. Consistent with the whole
 * product: there is no backend and no user database to breach.
 *
 * Passkey writes need a live in-memory signer. If a reload cleared it, the
 * first write transparently re-runs the passkey ceremony (a biometric prompt)
 * to rehydrate the smart account, then proceeds.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { encodeFunctionData, type Abi, type Address, type Hex } from "viem";
import { arcTestnet } from "@peribolos/core";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { publicClient, CHAIN_ID } from "@/lib/chain";

const CLIENT_KEY = process.env.NEXT_PUBLIC_CIRCLE_CLIENT_KEY;
const CLIENT_URL = process.env.NEXT_PUBLIC_CIRCLE_CLIENT_URL;
const STORAGE_KEY = "peribolos.session.v1";

export const PASSKEY_CONFIGURED = Boolean(CLIENT_KEY && CLIENT_URL);

export type SignInMethod = "wallet" | "passkey";

interface PersistedSession {
  method: SignInMethod;
  address: Address;
  username?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SmartAccount = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BundlerClient = any;

interface PasskeyState {
  address: Address;
  username: string;
  smartAccount: SmartAccount | null; // null after a reload until rehydrated
  bundler: BundlerClient | null;
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
  username?: string;
  isConnected: boolean;
  passkeyConfigured: boolean;
  passkeyBusy: null | "register" | "login";
  connectWallet: () => void;
  walletConnecting: boolean;
  signInWithPasskey: (mode: "register" | "login", username: string) => Promise<void>;
  disconnect: () => void;
  writeVault: (args: WriteVaultArgs) => Promise<Hex>;
}

const SessionContext = createContext<SessionValue | null>(null);

function loadPersisted(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    if (parsed && (parsed.method === "wallet" || parsed.method === "passkey") && parsed.address) {
      return parsed;
    }
  } catch {
    // corrupt/absent storage is simply "no session".
  }
  return null;
}

function persist(session: PersistedSession | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage can be unavailable (private mode); session just won't persist.
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const { address: walletAddress, isConnected: walletConnected } = useAccount();
  const { connect, connectors, isPending: walletConnecting } = useConnect();
  const { disconnect: disconnectWallet } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [passkey, setPasskey] = useState<PasskeyState | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState<null | "register" | "login">(null);
  const [hydrated, setHydrated] = useState(false);

  // Restore a persisted passkey identity (read-only until a write rehydrates it).
  useEffect(() => {
    const p = loadPersisted();
    if (p?.method === "passkey") {
      setPasskey({ address: p.address, username: p.username ?? "peribolos-owner", smartAccount: null, bundler: null });
    }
    setHydrated(true);
  }, []);

  // Keep persistence in sync with the live wallet connection.
  useEffect(() => {
    if (!hydrated) return;
    if (passkey) return; // passkey persistence handled at sign-in
    if (walletConnected && walletAddress) {
      persist({ method: "wallet", address: walletAddress });
    } else {
      const p = loadPersisted();
      if (p?.method === "wallet") persist(null);
    }
  }, [hydrated, walletConnected, walletAddress, passkey]);

  const connectWallet = useCallback(() => {
    const connector = connectors[0];
    if (connector) connect({ connector });
  }, [connect, connectors]);

  const buildPasskey = useCallback(
    async (mode: "register" | "login", username: string): Promise<PasskeyState> => {
      const [
        { toPasskeyTransport, toWebAuthnCredential, toModularTransport, toCircleSmartAccount, WebAuthnMode },
        { toWebAuthnAccount, createBundlerClient },
        { createPublicClient },
      ] = await Promise.all([
        import("@circle-fin/modular-wallets-core"),
        import("viem/account-abstraction"),
        import("viem"),
      ]);

      const passkeyTransport = toPasskeyTransport(CLIENT_URL as string, CLIENT_KEY as string);
      const credential = await toWebAuthnCredential({
        transport: passkeyTransport,
        mode: mode === "register" ? WebAuthnMode.Register : WebAuthnMode.Login,
        username: username.trim() || "peribolos-owner",
      });

      const modularTransport = toModularTransport(`${CLIENT_URL}/arcTestnet`, CLIENT_KEY as string);
      const client = createPublicClient({ chain: arcTestnet, transport: modularTransport });

      const smartAccount = await toCircleSmartAccount({
        client,
        owner: toWebAuthnAccount({ credential }),
      });
      const bundler = createBundlerClient({
        account: smartAccount,
        chain: arcTestnet,
        transport: modularTransport,
      });

      return {
        address: smartAccount.address as Address,
        username: username.trim() || "peribolos-owner",
        smartAccount,
        bundler,
      };
    },
    [],
  );

  const signInWithPasskey = useCallback(
    async (mode: "register" | "login", username: string) => {
      setPasskeyBusy(mode);
      try {
        const next = await buildPasskey(mode, username);
        setPasskey(next);
        persist({ method: "passkey", address: next.address, username: next.username });
        // A passkey identity supersedes any wallet connection for owner actions.
        if (walletConnected) disconnectWallet();
      } finally {
        setPasskeyBusy(null);
      }
    },
    [buildPasskey, walletConnected, disconnectWallet],
  );

  const disconnect = useCallback(() => {
    if (passkey) setPasskey(null);
    if (walletConnected) disconnectWallet();
    persist(null);
  }, [passkey, walletConnected, disconnectWallet]);

  const writeVault = useCallback(
    async (w: WriteVaultArgs): Promise<Hex> => {
      // Passkey path: gasless UserOperation via the Circle bundler.
      if (passkey) {
        let live = passkey;
        if (!live.bundler || !live.smartAccount) {
          // Signer was cleared (reload) — rehydrate with a passkey login prompt.
          live = await buildPasskey("login", passkey.username);
          setPasskey(live);
        }
        const data = encodeFunctionData({
          abi: w.abi as Abi,
          functionName: w.functionName,
          args: (w.args ?? []) as never,
        });
        const uoHash = await live.bundler.sendUserOperation({
          account: live.smartAccount,
          calls: [{ to: w.address, value: w.value ?? 0n, data }],
        });
        const rc = await live.bundler.waitForUserOperationReceipt({ hash: uoHash });
        return (rc?.receipt?.transactionHash ?? uoHash) as Hex;
      }

      // Wallet path: a normal transaction on Arc testnet.
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
    },
    [passkey, buildPasskey, switchChainAsync, writeContractAsync],
  );

  const value = useMemo<SessionValue>(() => {
    const base = {
      passkeyConfigured: PASSKEY_CONFIGURED,
      passkeyBusy,
      connectWallet,
      walletConnecting,
      signInWithPasskey,
      disconnect,
      writeVault,
    };
    // Until mounted, report "signed out" so the first client render matches the
    // statically prerendered HTML (which has no wallet/localStorage). This avoids
    // a React hydration mismatch; the real identity appears once `hydrated` flips.
    if (!hydrated) {
      return { ...base, address: undefined, method: null, username: undefined, isConnected: false };
    }
    if (passkey) {
      return { ...base, address: passkey.address, method: "passkey", username: passkey.username, isConnected: true };
    }
    return {
      ...base,
      address: walletConnected ? walletAddress : undefined,
      method: walletConnected ? "wallet" : null,
      username: undefined,
      isConnected: walletConnected,
    };
  }, [hydrated, passkey, passkeyBusy, walletConnected, walletAddress, connectWallet, walletConnecting, signInWithPasskey, disconnect, writeVault]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within <SessionProvider>");
  return ctx;
}
