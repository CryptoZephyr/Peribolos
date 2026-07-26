"use client";

import type { Address } from "viem";
import { CaretDown } from "@phosphor-icons/react";
import { shortAddress } from "@/lib/chain";
import { DEMO_VAULT_ADDRESS, useOwnerDomains } from "./useVault";

export function VaultPicker({
  connectedAddress,
  selected,
  onSelect,
}: {
  connectedAddress: Address | undefined;
  selected: Address;
  onSelect: (vault: Address) => void;
}) {
  const { data: ownedVaults, isLoading } = useOwnerDomains(connectedAddress);

  const options: { address: Address; label: string }[] = [
    { address: DEMO_VAULT_ADDRESS, label: "Demo vault" },
    ...(ownedVaults ?? [])
      .filter((v) => v.toLowerCase() !== DEMO_VAULT_ADDRESS.toLowerCase())
      .map((v, i) => ({ address: v, label: `My vault ${i + 1} (${shortAddress(v)})` })),
  ];

  if (!connectedAddress || options.length <= 1) {
    return null;
  }

  return (
    <div className="relative inline-flex items-center">
      <select
        value={selected}
        onChange={(e) => onSelect(e.target.value as Address)}
        disabled={isLoading}
        className="appearance-none rounded-full border border-line bg-surface-raised py-1.5 pl-3 pr-8 text-xs font-medium text-text outline-none transition-colors hover:border-line-strong"
      >
        {options.map((opt) => (
          <option key={opt.address} value={opt.address}>
            {opt.label}
          </option>
        ))}
      </select>
      <CaretDown size={12} className="pointer-events-none absolute right-3 text-text-faint" />
    </div>
  );
}
