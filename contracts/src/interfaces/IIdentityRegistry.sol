// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice ERC-8004 Identity Registry on Arc testnet.
/// @dev Verified against the official Arc tutorial ("Register your first AI
///      agent"): `register(string)` takes a metadata URI, returns nothing, and
///      mints an ERC-721 identity NFT to the caller. The agentId (tokenId) is
///      recovered off-chain from the same-transaction `Transfer` event.
///      Registry address (Arc testnet): 0x8004A818BFB912233c491871b3d84c89A494BD9e
interface IIdentityRegistry {
    function register(string calldata metadataURI) external;
}
