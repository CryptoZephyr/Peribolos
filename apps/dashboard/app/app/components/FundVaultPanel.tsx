"use client";

/**
 * No-terminal vault funding panel.
 * On Arc Testnet, native gas is USDC — funding a vault is a native value transfer
 * to the vault address (PeribolosVault.receive accepts native USDC).
 * Owner connects wallet/passkey; no agent private key required.
 */

import { useEffect, useState } from "react";
import { parseEther, type Address, type Hex } from "viem";
import { FAUCET_URL, txUrl, shortAddress } from "@/lib/chain";
import { fetchApi } from "@/lib/api-client";
import { useSession } from "../session";
import { describeError } from "@/lib/errors";

export function FundVaultPanel({
  vaultId,
  vaultAddress,
  mode,
  onFunded,
}: {
  vaultId: string;
  vaultAddress: Address;
  mode: "offline" | "live";
  onFunded?: () => void;
}) {
  const { isConnected, connectWallet, address, sendNative } = useSession();
  const [amount, setAmount] = useState("5");
  const [error, setError] = useState<string | null>(null);
  const [recordedHash, setRecordedHash] = useState<string | null>(null);
  const [isRecorded, setIsRecorded] = useState(false);
  const [verificationFailed, setVerificationFailed] = useState(false);
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!isSuccess || !txHash || recordedHash === txHash) return;
    setRecordedHash(txHash);
    fetchApi(`/v1/vaults/${vaultId}/fund`, {
      method: "POST",
      body: JSON.stringify({
        amountUsdc: Number(amount),
        txHash,
        fromAddress: address,
      }),
    })
      .then(() => {
        setIsRecorded(true);
        setVerificationFailed(false);
        onFunded?.();
      })
      .catch((err) => {
        setIsRecorded(false);
        setVerificationFailed(true);
        setError(err instanceof Error
          ? `Transaction mined, but Peribolos could not verify it yet: ${err.message}`
          : "Transaction mined, but Peribolos could not verify it yet. Refresh after the receipt is indexed.");
      });
  }, [isSuccess, txHash, recordedHash, vaultId, amount, address, onFunded]);

  async function fund() {
    setError(null);
    if (!isConnected) {
      connectWallet();
      return;
    }
    if (mode !== "live") {
      setError("Attach a live on-chain vault address before funding (Edit Rules → live address, or Create & fund domain).");
      return;
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(vaultAddress) || vaultAddress === "0x0000000000000000000000000000000000000001") {
      setError("Vault address is not a live PeribolosVault. Create a domain or paste a live address first.");
      return;
    }
    const human = Number(amount);
    if (!(human > 0)) {
      setError("Enter a positive USDC amount.");
      return;
    }
    try {
      // Arc native USDC uses 18-decimal wei representation for msg.value
      setIsPending(true);
      const hash = await sendNative(vaultAddress, parseEther(amount));
      setTxHash(hash);
      setIsSuccess(true);
      setIsRecorded(false);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-text">Fund protected vault</h4>
        <a
          href={FAUCET_URL}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-accent hover:underline"
        >
          Get testnet USDC (faucet) ↗
        </a>
      </div>
      <p className="text-[11px] text-text-muted leading-relaxed">
        Send native Arc Testnet USDC to the vault contract. No agent private key — use your
        connected owner wallet. Mode: <span className="font-mono">{mode}</span> ·{" "}
        <span className="font-mono">{shortAddress(vaultAddress)}</span>
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[120px]">
          <label className="block text-[11px] text-text-muted mb-1">Amount (USDC)</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setTxHash(null);
              setIsSuccess(false);
              setRecordedHash(null);
              setIsRecorded(false);
              setVerificationFailed(false);
            }}
            className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-xs font-mono"
          />
        </div>
        <button
          onClick={fund}
          disabled={isPending}
          className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {!isConnected
            ? "Connect wallet to fund"
            : isPending
              ? "Confirming…"
              : "Fund vault"}
        </button>
      </div>
      {error && <p className="text-[11px] text-rose-400">{error}</p>}
      {verificationFailed && txHash && (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setVerificationFailed(false);
            setRecordedHash(null);
          }}
          className="text-[11px] font-semibold text-accent hover:underline"
        >
          Retry receipt verification
        </button>
      )}
      {txHash && (
        <a
          href={txUrl(txHash as Hex)}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-accent hover:underline font-mono"
        >
          {isRecorded ? "Fund verified — view tx" : isSuccess ? "Tx mined — verification pending" : "Tx submitted"} ↗
        </a>
      )}
    </div>
  );
}
