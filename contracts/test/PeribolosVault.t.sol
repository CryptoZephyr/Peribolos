// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {PeribolosVault} from "../src/PeribolosVault.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {MockIdentityRegistry} from "./mocks/MockIdentityRegistry.sol";

contract PeribolosVaultTest is Test {
    // Mirror the vault's events so vm.expectEmit can be used against them.
    event PaymentExecuted(address indexed to, uint256 amount, uint8 indexed actionType, uint256 epochSpent);
    event PaymentBlocked(
        address indexed to, uint256 amount, uint8 indexed actionType, PeribolosVault.BlockReason indexed reason
    );
    event RulesUpdated(uint128 perTxCap, uint128 dailyCap, uint128 floatAmount, uint256 allowedActions);
    event AllowlistUpdated(address indexed recipient, bool allowed);
    event VaultPaused();
    event VaultUnpaused();
    event Swept(address indexed treasury, uint256 amount);
    event AgentKeyRotated(address indexed newAgentKey, uint64 newExpiry);
    event Withdrawn(address indexed to, uint256 amount);
    event TreasuryUpdated(address indexed newTreasury);
    event IdentityRegistered(string metadataURI);
    event IdentityRegistrationFailed(string metadataURI);
    event ProtocolFeeUpdated(uint16 feeBps, address feeRecipient);
    event ProtocolFeeCollected(address indexed to, uint256 feeAmount, uint256 netAmount);

    PeribolosVault internal vault;
    MockUSDC internal usdc;
    MockIdentityRegistry internal registry;

    address internal ownerAddr = makeAddr("owner");
    address internal treasuryAddr = makeAddr("treasury");
    address internal agentKeyAddr = makeAddr("agentKey");
    address internal attacker = makeAddr("attacker");
    address internal recipient1 = makeAddr("recipient1");
    address internal recipient2 = makeAddr("recipient2");
    address internal notAllowlisted = makeAddr("notAllowlisted");

    uint128 internal constant PER_TX_CAP = 10e6;
    uint128 internal constant DAILY_CAP = 25e6;
    uint128 internal constant FLOAT_AMOUNT = 50e6;
    uint256 internal constant ALLOWED_ACTIONS = 3; // bits 0 and 1
    uint256 internal constant INITIAL_VAULT_BALANCE = 200e6;

    uint64 internal expiry;

    function setUp() public {
        usdc = new MockUSDC();
        registry = new MockIdentityRegistry();
        expiry = uint64(block.timestamp + 30 days);

        vault = _deployVault(_defaultConfig());
        usdc.mint(address(vault), INITIAL_VAULT_BALANCE);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    function _defaultConfig() internal view returns (PeribolosVault.VaultConfig memory cfg) {
        address[] memory allowlist = new address[](2);
        allowlist[0] = recipient1;
        allowlist[1] = recipient2;

        cfg = PeribolosVault.VaultConfig({
            treasury: treasuryAddr,
            agentKey: agentKeyAddr,
            agentExpiry: expiry,
            perTxCap: PER_TX_CAP,
            dailyCap: DAILY_CAP,
            floatAmount: FLOAT_AMOUNT,
            allowedActions: ALLOWED_ACTIONS,
            allowlist: allowlist
        });
    }

    /// @dev Deploys with `address(this)` (this test contract) as the vault's
    ///      `factory`, since `factory = msg.sender` in the constructor.
    function _deployVault(PeribolosVault.VaultConfig memory cfg) internal returns (PeribolosVault) {
        return new PeribolosVault(ownerAddr, cfg, IERC20(address(usdc)), IIdentityRegistry(address(registry)));
    }

    function _pay(address to, uint256 amount, uint8 actionType) internal returns (bool) {
        vm.prank(agentKeyAddr);
        return vault.pay(to, amount, actionType);
    }

    // ------------------------------------------------------------------
    // BlockReason coverage — each rejects with the exact event, false
    // return, and no funds moved.
    // ------------------------------------------------------------------

    function test_Pay_Blocked_RecipientNotAllowlisted() public {
        uint256 vaultBalBefore = usdc.balanceOf(address(vault));
        uint256 toBalBefore = usdc.balanceOf(notAllowlisted);

        vm.expectEmit(true, true, true, true, address(vault));
        emit PaymentBlocked(notAllowlisted, 5e6, 0, PeribolosVault.BlockReason.RECIPIENT_NOT_ALLOWLISTED);
        bool executed = _pay(notAllowlisted, 5e6, 0);

        assertFalse(executed);
        assertEq(usdc.balanceOf(address(vault)), vaultBalBefore);
        assertEq(usdc.balanceOf(notAllowlisted), toBalBefore);
        assertEq(vault.epochSpent(), 0);
    }

    function test_Pay_Blocked_ExceedsPerTxCap() public {
        uint256 vaultBalBefore = usdc.balanceOf(address(vault));
        uint256 amount = PER_TX_CAP + 1;

        vm.expectEmit(true, true, true, true, address(vault));
        emit PaymentBlocked(recipient1, amount, 0, PeribolosVault.BlockReason.EXCEEDS_PER_TX_CAP);
        bool executed = _pay(recipient1, amount, 0);

        assertFalse(executed);
        assertEq(usdc.balanceOf(address(vault)), vaultBalBefore);
        assertEq(vault.epochSpent(), 0);
    }

    function test_Pay_Blocked_ExceedsDailyCap() public {
        // Two max per-tx payments (10e6 + 10e6 = 20e6) leave 5e6 of daily
        // headroom; a third 10e6 payment would push cumulative spend to
        // 30e6 > dailyCap (25e6).
        assertTrue(_pay(recipient1, PER_TX_CAP, 0));
        assertTrue(_pay(recipient1, PER_TX_CAP, 0));
        assertEq(vault.epochSpent(), 20e6);

        uint256 vaultBalBefore = usdc.balanceOf(address(vault));

        vm.expectEmit(true, true, true, true, address(vault));
        emit PaymentBlocked(recipient1, PER_TX_CAP, 0, PeribolosVault.BlockReason.EXCEEDS_DAILY_CAP);
        bool executed = _pay(recipient1, PER_TX_CAP, 0);

        assertFalse(executed);
        assertEq(usdc.balanceOf(address(vault)), vaultBalBefore);
        assertEq(vault.epochSpent(), 20e6, "epochSpent must not change on a blocked payment");
    }

    function test_Pay_Blocked_ActionNotAllowed() public {
        // Bit 2 is not set in ALLOWED_ACTIONS (0b011).
        uint256 vaultBalBefore = usdc.balanceOf(address(vault));

        vm.expectEmit(true, true, true, true, address(vault));
        emit PaymentBlocked(recipient1, 5e6, 2, PeribolosVault.BlockReason.ACTION_NOT_ALLOWED);
        bool executed = _pay(recipient1, 5e6, 2);

        assertFalse(executed);
        assertEq(usdc.balanceOf(address(vault)), vaultBalBefore);
    }

    function test_Pay_Blocked_AgentKeyExpired() public {
        vm.warp(uint256(expiry) + 1);
        uint256 vaultBalBefore = usdc.balanceOf(address(vault));

        vm.expectEmit(true, true, true, true, address(vault));
        emit PaymentBlocked(recipient1, 5e6, 0, PeribolosVault.BlockReason.AGENT_KEY_EXPIRED);
        bool executed = _pay(recipient1, 5e6, 0);

        assertFalse(executed);
        assertEq(usdc.balanceOf(address(vault)), vaultBalBefore);
    }

    function test_Pay_Blocked_VaultPaused() public {
        vm.prank(ownerAddr);
        vault.pause();

        uint256 vaultBalBefore = usdc.balanceOf(address(vault));

        vm.expectEmit(true, true, true, true, address(vault));
        emit PaymentBlocked(recipient1, 5e6, 0, PeribolosVault.BlockReason.VAULT_PAUSED);
        bool executed = _pay(recipient1, 5e6, 0);

        assertFalse(executed);
        assertEq(usdc.balanceOf(address(vault)), vaultBalBefore);
    }

    function test_Pay_Blocked_InsufficientBalance() public {
        // Fresh, near-empty vault: within perTxCap/dailyCap, but balance is
        // less than the requested amount.
        PeribolosVault poorVault = _deployVault(_defaultConfig());
        usdc.mint(address(poorVault), 3e6);

        uint256 vaultBalBefore = usdc.balanceOf(address(poorVault));

        vm.expectEmit(true, true, true, true, address(poorVault));
        emit PaymentBlocked(recipient1, 5e6, 0, PeribolosVault.BlockReason.INSUFFICIENT_BALANCE);
        vm.prank(agentKeyAddr);
        bool executed = poorVault.pay(recipient1, 5e6, 0);

        assertFalse(executed);
        assertEq(usdc.balanceOf(address(poorVault)), vaultBalBefore);
        assertEq(poorVault.epochSpent(), 0);
    }

    function test_Pay_Blocked_TransferFailed_ViaRevert() public {
        usdc.setBlocked(recipient1, true);

        uint256 vaultBalBefore = usdc.balanceOf(address(vault));

        vm.expectEmit(true, true, true, true, address(vault));
        emit PaymentBlocked(recipient1, 5e6, 0, PeribolosVault.BlockReason.TRANSFER_FAILED);
        bool executed = _pay(recipient1, 5e6, 0);

        assertFalse(executed);
        assertEq(usdc.balanceOf(address(vault)), vaultBalBefore);
        assertEq(vault.epochSpent(), 0, "epochSpent must roll back after a reverted transfer");
        assertEq(vault.currentEpoch(), uint64(block.timestamp / 1 days));
    }

    function test_Pay_Blocked_TransferFailed_ViaReturnFalse() public {
        usdc.setReturnFalse(true);

        uint256 vaultBalBefore = usdc.balanceOf(address(vault));

        vm.expectEmit(true, true, true, true, address(vault));
        emit PaymentBlocked(recipient1, 5e6, 0, PeribolosVault.BlockReason.TRANSFER_FAILED);
        bool executed = _pay(recipient1, 5e6, 0);

        assertFalse(executed);
        assertEq(usdc.balanceOf(address(vault)), vaultBalBefore);
        assertEq(vault.epochSpent(), 0, "epochSpent must roll back after a false-returning transfer");
    }

    function test_Pay_TransferFailed_RollsBackPartialEpochSpent() public {
        // Spend 10e6 successfully first, then a second payment that fails
        // at the transfer stage must roll epochSpent back to 10e6, not 0.
        assertTrue(_pay(recipient1, 10e6, 0));
        assertEq(vault.epochSpent(), 10e6);

        usdc.setReturnFalse(true);
        bool executed = _pay(recipient1, 5e6, 0);
        assertFalse(executed);
        assertEq(vault.epochSpent(), 10e6, "must roll back to the pre-attempt spend, not zero");
    }

    // ------------------------------------------------------------------
    // Happy path
    // ------------------------------------------------------------------

    function test_Pay_HappyPath_EventBalanceAndEpochAccumulation() public {
        uint256 vaultBalBefore = usdc.balanceOf(address(vault));
        uint256 recipientBalBefore = usdc.balanceOf(recipient1);

        vm.expectEmit(true, true, true, true, address(vault));
        emit PaymentExecuted(recipient1, 4e6, 1, 4e6);
        bool executed = _pay(recipient1, 4e6, 1);

        assertTrue(executed);
        assertEq(usdc.balanceOf(address(vault)), vaultBalBefore - 4e6);
        assertEq(usdc.balanceOf(recipient1), recipientBalBefore + 4e6);
        assertEq(vault.epochSpent(), 4e6);

        // Second payment accumulates on top of the first within the epoch.
        vm.expectEmit(true, true, true, true, address(vault));
        emit PaymentExecuted(recipient2, 6e6, 0, 10e6);
        executed = _pay(recipient2, 6e6, 0);

        assertTrue(executed);
        assertEq(usdc.balanceOf(address(vault)), vaultBalBefore - 10e6);
        assertEq(usdc.balanceOf(recipient2), 6e6);
        assertEq(vault.epochSpent(), 10e6);
        assertEq(vault.currentEpoch(), uint64(block.timestamp / 1 days));
    }

    // ------------------------------------------------------------------
    // Epoch rollover
    // ------------------------------------------------------------------

    function test_Pay_EpochRollover_AllowsSpendingAgainNextDay() public {
        assertTrue(_pay(recipient1, PER_TX_CAP, 0));
        assertTrue(_pay(recipient1, PER_TX_CAP, 0));
        assertTrue(_pay(recipient1, 5e6, 0));
        assertEq(vault.epochSpent(), DAILY_CAP);

        // Further spend in the same epoch is blocked.
        assertFalse(_pay(recipient1, 1e6, 0));

        // Warp to the next UTC day.
        uint256 nextDay = (block.timestamp / 1 days) + 1;
        vm.warp(nextDay * 1 days);

        bool executed = _pay(recipient1, PER_TX_CAP, 0);
        assertTrue(executed, "spending must be allowed again in a fresh epoch");
        assertEq(vault.epochSpent(), PER_TX_CAP);
        assertEq(vault.currentEpoch(), uint64(nextDay));
    }

    function test_Pay_EpochBoundary_UsesFreshEpochExactlyAtBoundary() public {
        assertTrue(_pay(recipient1, 5e6, 0));
        uint256 day0 = block.timestamp / 1 days;
        assertEq(vault.currentEpoch(), uint64(day0));

        // One second before the next day boundary: still the same epoch.
        uint256 boundary = (day0 + 1) * 1 days;
        vm.warp(boundary - 1);
        assertTrue(_pay(recipient1, 5e6, 0));
        assertEq(vault.currentEpoch(), uint64(day0));
        assertEq(vault.epochSpent(), 10e6);

        // Exactly at the boundary: a fresh epoch, spend resets.
        vm.warp(boundary);
        assertTrue(_pay(recipient1, 5e6, 0));
        assertEq(vault.currentEpoch(), uint64(day0 + 1));
        assertEq(vault.epochSpent(), 5e6, "boundary payment must use the fresh epoch");
    }

    // ------------------------------------------------------------------
    // Access control on pay()
    // ------------------------------------------------------------------

    function test_Pay_RevertsNotAgent_Attacker() public {
        vm.prank(attacker);
        vm.expectRevert(PeribolosVault.NotAgent.selector);
        vault.pay(recipient1, 1e6, 0);
    }

    function test_Pay_RevertsNotAgent_Owner() public {
        // The owner cannot pay — only the agent key can.
        vm.prank(ownerAddr);
        vm.expectRevert(PeribolosVault.NotAgent.selector);
        vault.pay(recipient1, 1e6, 0);
    }

    // ------------------------------------------------------------------
    // Owner: setRules
    // ------------------------------------------------------------------

    function test_SetRules_UpdatesStateEmitsAndAffectsPay() public {
        vm.expectEmit(true, true, true, true, address(vault));
        emit RulesUpdated(1e6, 2e6, 100e6, 1);
        vm.prank(ownerAddr);
        vault.setRules(1e6, 2e6, 100e6, 1);

        assertEq(vault.perTxCap(), 1e6);
        assertEq(vault.dailyCap(), 2e6);
        assertEq(vault.floatAmount(), 100e6);
        assertEq(vault.allowedActions(), 1);

        // actionType 1 is no longer allowed under the new bitmap.
        assertFalse(_pay(recipient1, 1e6, 1));
        // A payment exceeding the new, lower perTxCap is blocked.
        assertFalse(_pay(recipient1, 1.5e6, 0));
        // Within the new caps, it succeeds.
        assertTrue(_pay(recipient1, 1e6, 0));
    }

    function test_SetRules_RevertsNotOwner() public {
        vm.prank(attacker);
        vm.expectRevert(PeribolosVault.NotOwner.selector);
        vault.setRules(1e6, 2e6, 3e6, 1);
    }

    // ------------------------------------------------------------------
    // Owner: setAllowlist
    // ------------------------------------------------------------------

    function test_SetAllowlist_UpdatesStateAndEmits() public {
        assertFalse(vault.allowlist(notAllowlisted));

        address[] memory recipients = new address[](2);
        recipients[0] = notAllowlisted;
        recipients[1] = recipient1;

        vm.expectEmit(true, true, true, true, address(vault));
        emit AllowlistUpdated(notAllowlisted, true);
        vm.expectEmit(true, true, true, true, address(vault));
        emit AllowlistUpdated(recipient1, true);
        vm.prank(ownerAddr);
        vault.setAllowlist(recipients, true);

        assertTrue(vault.allowlist(notAllowlisted));
        assertTrue(_pay(notAllowlisted, 1e6, 0));

        // Now remove recipient1.
        address[] memory toRemove = new address[](1);
        toRemove[0] = recipient1;
        vm.expectEmit(true, true, true, true, address(vault));
        emit AllowlistUpdated(recipient1, false);
        vm.prank(ownerAddr);
        vault.setAllowlist(toRemove, false);

        assertFalse(vault.allowlist(recipient1));
        assertFalse(_pay(recipient1, 1e6, 0));
    }

    function test_SetAllowlist_RevertsOnZeroAddress_NoPartialEffect() public {
        address[] memory recipients = new address[](2);
        recipients[0] = notAllowlisted; // would succeed in isolation
        recipients[1] = address(0); // causes the whole call to revert

        vm.prank(ownerAddr);
        vm.expectRevert(PeribolosVault.ZeroAddress.selector);
        vault.setAllowlist(recipients, true);

        // The whole transaction reverted, so notAllowlisted must NOT have
        // been applied.
        assertFalse(vault.allowlist(notAllowlisted));
    }

    function test_SetAllowlist_RevertsNotOwner() public {
        address[] memory recipients = new address[](1);
        recipients[0] = notAllowlisted;
        vm.prank(attacker);
        vm.expectRevert(PeribolosVault.NotOwner.selector);
        vault.setAllowlist(recipients, true);
    }

    // ------------------------------------------------------------------
    // Owner: pause / unpause
    // ------------------------------------------------------------------

    function test_PauseThenUnpause_BlocksThenRestoresPay() public {
        vm.expectEmit(true, true, true, true, address(vault));
        emit VaultPaused();
        vm.prank(ownerAddr);
        vault.pause();
        assertTrue(vault.paused());
        assertFalse(_pay(recipient1, 1e6, 0));

        vm.expectEmit(true, true, true, true, address(vault));
        emit VaultUnpaused();
        vm.prank(ownerAddr);
        vault.unpause();
        assertFalse(vault.paused());
        assertTrue(_pay(recipient1, 1e6, 0));
    }

    function test_Pause_RevertsNotOwner() public {
        vm.prank(attacker);
        vm.expectRevert(PeribolosVault.NotOwner.selector);
        vault.pause();
    }

    function test_Unpause_RevertsNotOwner() public {
        vm.prank(ownerAddr);
        vault.pause();

        vm.prank(attacker);
        vm.expectRevert(PeribolosVault.NotOwner.selector);
        vault.unpause();
    }

    // ------------------------------------------------------------------
    // Owner: rotateAgentKey
    // ------------------------------------------------------------------

    function test_RotateAgentKey_OldKeyRevokedNewKeyWorks() public {
        address newAgent = makeAddr("newAgent");
        uint64 newExpiry = uint64(block.timestamp + 60 days);

        vm.expectEmit(true, true, true, true, address(vault));
        emit AgentKeyRotated(newAgent, newExpiry);
        vm.prank(ownerAddr);
        vault.rotateAgentKey(newAgent, newExpiry);

        assertEq(vault.agentKey(), newAgent);
        assertEq(vault.agentExpiry(), newExpiry);

        // Old key can no longer pay.
        vm.prank(agentKeyAddr);
        vm.expectRevert(PeribolosVault.NotAgent.selector);
        vault.pay(recipient1, 1e6, 0);

        // New key can pay.
        vm.prank(newAgent);
        assertTrue(vault.pay(recipient1, 1e6, 0));
    }

    function test_RotateAgentKey_RevertsZeroAddress() public {
        vm.prank(ownerAddr);
        vm.expectRevert(PeribolosVault.ZeroAddress.selector);
        vault.rotateAgentKey(address(0), uint64(block.timestamp + 1 days));
    }

    function test_RotateAgentKey_RevertsExpiryInPast() public {
        vm.prank(ownerAddr);
        vm.expectRevert(PeribolosVault.ExpiryInPast.selector);
        vault.rotateAgentKey(makeAddr("newAgent"), uint64(block.timestamp));
    }

    function test_RotateAgentKey_RevertsNotOwner() public {
        vm.prank(attacker);
        vm.expectRevert(PeribolosVault.NotOwner.selector);
        vault.rotateAgentKey(makeAddr("newAgent"), uint64(block.timestamp + 1 days));
    }

    // ------------------------------------------------------------------
    // Owner: setTreasury
    // ------------------------------------------------------------------

    function test_SetTreasury_UpdatesStateEmitsAndAffectsSweep() public {
        address newTreasury = makeAddr("newTreasury");

        vm.expectEmit(true, true, true, true, address(vault));
        emit TreasuryUpdated(newTreasury);
        vm.prank(ownerAddr);
        vault.setTreasury(newTreasury);

        assertEq(vault.treasury(), newTreasury);

        vault.sweepIdle();
        assertEq(usdc.balanceOf(newTreasury), INITIAL_VAULT_BALANCE - FLOAT_AMOUNT);
        assertEq(usdc.balanceOf(treasuryAddr), 0);
    }

    function test_SetTreasury_RevertsZeroAddress() public {
        vm.prank(ownerAddr);
        vm.expectRevert(PeribolosVault.ZeroAddress.selector);
        vault.setTreasury(address(0));
    }

    function test_SetTreasury_RevertsNotOwner() public {
        vm.prank(attacker);
        vm.expectRevert(PeribolosVault.NotOwner.selector);
        vault.setTreasury(makeAddr("newTreasury"));
    }

    // ------------------------------------------------------------------
    // sweepIdle
    // ------------------------------------------------------------------

    function test_SweepIdle_AboveFloat_SweepsExactExcess() public {
        uint256 expectedExcess = INITIAL_VAULT_BALANCE - FLOAT_AMOUNT;

        vm.expectEmit(true, true, true, true, address(vault));
        emit Swept(treasuryAddr, expectedExcess);
        vault.sweepIdle();

        assertEq(usdc.balanceOf(treasuryAddr), expectedExcess);
        assertEq(usdc.balanceOf(address(vault)), FLOAT_AMOUNT);
    }

    function test_SweepIdle_AtFloat_NoOp() public {
        // Drain down to exactly the float via a fresh vault so we control
        // the exact balance without depending on cap-limited pay().
        PeribolosVault v = _deployVault(_defaultConfig());
        usdc.mint(address(v), FLOAT_AMOUNT);

        vm.recordLogs();
        v.sweepIdle();
        assertEq(vm.getRecordedLogs().length, 0, "no-op sweep must not emit any event");
        assertEq(usdc.balanceOf(address(v)), FLOAT_AMOUNT);
        assertEq(usdc.balanceOf(treasuryAddr), 0);
    }

    function test_SweepIdle_BelowFloat_NoOp() public {
        PeribolosVault v = _deployVault(_defaultConfig());
        usdc.mint(address(v), FLOAT_AMOUNT - 1e6);

        vm.recordLogs();
        v.sweepIdle();
        assertEq(vm.getRecordedLogs().length, 0, "no-op sweep must not emit any event");
        assertEq(usdc.balanceOf(address(v)), FLOAT_AMOUNT - 1e6);
    }

    function test_SweepIdle_CallableByRandomAddress() public {
        vm.prank(makeAddr("randomStranger"));
        vault.sweepIdle();
        assertEq(usdc.balanceOf(treasuryAddr), INITIAL_VAULT_BALANCE - FLOAT_AMOUNT);
    }

    function test_SweepIdle_TransferReverts_BubblesRawRevert() public {
        usdc.setBlocked(treasuryAddr, true);
        // Not wrapped in try/catch, so the underlying MockUSDC revert
        // bubbles up as-is rather than as SweepTransferFailed.
        vm.expectRevert(abi.encodeWithSelector(MockUSDC.Blocked.selector, treasuryAddr));
        vault.sweepIdle();
    }

    function test_SweepIdle_TransferReturnsFalse_RevertsSweepTransferFailed() public {
        usdc.setReturnFalse(true);
        vm.expectRevert(PeribolosVault.SweepTransferFailed.selector);
        vault.sweepIdle();
    }

    // ------------------------------------------------------------------
    // withdraw
    // ------------------------------------------------------------------

    function test_Withdraw_SendsToOwnerAndEmits() public {
        uint256 amount = 20e6;
        uint256 vaultBalBefore = usdc.balanceOf(address(vault));

        vm.expectEmit(true, true, true, true, address(vault));
        emit Withdrawn(ownerAddr, amount);
        vm.prank(ownerAddr);
        vault.withdraw(amount);

        assertEq(usdc.balanceOf(ownerAddr), amount);
        assertEq(usdc.balanceOf(address(vault)), vaultBalBefore - amount);
    }

    function test_Withdraw_RevertsNotOwner() public {
        vm.prank(attacker);
        vm.expectRevert(PeribolosVault.NotOwner.selector);
        vault.withdraw(1e6);
    }

    function test_Withdraw_TransferReverts_BubblesRawRevert() public {
        usdc.setBlocked(ownerAddr, true);
        vm.prank(ownerAddr);
        vm.expectRevert(abi.encodeWithSelector(MockUSDC.Blocked.selector, ownerAddr));
        vault.withdraw(1e6);
    }

    function test_Withdraw_TransferReturnsFalse_RevertsWithdrawTransferFailed() public {
        usdc.setReturnFalse(true);
        vm.prank(ownerAddr);
        vm.expectRevert(PeribolosVault.WithdrawTransferFailed.selector);
        vault.withdraw(1e6);
    }

    // ------------------------------------------------------------------
    // Protocol fee (feeBps) — defaults to 0 on testnet
    // ------------------------------------------------------------------

    function test_FeeBps_DefaultsToZero() public view {
        assertEq(vault.feeBps(), 0);
        assertEq(vault.feeRecipient(), address(0));
    }

    function test_SetProtocolFee_UpdatesAndEmits() public {
        address feeSink = makeAddr("feeSink");
        vm.expectEmit(true, true, true, true, address(vault));
        emit ProtocolFeeUpdated(100, feeSink); // 1%
        vm.prank(ownerAddr);
        vault.setProtocolFee(100, feeSink);
        assertEq(vault.feeBps(), 100);
        assertEq(vault.feeRecipient(), feeSink);
    }

    function test_SetProtocolFee_RevertsTooHigh() public {
        vm.prank(ownerAddr);
        vm.expectRevert(PeribolosVault.FeeTooHigh.selector);
        vault.setProtocolFee(1001, makeAddr("feeSink"));
    }

    function test_SetProtocolFee_RevertsZeroRecipientWhenActive() public {
        vm.prank(ownerAddr);
        vm.expectRevert(PeribolosVault.ZeroAddress.selector);
        vault.setProtocolFee(50, address(0));
    }

    function test_SetProtocolFee_ClearToZero_AllowsZeroRecipient() public {
        address feeSink = makeAddr("feeSink");
        vm.prank(ownerAddr);
        vault.setProtocolFee(50, feeSink);
        vm.prank(ownerAddr);
        vault.setProtocolFee(0, address(0));
        assertEq(vault.feeBps(), 0);
    }

    function test_Pay_WithProtocolFee_PaysNetAndAccruesFee() public {
        address feeSink = makeAddr("feeSink");
        vm.prank(ownerAddr);
        vault.setProtocolFee(1000, feeSink); // 10%

        uint256 amount = 10e6;
        uint256 fee = 1e6;
        uint256 net = 9e6;
        uint256 vaultBefore = usdc.balanceOf(address(vault));
        uint256 recipientBefore = usdc.balanceOf(recipient1);

        vm.expectEmit(true, true, true, true, address(vault));
        emit ProtocolFeeCollected(recipient1, fee, net);
        vm.expectEmit(true, true, true, true, address(vault));
        emit PaymentExecuted(recipient1, amount, 0, amount);

        assertTrue(_pay(recipient1, amount, 0));
        assertEq(usdc.balanceOf(recipient1), recipientBefore + net);
        assertEq(usdc.balanceOf(feeSink), 0);
        assertEq(vault.accruedProtocolFees(), fee);
        assertEq(usdc.balanceOf(address(vault)), vaultBefore - net);
        assertEq(vault.epochSpent(), amount);

        vault.claimProtocolFees();
        assertEq(usdc.balanceOf(feeSink), fee);
        assertEq(vault.accruedProtocolFees(), 0);
        assertEq(usdc.balanceOf(address(vault)), vaultBefore - amount);
    }

    function test_Pay_WithProtocolFee_RecipientFailureDoesNotMoveFee() public {
        address feeSink = makeAddr("feeSink");
        vm.prank(ownerAddr);
        vault.setProtocolFee(1000, feeSink); // 10%

        usdc.setBlocked(recipient1, true);
        uint256 vaultBefore = usdc.balanceOf(address(vault));

        assertFalse(_pay(recipient1, 10e6, 0));
        assertEq(usdc.balanceOf(address(vault)), vaultBefore);
        assertEq(usdc.balanceOf(feeSink), 0);
        assertEq(vault.accruedProtocolFees(), 0);
    }

    function test_SetProtocolFee_RevertsNotOwner() public {
        vm.prank(attacker);
        vm.expectRevert(PeribolosVault.NotOwner.selector);
        vault.setProtocolFee(10, makeAddr("feeSink"));
    }

    // ------------------------------------------------------------------
    // Constructor validation
    // ------------------------------------------------------------------

    function test_Constructor_RevertsZeroOwner() public {
        PeribolosVault.VaultConfig memory cfg = _defaultConfig();
        vm.expectRevert(PeribolosVault.ZeroAddress.selector);
        new PeribolosVault(address(0), cfg, IERC20(address(usdc)), IIdentityRegistry(address(registry)));
    }

    function test_Constructor_RevertsZeroTreasury() public {
        PeribolosVault.VaultConfig memory cfg = _defaultConfig();
        cfg.treasury = address(0);
        vm.expectRevert(PeribolosVault.ZeroAddress.selector);
        new PeribolosVault(ownerAddr, cfg, IERC20(address(usdc)), IIdentityRegistry(address(registry)));
    }

    function test_Constructor_RevertsZeroAgentKey() public {
        PeribolosVault.VaultConfig memory cfg = _defaultConfig();
        cfg.agentKey = address(0);
        vm.expectRevert(PeribolosVault.ZeroAddress.selector);
        new PeribolosVault(ownerAddr, cfg, IERC20(address(usdc)), IIdentityRegistry(address(registry)));
    }

    function test_Constructor_RevertsPastExpiry() public {
        PeribolosVault.VaultConfig memory cfg = _defaultConfig();
        cfg.agentExpiry = uint64(block.timestamp);
        vm.expectRevert(PeribolosVault.ExpiryInPast.selector);
        new PeribolosVault(ownerAddr, cfg, IERC20(address(usdc)), IIdentityRegistry(address(registry)));
    }

    function test_Constructor_RevertsZeroAllowlistEntry() public {
        PeribolosVault.VaultConfig memory cfg = _defaultConfig();
        address[] memory allowlist = new address[](2);
        allowlist[0] = recipient1;
        allowlist[1] = address(0);
        cfg.allowlist = allowlist;

        vm.expectRevert(PeribolosVault.ZeroAddress.selector);
        new PeribolosVault(ownerAddr, cfg, IERC20(address(usdc)), IIdentityRegistry(address(registry)));
    }

    function test_Constructor_SeedsAllowlistAndEmits() public {
        PeribolosVault.VaultConfig memory cfg = _defaultConfig();

        vm.expectEmit(true, true, true, true);
        emit AllowlistUpdated(recipient1, true);
        vm.expectEmit(true, true, true, true);
        emit AllowlistUpdated(recipient2, true);
        PeribolosVault v = _deployVault(cfg);

        assertTrue(v.allowlist(recipient1));
        assertTrue(v.allowlist(recipient2));
        assertEq(v.owner(), ownerAddr);
        assertEq(v.treasury(), treasuryAddr);
        assertEq(v.agentKey(), agentKeyAddr);
        assertEq(v.factory(), address(this));
    }

    // ------------------------------------------------------------------
    // registerIdentity
    // ------------------------------------------------------------------

    function test_RegisterIdentity_Success() public {
        string memory uri = "ipfs://agent-metadata";

        vm.expectEmit(true, true, true, true, address(vault));
        emit IdentityRegistered(uri);
        vault.registerIdentity(uri); // called by factory (address(this))

        assertTrue(vault.identityRegistered());
        assertEq(registry.ownerOf(1), address(vault));
        assertEq(registry.lastMetadataURI(), uri);
    }

    function test_RegisterIdentity_FailurePath_EmitsFailedDoesNotRevert() public {
        registry.setRevertOnRegister(true);
        string memory uri = "ipfs://agent-metadata";

        vm.expectEmit(true, true, true, true, address(vault));
        emit IdentityRegistrationFailed(uri);
        vault.registerIdentity(uri); // must not revert

        assertFalse(vault.identityRegistered());
    }

    function test_RegisterIdentity_RevertsNotFactoryNotOwner() public {
        vm.prank(attacker);
        vm.expectRevert(PeribolosVault.NotFactory.selector);
        vault.registerIdentity("ipfs://agent-metadata");
    }

    function test_RegisterIdentity_CallableByOwner() public {
        vm.prank(ownerAddr);
        vault.registerIdentity("ipfs://agent-metadata");
        assertTrue(vault.identityRegistered());
    }

    function test_RegisterIdentity_DoubleRegisterAfterSuccess_Reverts() public {
        vault.registerIdentity("ipfs://agent-metadata");
        assertTrue(vault.identityRegistered());

        vm.expectRevert(PeribolosVault.AlreadyRegistered.selector);
        vault.registerIdentity("ipfs://again");
    }

    function test_RegisterIdentity_RetryAfterFailure_Succeeds() public {
        registry.setRevertOnRegister(true);
        vault.registerIdentity("ipfs://agent-metadata");
        assertFalse(vault.identityRegistered());

        // identityRegistered is still false, so a retry is allowed (not
        // AlreadyRegistered) and can succeed once the registry recovers.
        registry.setRevertOnRegister(false);
        vault.registerIdentity("ipfs://agent-metadata");
        assertTrue(vault.identityRegistered());
        assertEq(registry.ownerOf(1), address(vault));
    }

    function test_OnERC721Received_ReturnsSelector() public view {
        bytes4 selector = vault.onERC721Received(address(0), address(0), 1, "");
        assertEq(selector, PeribolosVault.onERC721Received.selector);
    }
}
