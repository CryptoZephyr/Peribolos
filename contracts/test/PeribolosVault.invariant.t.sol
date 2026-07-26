// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {PeribolosVault} from "../src/PeribolosVault.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {MockIdentityRegistry} from "./mocks/MockIdentityRegistry.sol";
import {PeribolosVaultHandler} from "./handlers/PeribolosVaultHandler.sol";

contract PeribolosVaultInvariantTest is Test {
    PeribolosVault internal vault;
    MockUSDC internal usdc;
    MockIdentityRegistry internal registry;
    PeribolosVaultHandler internal handler;

    address internal ownerAddr = makeAddr("owner");
    address internal treasuryAddr = makeAddr("treasury");
    address internal agentKeyAddr = makeAddr("agentKey");
    address internal recipient1 = makeAddr("recipient1");
    address internal recipient2 = makeAddr("recipient2");
    address internal notAllowlisted = makeAddr("notAllowlisted");

    uint128 internal constant PER_TX_CAP = 10e6;
    uint128 internal constant DAILY_CAP = 25e6;
    uint128 internal constant FLOAT_AMOUNT = 50e6;
    uint256 internal constant ALLOWED_ACTIONS = 3;
    uint256 internal constant INITIAL_VAULT_BALANCE = 5_000e6;

    uint256 internal vaultInitialBalance;

    function setUp() public {
        usdc = new MockUSDC();
        registry = new MockIdentityRegistry();

        address[] memory allowlist = new address[](2);
        allowlist[0] = recipient1;
        allowlist[1] = recipient2;

        PeribolosVault.VaultConfig memory cfg = PeribolosVault.VaultConfig({
            treasury: treasuryAddr,
            agentKey: agentKeyAddr,
            agentExpiry: uint64(block.timestamp + 365 days),
            perTxCap: PER_TX_CAP,
            dailyCap: DAILY_CAP,
            floatAmount: FLOAT_AMOUNT,
            allowedActions: ALLOWED_ACTIONS,
            allowlist: allowlist
        });

        vault = new PeribolosVault(ownerAddr, cfg, IERC20(address(usdc)), IIdentityRegistry(address(registry)));
        usdc.mint(address(vault), INITIAL_VAULT_BALANCE);
        vaultInitialBalance = usdc.balanceOf(address(vault));

        // Includes a non-allowlisted recipient so the handler also
        // exercises (harmlessly) the RECIPIENT_NOT_ALLOWLISTED path.
        address[] memory handlerRecipients = new address[](3);
        handlerRecipients[0] = recipient1;
        handlerRecipients[1] = recipient2;
        handlerRecipients[2] = notAllowlisted;

        handler =
            new PeribolosVaultHandler(vault, usdc, agentKeyAddr, ownerAddr, treasuryAddr, handlerRecipients, PER_TX_CAP);

        // Restrict the invariant fuzzer to the handler's bounded action
        // surface (pay / sweepIdle / withdraw / togglePause / warp) instead
        // of calling the vault directly with unconstrained inputs.
        targetContract(address(handler));
    }

    /// I1: the vault's USDC balance only ever decreases via transfers to
    /// allowlisted recipients (pay), the treasury (sweepIdle), or the owner
    /// (withdraw). The handler tracks every such outflow; the drop in vault
    /// balance since the initial funding must exactly equal the sum of
    /// tracked outflows — no unaccounted-for balance movement is possible.
    function invariant_VaultOutflowsAreFullyAccountedFor() public view {
        uint256 currentBalance = usdc.balanceOf(address(vault));
        uint256 trackedOutflows = handler.totalPaidOut() + handler.totalSwept() + handler.totalWithdrawn();
        assertEq(vaultInitialBalance - currentBalance, trackedOutflows);
    }

    /// I2: epochSpent must never exceed dailyCap.
    function invariant_EpochSpentNeverExceedsDailyCap() public view {
        assertLe(vault.epochSpent(), vault.dailyCap());
    }

    /// I3: no PaymentExecuted is ever possible while the vault is paused.
    function invariant_NoPaymentExecutedWhilePaused() public view {
        assertFalse(handler.pausedPaymentExecuted());
    }

    /// Guards against a vacuously-true run where the fuzzer never actually
    /// exercised pay() (e.g. a misconfigured target selector). Checked only
    /// via afterInvariant so it doesn't fail the baseline pre-call check.
    function afterInvariant() public view {
        assertGt(handler.payCalls(), 0, "handler.pay was never called during the run");
    }
}
