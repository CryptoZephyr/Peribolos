// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Minimal ERC-20 surface used by Peribolos.
/// @dev On Arc, the ERC-20 USDC interface (6 decimals) at
///      0x3600000000000000000000000000000000000000 and the native gas balance
///      (18 decimals) are two views of the SAME asset. All Peribolos outbound
///      amounts are denominated in 6-decimal ERC-20 units.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}
