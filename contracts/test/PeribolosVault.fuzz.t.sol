// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {PeribolosVault} from "../src/PeribolosVault.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {MockIdentityRegistry} from "./mocks/MockIdentityRegistry.sol";

contract PeribolosVaultFuzzTest is Test {
    PeribolosVault internal vault;
    MockUSDC internal usdc;
    MockIdentityRegistry internal registry;

    address internal ownerAddr = makeAddr("owner");
    address internal treasuryAddr = makeAddr("treasury");
    address internal agentKeyAddr = makeAddr("agentKey");
    address internal recipient1 = makeAddr("recipient1");

    uint128 internal constant PER_TX_CAP = 10e6;
    uint128 internal constant DAILY_CAP = 25e6;
    uint128 internal constant FLOAT_AMOUNT = 50e6;
    uint256 internal constant ALLOWED_ACTIONS = 3; // bits 0 and 1

    // Fund the vault generously so `balanceOf` is never the binding
    // constraint in these fuzz tests — they isolate perTxCap/dailyCap/epoch
    // logic, not the balance check (which is covered in the unit suite).
    uint256 internal constant AMPLE_BALANCE = 1_000_000e6;

    function setUp() public {
        usdc = new MockUSDC();
        registry = new MockIdentityRegistry();

        address[] memory allowlist = new address[](1);
        allowlist[0] = recipient1;

        PeribolosVault.VaultConfig memory cfg = PeribolosVault.VaultConfig({
            treasury: treasuryAddr,
            agentKey: agentKeyAddr,
            // Comfortably longer than the largest warp offset used by
            // testFuzz_EpochBoundaryMath (3650 days) so that test isolates
            // epoch-boundary math without also tripping AGENT_KEY_EXPIRED.
            agentExpiry: uint64(block.timestamp + 8000 days),
            perTxCap: PER_TX_CAP,
            dailyCap: DAILY_CAP,
            floatAmount: FLOAT_AMOUNT,
            allowedActions: ALLOWED_ACTIONS,
            allowlist: allowlist
        });

        vault = new PeribolosVault(ownerAddr, cfg, IERC20(address(usdc)), IIdentityRegistry(address(registry)));
        usdc.mint(address(vault), AMPLE_BALANCE);
    }

    function _pay(uint256 amount) internal returns (bool) {
        vm.prank(agentKeyAddr);
        return vault.pay(recipient1, amount, 0);
    }

    /// (a) For any amount, pay() either succeeds within caps or is blocked
    ///     with the exact correct reason — never both, never the wrong one.
    function testFuzz_PayEitherSucceedsWithinCapsOrBlocksWithExactReason(uint256 amount) public {
        amount = bound(amount, 0, uint256(DAILY_CAP) * 3);

        uint256 vaultBalBefore = usdc.balanceOf(address(vault));
        uint256 recipientBalBefore = usdc.balanceOf(recipient1);

        bool executed = _pay(amount);

        bool withinPerTxCap = amount <= PER_TX_CAP;
        bool withinDailyCap = amount <= DAILY_CAP; // epochSpent starts at 0
        bool shouldSucceed = withinPerTxCap && withinDailyCap;

        assertEq(executed, shouldSucceed);

        if (shouldSucceed) {
            assertEq(usdc.balanceOf(address(vault)), vaultBalBefore - amount);
            assertEq(usdc.balanceOf(recipient1), recipientBalBefore + amount);
            assertEq(vault.epochSpent(), amount);
        } else {
            // Blocked: no funds moved, epoch accounting untouched.
            assertEq(usdc.balanceOf(address(vault)), vaultBalBefore);
            assertEq(usdc.balanceOf(recipient1), recipientBalBefore);
            assertEq(vault.epochSpent(), 0);

            if (!withinPerTxCap) {
                // EXCEEDS_PER_TX_CAP is checked before EXCEEDS_DAILY_CAP,
                // so any amount over perTxCap is blocked for that reason
                // regardless of the (irrelevant, still-zero) daily spend.
                assertTrue(amount > PER_TX_CAP);
            } else {
                assertTrue(amount > DAILY_CAP);
            }
        }
    }

    /// (b) Any fuzzed sequence of amounts within a single epoch must never
    ///     let cumulative recorded spend exceed dailyCap.
    function testFuzz_CumulativeSpendWithinEpochNeverExceedsDailyCap(uint256[8] memory rawAmounts) public {
        uint256 expectedSpent = 0;

        for (uint256 i = 0; i < rawAmounts.length; i++) {
            // Deliberately range past perTxCap sometimes to exercise both
            // accepted and rejected legs of the sequence.
            uint256 amount = bound(rawAmounts[i], 0, uint256(PER_TX_CAP) * 2);

            bool executed = _pay(amount);

            if (executed) {
                expectedSpent += amount;
            }

            assertEq(vault.epochSpent(), expectedSpent, "epochSpent must track only executed payments");
            assertLe(vault.epochSpent(), DAILY_CAP, "cumulative spend must never exceed dailyCap");
        }
    }

    /// (c) Epoch boundary math (block.timestamp / 1 days) must correctly
    ///     distinguish "still today" from "a new day" after an arbitrary
    ///     warp offset.
    function testFuzz_EpochBoundaryMath(uint256 warpOffset) public {
        warpOffset = bound(warpOffset, 0, 3650 days);

        uint256 day1 = block.timestamp / 1 days;
        assertTrue(_pay(5e6));
        assertEq(vault.currentEpoch(), uint64(day1));
        assertEq(vault.epochSpent(), 5e6);

        vm.warp(block.timestamp + warpOffset);
        uint256 day2 = block.timestamp / 1 days;

        assertTrue(_pay(5e6));
        assertEq(vault.currentEpoch(), uint64(day2), "currentEpoch must always reflect the latest day observed");

        if (day2 == day1) {
            assertEq(vault.epochSpent(), 10e6, "same day: spend must accumulate");
        } else {
            assertEq(vault.epochSpent(), 5e6, "new day: spend must reset to just this payment");
        }
    }
}
