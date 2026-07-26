// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "../../src/interfaces/IERC20.sol";

/// @notice Minimal mock USDC (6 decimals) for Peribolos tests.
/// @dev Simulates two distinct Arc-relevant `transfer` failure modes:
///
///      1. "revert" mode via `setBlocked` — a runtime blocklist that makes
///         `transfer` REVERT when either the sender or recipient is
///         blocked, mirroring Arc's native USDC blocklist.
///      2. "returns false" mode via `setReturnFalse` — makes every
///         `transfer` return false without reverting, so the vault's
///         return-value handling path can be tested independently of the
///         revert/try-catch path.
///
///      Insufficient balance reverts via plain arithmetic underflow
///      (checked in 0.8.x), matching how a minimal real ERC-20 behaves.
contract MockUSDC is IERC20 {
    string public constant name = "Mock USDC";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;

    mapping(address => uint256) public balanceOf;
    mapping(address => bool) public blocked;
    bool public returnFalseMode;

    event Transfer(address indexed from, address indexed to, uint256 amount);

    error Blocked(address account);

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function setBlocked(address account, bool isBlocked) external {
        blocked[account] = isBlocked;
    }

    function setReturnFalse(bool enabled) external {
        returnFalseMode = enabled;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (blocked[msg.sender]) revert Blocked(msg.sender);
        if (blocked[to]) revert Blocked(to);

        if (returnFalseMode) return false;

        // Reverts on underflow (insufficient balance) exactly like a
        // standard checked-arithmetic ERC-20, mirroring real USDC.
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
}
