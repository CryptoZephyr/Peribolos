"use client";

import vaultAbiJson from "@peribolos/core/abi/PeribolosVault.json";
import factoryAbiJson from "@peribolos/core/abi/PeribolosFactory.json";

export const vaultAbi = ((vaultAbiJson as { abi?: unknown }).abi ?? vaultAbiJson) as never;
export const factoryAbi = ((factoryAbiJson as { abi?: unknown }).abi ?? factoryAbiJson) as never;
