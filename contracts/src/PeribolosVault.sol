// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "./interfaces/IERC20.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";

/// @title PeribolosVault — a rule-enforced USDC spending environment for one AI agent.
/// @notice The wall the agent cannot talk its way through. The agent key can do
///         exactly two things: ask the vault to pay (`pay`) and trigger the
///         permissionless idle-fund sweep (`sweepIdle`, callable by anyone).
///         Every rule violation is recorded on-chain as a `PaymentBlocked`
///         event — `pay` never reverts on a rule failure, so attack attempts
///         become permanent, publicly verifiable history.
/// @dev Arc-specific facts this contract is written against:
///      - ERC-20 USDC (6 decimals) and the native gas balance (18 decimals)
///        are the same asset. All amounts here are 6-decimal ERC-20 units.
///        `receive()` accepts native sends because funding the vault with
///        native USDC IS funding its ERC-20 balance.
///      - A USDC transfer can revert at runtime (e.g. blocklisted address),
///        so the outbound transfer is wrapped in try/catch and surfaces as
///        `TRANSFER_FAILED` instead of reverting the whole call.
///      - The ERC-8004 IdentityRegistry mints an identity NFT to the caller;
///        the vault registers itself, so it must accept a potential
///        ERC-721 safe-mint callback (`onERC721Received`).
contract PeribolosVault {
    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------

    enum BlockReason {
        NONE, // 0 — never emitted
        RECIPIENT_NOT_ALLOWLISTED, // 1
        EXCEEDS_PER_TX_CAP, // 2
        EXCEEDS_DAILY_CAP, // 3
        ACTION_NOT_ALLOWED, // 4
        AGENT_KEY_EXPIRED, // 5
        VAULT_PAUSED, // 6
        INSUFFICIENT_BALANCE, // 7
        TRANSFER_FAILED // 8
    }

    struct VaultConfig {
        address treasury; // where sweeps and idle funds return to
        address agentKey; // the ONLY address allowed to call pay()
        uint64 agentExpiry; // unix timestamp after which the agent key is dead
        uint128 perTxCap; // 6-dec USDC
        uint128 dailyCap; // 6-dec USDC, per fixed UTC-day epoch
        uint128 floatAmount; // 6-dec USDC the vault keeps; excess is sweepable
        uint256 allowedActions; // bitmap: bit i set => actionType i allowed
        address[] allowlist; // initial recipient allowlist
    }

    // ------------------------------------------------------------------
    // Storage
    // ------------------------------------------------------------------

    address public immutable factory;
    IERC20 public immutable usdc;
    IIdentityRegistry public immutable identityRegistry;

    address public owner;
    address public treasury;
    address public agentKey;
    uint64 public agentExpiry;
    bool public paused;
    bool public identityRegistered;

    uint128 public perTxCap;
    uint128 public dailyCap;
    uint128 public floatAmount;
    uint256 public allowedActions;

    /// @notice Protocol fee in basis points on successful vault-tier pays (0 = off).
    /// @dev Spec v3.1: testnet deploys leave this at 0; owner can activate later (max 10%).
    uint16 public feeBps;
    /// @notice Recipient of protocol fees when feeBps > 0.
    address public feeRecipient;
    /// @notice Protocol fees accrued from successful pays and reserved from sweeps/owner withdrawals.
    uint256 public accruedProtocolFees;

    mapping(address => bool) public allowlist;

    /// @dev Fixed UTC-day epochs (block.timestamp / 1 days) — deliberately not
    ///      a rolling window; simple, cheap, and explainable.
    uint64 public currentEpoch;
    uint128 public epochSpent;

    uint256 private _reentrancyLock = 1;

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    event PaymentExecuted(address indexed to, uint256 amount, uint8 indexed actionType, uint256 epochSpent);
    event PaymentBlocked(address indexed to, uint256 amount, uint8 indexed actionType, BlockReason indexed reason);
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

    // ------------------------------------------------------------------
    // Errors (owner/agent access paths revert; rule violations never do)
    // ------------------------------------------------------------------

    error NotOwner();
    error NotAgent();
    error NotFactory();
    error ZeroAddress();
    error AlreadyRegistered();
    error Reentrancy();
    error SweepTransferFailed();
    error WithdrawTransferFailed();
    error ExpiryInPast();
    error FeeTooHigh();
    error InsufficientUnreservedBalance();

    // ------------------------------------------------------------------
    // Modifiers
    // ------------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_reentrancyLock != 1) revert Reentrancy();
        _reentrancyLock = 2;
        _;
        _reentrancyLock = 1;
    }

    // ------------------------------------------------------------------
    // Construction
    // ------------------------------------------------------------------

    constructor(address owner_, VaultConfig memory cfg, IERC20 usdc_, IIdentityRegistry registry_) {
        if (owner_ == address(0) || cfg.treasury == address(0) || cfg.agentKey == address(0)) {
            revert ZeroAddress();
        }
        if (cfg.agentExpiry <= block.timestamp) revert ExpiryInPast();

        factory = msg.sender;
        usdc = usdc_;
        identityRegistry = registry_;

        owner = owner_;
        treasury = cfg.treasury;
        agentKey = cfg.agentKey;
        agentExpiry = cfg.agentExpiry;
        perTxCap = cfg.perTxCap;
        dailyCap = cfg.dailyCap;
        floatAmount = cfg.floatAmount;
        allowedActions = cfg.allowedActions;

        for (uint256 i = 0; i < cfg.allowlist.length; i++) {
            address recipient = cfg.allowlist[i];
            if (recipient == address(0)) revert ZeroAddress();
            allowlist[recipient] = true;
            emit AllowlistUpdated(recipient, true);
        }
    }

    /// @notice Accept native USDC funding (native and ERC-20 USDC are the same
    ///         asset on Arc, so a native send credits the ERC-20 balance).
    receive() external payable {}

    // ------------------------------------------------------------------
    // Agent path
    // ------------------------------------------------------------------

    /// @notice The agent's single capability: request a payment. Rule
    ///         violations DO NOT revert — they emit `PaymentBlocked` and
    ///         return false, making every attack attempt permanent on-chain
    ///         evidence (the agent pays its own ~$0.001 gas for the attempt,
    ///         which self-limits spam).
    /// @return executed true if the payment was made, false if blocked.
    function pay(address to, uint256 amount, uint8 actionType) external nonReentrant returns (bool executed) {
        if (msg.sender != agentKey) revert NotAgent();

        BlockReason reason = _checkRules(to, amount, actionType);
        if (reason != BlockReason.NONE) {
            emit PaymentBlocked(to, amount, actionType, reason);
            return false;
        }

        // Effects: epoch accounting before the external call.
        // Daily cap tracks the full proposed amount (fee included).
        uint64 today = uint64(block.timestamp / 1 days);
        uint128 spentBefore = (today == currentEpoch) ? epochSpent : 0;
        currentEpoch = today;
        // Safe cast: _checkRules guarantees amount <= perTxCap (uint128).
        epochSpent = spentBefore + uint128(amount);

        // Protocol fee (0 on testnet by default). Collect fee first, then net
        // to the recipient — so a blocked recipient never receives funds while
        // a fee is already taken. feeBps ships at 0; owner activates later.
        uint256 fee = feeBps == 0 ? 0 : (amount * uint256(feeBps)) / 10_000;
        uint256 net = amount - fee;

        if (!_safeTransfer(to, net)) {
            epochSpent = spentBefore;
            emit PaymentBlocked(to, amount, actionType, BlockReason.TRANSFER_FAILED);
            return false;
        }

        if (fee > 0) {
            accruedProtocolFees += fee;
            emit ProtocolFeeCollected(to, fee, net);
        }
        emit PaymentExecuted(to, amount, actionType, epochSpent);
        return true;
    }

    /// @dev Best-effort ERC-20 transfer; never reverts (Arc blocklist / return-false).
    function _safeTransfer(address to, uint256 amount) internal returns (bool ok) {
        if (amount == 0) return true;
        try usdc.transfer(to, amount) returns (bool success) {
            return success;
        } catch {
            return false;
        }
    }

    /// @dev Rule checks in fixed order; first failure wins. View-only.
    function _checkRules(address to, uint256 amount, uint8 actionType) internal view returns (BlockReason) {
        if (paused) return BlockReason.VAULT_PAUSED;
        if (block.timestamp > agentExpiry) return BlockReason.AGENT_KEY_EXPIRED;
        if (allowedActions & (1 << actionType) == 0) return BlockReason.ACTION_NOT_ALLOWED;
        if (!allowlist[to]) return BlockReason.RECIPIENT_NOT_ALLOWLISTED;
        if (amount > perTxCap) return BlockReason.EXCEEDS_PER_TX_CAP;

        uint64 today = uint64(block.timestamp / 1 days);
        uint256 spent = (today == currentEpoch) ? epochSpent : 0;
        if (spent + amount > dailyCap) return BlockReason.EXCEEDS_DAILY_CAP;

        if (usdc.balanceOf(address(this)) < amount) return BlockReason.INSUFFICIENT_BALANCE;
        return BlockReason.NONE;
    }

    // ------------------------------------------------------------------
    // Permissionless keeper
    // ------------------------------------------------------------------

    /// @notice Anyone may trigger the idle-fund sweep; funds can only move to
    ///         the owner-configured treasury, so it is always safe to call.
    /// @dev Unlike `pay()`, sweep and withdraw revert loudly on transfer
    ///      failure (no try/catch) — these are owner/keeper paths where a
    ///      failure (e.g. blocklisted treasury) must surface, not be logged.
    function sweepIdle() external nonReentrant {
        uint256 balance = usdc.balanceOf(address(this));
        uint256 unreserved = balance > accruedProtocolFees ? balance - accruedProtocolFees : 0;
        if (unreserved <= floatAmount) return;
        uint256 excess = unreserved - floatAmount;
        if (!usdc.transfer(treasury, excess)) revert SweepTransferFailed();
        emit Swept(treasury, excess);
    }

    // ------------------------------------------------------------------
    // Owner path
    // ------------------------------------------------------------------

    function setRules(uint128 perTxCap_, uint128 dailyCap_, uint128 floatAmount_, uint256 allowedActions_)
        external
        onlyOwner
    {
        perTxCap = perTxCap_;
        dailyCap = dailyCap_;
        floatAmount = floatAmount_;
        allowedActions = allowedActions_;
        emit RulesUpdated(perTxCap_, dailyCap_, floatAmount_, allowedActions_);
    }

    function setAllowlist(address[] calldata recipients, bool allowed) external onlyOwner {
        for (uint256 i = 0; i < recipients.length; i++) {
            address recipient = recipients[i];
            if (recipient == address(0)) revert ZeroAddress();
            allowlist[recipient] = allowed;
            emit AllowlistUpdated(recipient, allowed);
        }
    }

    function pause() external onlyOwner {
        paused = true;
        emit VaultPaused();
    }

    function unpause() external onlyOwner {
        paused = false;
        emit VaultUnpaused();
    }

    function rotateAgentKey(address newAgentKey, uint64 newExpiry) external onlyOwner {
        if (newAgentKey == address(0)) revert ZeroAddress();
        if (newExpiry <= block.timestamp) revert ExpiryInPast();
        agentKey = newAgentKey;
        agentExpiry = newExpiry;
        emit AgentKeyRotated(newAgentKey, newExpiry);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    /// @notice Activate or clear the protocol fee. Testnet ships with feeBps=0.
    /// @param feeBps_ Basis points of each successful pay (max 1000 = 10%).
    /// @param feeRecipient_ Must be non-zero when feeBps_ > 0.
    function setProtocolFee(uint16 feeBps_, address feeRecipient_) external onlyOwner {
        if (feeBps_ > 1_000) revert FeeTooHigh();
        if (feeBps_ > 0 && feeRecipient_ == address(0)) revert ZeroAddress();
        if (accruedProtocolFees > 0 && feeRecipient_ == address(0)) revert ZeroAddress();
        feeBps = feeBps_;
        feeRecipient = feeRecipient_;
        emit ProtocolFeeUpdated(feeBps_, feeRecipient_);
    }

    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        uint256 balance = usdc.balanceOf(address(this));
        uint256 unreserved = balance > accruedProtocolFees ? balance - accruedProtocolFees : 0;
        if (amount > unreserved) revert InsufficientUnreservedBalance();
        if (!usdc.transfer(owner, amount)) revert WithdrawTransferFailed();
        emit Withdrawn(owner, amount);
    }

    function claimProtocolFees() external nonReentrant {
        uint256 amount = accruedProtocolFees;
        if (amount == 0) return;
        if (feeRecipient == address(0)) revert ZeroAddress();
        accruedProtocolFees = 0;
        if (!usdc.transfer(feeRecipient, amount)) {
            accruedProtocolFees = amount;
            revert WithdrawTransferFailed();
        }
        emit Withdrawn(feeRecipient, amount);
    }

    // ------------------------------------------------------------------
    // Identity (ERC-8004)
    // ------------------------------------------------------------------

    /// @notice Registers this vault as the agent's on-chain identity. The
    ///         identity NFT mints to the vault itself — the vault is the
    ///         agent's on-chain body. Best-effort: a registry failure must
    ///         never brick domain creation.
    function registerIdentity(string calldata metadataURI) external {
        if (msg.sender != factory && msg.sender != owner) revert NotFactory();
        if (identityRegistered) revert AlreadyRegistered();

        try identityRegistry.register(metadataURI) {
            identityRegistered = true;
            emit IdentityRegistered(metadataURI);
        } catch {
            emit IdentityRegistrationFailed(metadataURI);
        }
    }

    /// @notice Accept ERC-721 safe-mints (the ERC-8004 registry mints the
    ///         identity NFT to this vault).
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
