// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IIdentityRegistry} from "../../src/interfaces/IIdentityRegistry.sol";

interface IERC721ReceiverLike {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data)
        external
        returns (bytes4);
}

/// @notice Mock ERC-8004-style identity registry for Peribolos tests.
/// @dev `register` sequentially mints a tokenId to `msg.sender` and, if the
///      caller is a contract, performs an ERC-721-style safe-mint callback
///      exactly like the real registry would — this exercises the vault's
///      `onERC721Received` hook and reverts with `UnsafeRecipient` if the
///      wrong selector is returned. `setRevertOnRegister` simulates a
///      registry-side failure for testing the vault's best-effort
///      try/catch path in `registerIdentity`.
contract MockIdentityRegistry is IIdentityRegistry {
    uint256 public nextTokenId = 1;
    mapping(uint256 => address) public ownerOf;
    string public lastMetadataURI;
    bool public revertOnRegister;

    event Registered(address indexed to, uint256 indexed tokenId, string metadataURI);

    error RegistrationDisabled();
    error UnsafeRecipient();

    function setRevertOnRegister(bool enabled) external {
        revertOnRegister = enabled;
    }

    function register(string calldata metadataURI) external override {
        if (revertOnRegister) revert RegistrationDisabled();

        uint256 tokenId = nextTokenId++;
        ownerOf[tokenId] = msg.sender;
        lastMetadataURI = metadataURI;

        if (msg.sender.code.length > 0) {
            bytes4 ret = IERC721ReceiverLike(msg.sender).onERC721Received(msg.sender, address(0), tokenId, "");
            if (ret != IERC721ReceiverLike.onERC721Received.selector) revert UnsafeRecipient();
        }

        emit Registered(msg.sender, tokenId, metadataURI);
    }
}
