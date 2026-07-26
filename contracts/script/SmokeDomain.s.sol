// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {PeribolosFactory} from "../src/PeribolosFactory.sol";
import {PeribolosVault} from "../src/PeribolosVault.sol";

/// @notice Creates one smoke domain against a freshly deployed factory.
/// @dev Env:
///   FACTORY      — PeribolosFactory address
///   AGENT_KEY    — agent EOA address (spender only)
///   ALLOWLISTED  — allowlisted payee (defaults to broadcaster)
/// Usage:
///   FACTORY=0x… AGENT_KEY=0x… forge script script/SmokeDomain.s.sol \
///     --rpc-url arc_testnet --keystore … --password-file … --broadcast
contract SmokeDomain is Script {
    function run() external returns (address vault) {
        address factoryAddr = vm.envAddress("FACTORY");
        address agentKey = vm.envAddress("AGENT_KEY");
        // Optional override; empty → use broadcaster (owner) as allowlisted payee.
        address allowlistedOverride = vm.envOr("ALLOWLISTED", address(0));

        uint256 agentGasWei = 0.3 ether; // 0.3 USDC native (18-dec)
        uint256 fundWei = 2.5 ether; // 2.5 USDC to vault
        uint256 value = agentGasWei + fundWei;

        vm.startBroadcast();
        // Inside broadcast, msg.sender is the keystore owner (deployer).
        address owner = msg.sender;
        address allowlisted = allowlistedOverride == address(0) ? owner : allowlistedOverride;

        address[] memory allowlist = new address[](1);
        allowlist[0] = allowlisted;

        PeribolosVault.VaultConfig memory cfg = PeribolosVault.VaultConfig({
            treasury: owner,
            agentKey: agentKey,
            agentExpiry: uint64(block.timestamp + 90 days),
            perTxCap: 2e6, // 2 USDC
            dailyCap: 10e6, // 10 USDC
            floatAmount: 1e6, // 1 USDC
            allowedActions: 7, // SERVICE | A2A | HUMAN
            allowlist: allowlist
        });

        vault = PeribolosFactory(factoryAddr).createDomain{value: value}(
            cfg, "ipfs://peribolos-smoke-v31", agentGasWei
        );
        vm.stopBroadcast();

        console2.log("vault", vault);
        console2.log("owner", owner);
        console2.log("agent", agentKey);
        console2.log("allowlisted", allowlisted);
        console2.log("feeBps", PeribolosVault(payable(vault)).feeBps());
    }
}
