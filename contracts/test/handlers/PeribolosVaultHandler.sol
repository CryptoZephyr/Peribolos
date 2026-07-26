// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {PeribolosVault} from "../../src/PeribolosVault.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

/// @notice Bounded-input handler for the PeribolosVault invariant suite.
/// @dev Exposes `pay`, `sweepIdle`, `withdraw`, `togglePause` and `warp` as
///      the fuzzer's action surface (via `targetContract` in the invariant
///      test). Ghost variables track every legitimate USDC outflow so the
///      invariant test can assert the vault's balance only ever decreases
///      through transfers to allowlisted recipients, the treasury, or the
///      owner.
contract PeribolosVaultHandler is CommonBase, StdCheats, StdUtils {
    PeribolosVault public immutable vault;
    MockUSDC public immutable usdc;

    address public immutable agentKey;
    address public immutable owner;
    address public immutable treasury;

    address[] public recipients;

    uint128 public immutable perTxCap;

    // ---- Ghost accounting (I1) ----
    uint256 public totalPaidOut; // sum of successful pay() amounts (always to allowlisted recipients)
    uint256 public totalSwept; // sum of sweepIdle() transfers to treasury
    uint256 public totalWithdrawn; // sum of withdraw() transfers to owner

    // ---- Ghost flag (I3) ----
    bool public pausedPaymentExecuted;

    // ---- Call counters (useful for sanity-checking coverage) ----
    uint256 public payCalls;
    uint256 public sweepCalls;
    uint256 public withdrawCalls;
    uint256 public warpCalls;
    uint256 public pauseToggleCalls;

    constructor(
        PeribolosVault vault_,
        MockUSDC usdc_,
        address agentKey_,
        address owner_,
        address treasury_,
        address[] memory recipients_,
        uint128 perTxCap_
    ) {
        vault = vault_;
        usdc = usdc_;
        agentKey = agentKey_;
        owner = owner_;
        treasury = treasury_;
        perTxCap = perTxCap_;
        for (uint256 i = 0; i < recipients_.length; i++) {
            recipients.push(recipients_[i]);
        }
    }

    function pay(uint256 recipientSeed, uint256 amount, uint256 actionSeed) external {
        payCalls++;
        address to = recipients[recipientSeed % recipients.length];
        // Range past perTxCap and past a plausible dailyCap so both the
        // accepted and rejected legs of pay() get exercised.
        amount = bound(amount, 0, uint256(perTxCap) * 3);
        uint8 actionType = uint8(actionSeed % 4); // includes disallowed types 2/3

        bool wasPaused = vault.paused();

        vm.prank(agentKey);
        bool executed = vault.pay(to, amount, actionType);

        if (wasPaused && executed) {
            pausedPaymentExecuted = true;
        }

        if (executed) {
            totalPaidOut += amount;
        }
    }

    function sweepIdle() external {
        sweepCalls++;
        uint256 treasuryBalBefore = usdc.balanceOf(treasury);
        vault.sweepIdle();
        totalSwept += (usdc.balanceOf(treasury) - treasuryBalBefore);
    }

    function withdraw(uint256 amount) external {
        withdrawCalls++;
        uint256 vaultBal = usdc.balanceOf(address(vault));
        amount = bound(amount, 0, vaultBal);

        vm.prank(owner);
        vault.withdraw(amount);
        totalWithdrawn += amount;
    }

    function togglePause(bool doPause) external {
        pauseToggleCalls++;
        vm.prank(owner);
        if (doPause) {
            vault.pause();
        } else {
            vault.unpause();
        }
    }

    function warp(uint256 warpSeed) external {
        warpCalls++;
        uint256 delta = bound(warpSeed, 0, 3 days);
        vm.warp(block.timestamp + delta);
    }
}
