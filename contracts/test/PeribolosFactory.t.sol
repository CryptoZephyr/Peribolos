// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {PeribolosFactory} from "../src/PeribolosFactory.sol";
import {PeribolosVault} from "../src/PeribolosVault.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {MockIdentityRegistry} from "./mocks/MockIdentityRegistry.sol";

contract PeribolosFactoryTest is Test {
    event DomainCreated(
        address indexed vault, address indexed owner, address indexed agentKey, string agentMetadataURI
    );

    PeribolosFactory internal factory;
    MockUSDC internal usdc;
    MockIdentityRegistry internal registry;

    address internal domainOwnerA = makeAddr("domainOwnerA");
    address internal domainOwnerB = makeAddr("domainOwnerB");
    address internal agentKeyA = makeAddr("agentKeyA");
    address internal agentKeyB = makeAddr("agentKeyB");
    address internal treasuryAddr = makeAddr("treasury");
    address internal recipient1 = makeAddr("recipient1");

    uint128 internal constant PER_TX_CAP = 10e6;
    uint128 internal constant DAILY_CAP = 25e6;
    uint128 internal constant FLOAT_AMOUNT = 50e6;
    uint256 internal constant ALLOWED_ACTIONS = 3;

    function setUp() public {
        usdc = new MockUSDC();
        registry = new MockIdentityRegistry();
        factory = new PeribolosFactory(IERC20(address(usdc)), IIdentityRegistry(address(registry)));

        vm.deal(domainOwnerA, 100 ether);
        vm.deal(domainOwnerB, 100 ether);
    }

    function _cfg(address agentKey) internal view returns (PeribolosVault.VaultConfig memory cfg) {
        address[] memory allowlist = new address[](1);
        allowlist[0] = recipient1;

        cfg = PeribolosVault.VaultConfig({
            treasury: treasuryAddr,
            agentKey: agentKey,
            agentExpiry: uint64(block.timestamp + 30 days),
            perTxCap: PER_TX_CAP,
            dailyCap: DAILY_CAP,
            floatAmount: FLOAT_AMOUNT,
            allowedActions: ALLOWED_ACTIONS,
            allowlist: allowlist
        });
    }

    function test_CreateDomain_HappyPath_ConfiguresVaultCorrectly() public {
        PeribolosVault.VaultConfig memory cfg = _cfg(agentKeyA);
        string memory uri = "ipfs://agent-a";
        uint256 agentGasWei = 1 ether;
        uint256 value = 5 ether;

        vm.prank(domainOwnerA);
        address vaultAddr = factory.createDomain{value: value}(cfg, uri, agentGasWei);

        PeribolosVault v = PeribolosVault(payable(vaultAddr));

        assertEq(v.owner(), domainOwnerA, "vault owner must be the caller, not the factory");
        assertEq(v.factory(), address(factory));
        assertEq(v.treasury(), treasuryAddr);
        assertEq(v.agentKey(), agentKeyA);
        assertEq(v.agentExpiry(), cfg.agentExpiry);
        assertEq(v.perTxCap(), PER_TX_CAP);
        assertEq(v.dailyCap(), DAILY_CAP);
        assertEq(v.floatAmount(), FLOAT_AMOUNT);
        assertEq(v.allowedActions(), ALLOWED_ACTIONS);
        assertTrue(v.allowlist(recipient1));
    }

    function test_CreateDomain_RevertsInsufficientValue() public {
        PeribolosVault.VaultConfig memory cfg = _cfg(agentKeyA);

        vm.prank(domainOwnerA);
        vm.expectRevert(PeribolosFactory.InsufficientValue.selector);
        factory.createDomain{value: 0.5 ether}(cfg, "ipfs://agent-a", 1 ether);
    }

    function test_CreateDomain_AgentReceivesExactGas() public {
        PeribolosVault.VaultConfig memory cfg = _cfg(agentKeyA);
        uint256 agentGasWei = 0.3 ether;
        uint256 value = 2 ether;

        uint256 agentBalBefore = agentKeyA.balance;

        vm.prank(domainOwnerA);
        factory.createDomain{value: value}(cfg, "ipfs://agent-a", agentGasWei);

        assertEq(agentKeyA.balance, agentBalBefore + agentGasWei);
    }

    function test_CreateDomain_VaultReceivesRemainder() public {
        PeribolosVault.VaultConfig memory cfg = _cfg(agentKeyA);
        uint256 agentGasWei = 0.3 ether;
        uint256 value = 2 ether;

        vm.prank(domainOwnerA);
        address vaultAddr = factory.createDomain{value: value}(cfg, "ipfs://agent-a", agentGasWei);

        assertEq(vaultAddr.balance, value - agentGasWei);
    }

    function test_CreateDomain_ZeroAgentGas_AllValueToVault() public {
        PeribolosVault.VaultConfig memory cfg = _cfg(agentKeyA);
        uint256 value = 1.5 ether;
        uint256 agentBalBefore = agentKeyA.balance;

        vm.prank(domainOwnerA);
        address vaultAddr = factory.createDomain{value: value}(cfg, "ipfs://agent-a", 0);

        assertEq(agentKeyA.balance, agentBalBefore, "no gas forwarded when agentGasWei is 0");
        assertEq(vaultAddr.balance, value);
    }

    function test_CreateDomain_ExactAgentGas_NoRemainderNoVaultFunding() public {
        PeribolosVault.VaultConfig memory cfg = _cfg(agentKeyA);
        uint256 agentGasWei = 1 ether;

        vm.prank(domainOwnerA);
        address vaultAddr = factory.createDomain{value: agentGasWei}(cfg, "ipfs://agent-a", agentGasWei);

        assertEq(agentKeyA.balance, agentGasWei);
        assertEq(vaultAddr.balance, 0);
    }

    function test_CreateDomain_DomainsOfEnumeration_MultipleCreationsAndOwners() public {
        vm.prank(domainOwnerA);
        address vaultA1 = factory.createDomain{value: 1 ether}(_cfg(agentKeyA), "ipfs://a1", 0.1 ether);

        vm.prank(domainOwnerA);
        address vaultA2 = factory.createDomain{value: 1 ether}(_cfg(agentKeyA), "ipfs://a2", 0.1 ether);

        vm.prank(domainOwnerB);
        address vaultB1 = factory.createDomain{value: 1 ether}(_cfg(agentKeyB), "ipfs://b1", 0.1 ether);

        address[] memory ownedByA = factory.domainsOf(domainOwnerA);
        address[] memory ownedByB = factory.domainsOf(domainOwnerB);

        assertEq(ownedByA.length, 2);
        assertEq(ownedByA[0], vaultA1);
        assertEq(ownedByA[1], vaultA2);

        assertEq(ownedByB.length, 1);
        assertEq(ownedByB[0], vaultB1);
    }

    function test_CreateDomain_EmitsDomainCreated() public {
        PeribolosVault.VaultConfig memory cfg = _cfg(agentKeyA);
        string memory uri = "ipfs://agent-a";

        uint256 nonce = vm.getNonce(address(factory));
        address predictedVault = vm.computeCreateAddress(address(factory), nonce);

        vm.expectEmit(true, true, true, true, address(factory));
        emit DomainCreated(predictedVault, domainOwnerA, agentKeyA, uri);

        vm.prank(domainOwnerA);
        address vaultAddr = factory.createDomain{value: 1 ether}(cfg, uri, 0.1 ether);

        assertEq(vaultAddr, predictedVault);
    }

    function test_CreateDomain_PerformsIdentityRegistration() public {
        PeribolosVault.VaultConfig memory cfg = _cfg(agentKeyA);
        string memory uri = "ipfs://agent-a";

        vm.prank(domainOwnerA);
        address vaultAddr = factory.createDomain{value: 1 ether}(cfg, uri, 0.1 ether);

        PeribolosVault v = PeribolosVault(payable(vaultAddr));
        assertTrue(v.identityRegistered());
        assertEq(registry.ownerOf(1), vaultAddr);
        assertEq(registry.lastMetadataURI(), uri);
    }
}
