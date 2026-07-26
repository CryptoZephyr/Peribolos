// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {PeribolosFactory} from "../src/PeribolosFactory.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";

/// @notice Deploys the PeribolosFactory to Arc testnet.
/// @dev Usage (keystore-based — NEVER pass a plaintext private key flag):
///
///   1. One-time: import the deployer key into an encrypted keystore:
///        cast wallet import peribolos-deployer --interactive
///   2. Fund the deployer with testnet USDC gas: https://faucet.circle.com
///   3. Deploy:
///        forge script script/Deploy.s.sol --rpc-url arc_testnet \
///          --account peribolos-deployer --broadcast
///
/// The factory is the only singleton; vaults deploy per-domain through it.
contract Deploy is Script {
    /// Arc testnet canonical addresses (verified live 2026-07-11).
    address constant USDC = 0x3600000000000000000000000000000000000000;
    address constant IDENTITY_REGISTRY = 0x8004A818BFB912233c491871b3d84c89A494BD9e;

    function run() external returns (PeribolosFactory factory) {
        vm.startBroadcast();
        factory = new PeribolosFactory(IERC20(USDC), IIdentityRegistry(IDENTITY_REGISTRY));
        vm.stopBroadcast();
    }
}
