// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {PeribolosFactory} from "../../src/PeribolosFactory.sol";
import {PeribolosVault} from "../../src/PeribolosVault.sol";
import {IERC20} from "../../src/interfaces/IERC20.sol";
import {IIdentityRegistry} from "../../src/interfaces/IIdentityRegistry.sol";

/// @notice Runs against a fork of LIVE Arc testnet state. Validates the one
///         integration local mocks cannot: that the real ERC-8004
///         IdentityRegistry accepts `register(string)` from a contract caller
///         (the vault) and mints the identity NFT to it.
/// @dev The forked EVM is a standard EVM — Arc-native semantics (single-asset
///      USDC, runtime blocklist, EIP-7708) are NOT reproduced here. This test
///      only validates plain contract interactions against real deployed
///      bytecode and state. Requires network access; excluded from the default
///      suite via the `fork` directory naming (run with
///      `forge test --match-path "test/fork/*"`).
contract RegistryForkTest is Test {
    address constant USDC = 0x3600000000000000000000000000000000000000;
    address constant IDENTITY_REGISTRY = 0x8004A818BFB912233c491871b3d84c89A494BD9e;
    bytes32 constant ERC721_TRANSFER_SIG = keccak256("Transfer(address,address,uint256)");

    function setUp() public {
        vm.createSelectFork("arc_testnet");
    }

    function test_CreateDomain_RegistersOnRealRegistry() public {
        PeribolosFactory factory = new PeribolosFactory(IERC20(USDC), IIdentityRegistry(IDENTITY_REGISTRY));

        address domainOwner = makeAddr("owner");
        address agent = makeAddr("agent");
        address[] memory allow = new address[](1);
        allow[0] = makeAddr("service");

        PeribolosVault.VaultConfig memory cfg = PeribolosVault.VaultConfig({
            treasury: makeAddr("treasury"),
            agentKey: agent,
            agentExpiry: uint64(block.timestamp + 30 days),
            perTxCap: 10e6,
            dailyCap: 25e6,
            floatAmount: 50e6,
            allowedActions: 3, // action types 0 and 1
            allowlist: allow
        });

        vm.recordLogs();
        vm.prank(domainOwner);
        address vaultAddr = factory.createDomain(cfg, "ipfs://peribolos-fork-validation", 0);

        PeribolosVault vault = PeribolosVault(payable(vaultAddr));

        // registerIdentity is best-effort try/catch: if the REAL registry had
        // rejected the contract caller, identityRegistered would be false.
        assertTrue(vault.identityRegistered(), "real registry rejected contract-caller registration");
        assertEq(vault.owner(), domainOwner, "vault owner must be the creator, not the factory");

        // The registry must have minted an ERC-721 identity NFT to the vault.
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool foundMintToVault;
        for (uint256 i = 0; i < logs.length; i++) {
            if (
                logs[i].emitter == IDENTITY_REGISTRY && logs[i].topics.length == 4
                    && logs[i].topics[0] == ERC721_TRANSFER_SIG
                    && address(uint160(uint256(logs[i].topics[2]))) == vaultAddr
            ) {
                foundMintToVault = true;
                break;
            }
        }
        assertTrue(foundMintToVault, "no identity NFT minted to the vault by the real registry");
    }
}
