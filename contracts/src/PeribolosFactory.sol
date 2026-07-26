// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "./interfaces/IERC20.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";
import {PeribolosVault} from "./PeribolosVault.sol";

/// @title PeribolosFactory — deploys one PeribolosVault per Domain.
/// @notice One small vault per domain, never a shared pool: fund isolation,
///         simple accounting, and every user gets their own address on
///         Arcscan. Per-domain deployment gas on Arc (~$0.001) makes
///         isolation effectively free.
/// @dev One-step funding: `createDomain` is payable. On Arc, `msg.value` is
///      native USDC (18 decimals) — the SAME asset as ERC-20 USDC — so a
///      single value-bearing call funds the agent's gas sliver and the
///      vault's treasury in one transaction, with no approve/transferFrom
///      ceremony. (In local tests the native token is plain ETH; the
///      single-asset behavior only exists on a real Arc endpoint.)
contract PeribolosFactory {
    IERC20 public immutable usdc;
    IIdentityRegistry public immutable identityRegistry;

    mapping(address => address[]) private _domainsOf;

    event DomainCreated(
        address indexed vault, address indexed owner, address indexed agentKey, string agentMetadataURI
    );

    error InsufficientValue();
    error AgentGasTransferFailed();
    error VaultFundingFailed();

    constructor(IERC20 usdc_, IIdentityRegistry identityRegistry_) {
        usdc = usdc_;
        identityRegistry = identityRegistry_;
    }

    /// @param cfg               Vault configuration (rules, agent key, treasury, allowlist).
    /// @param agentMetadataURI  ERC-8004 metadata URI registered for the agent identity.
    /// @param agentGasWei       Native amount (18-dec) forwarded to the agent EOA
    ///                          for transaction gas; remainder of msg.value funds the vault.
    /// @return vault            The deployed PeribolosVault address.
    function createDomain(
        PeribolosVault.VaultConfig calldata cfg,
        string calldata agentMetadataURI,
        uint256 agentGasWei
    ) external payable returns (address vault) {
        if (msg.value < agentGasWei) revert InsufficientValue();

        PeribolosVault deployed = new PeribolosVault(msg.sender, cfg, usdc, identityRegistry);
        vault = address(deployed);

        // Best-effort ERC-8004 registration (vault holds its own identity NFT).
        deployed.registerIdentity(agentMetadataURI);

        // Forward the agent's gas sliver. Agent keys are EOAs (code-less
        // addresses always accept native sends on Arc).
        if (agentGasWei > 0) {
            (bool okAgent,) = cfg.agentKey.call{value: agentGasWei}("");
            if (!okAgent) revert AgentGasTransferFailed();
        }

        // Remainder funds the vault. On Arc this credits the vault's USDC
        // balance directly (native and ERC-20 USDC are one asset).
        uint256 remainder = msg.value - agentGasWei;
        if (remainder > 0) {
            (bool okVault,) = vault.call{value: remainder}("");
            if (!okVault) revert VaultFundingFailed();
        }

        _domainsOf[msg.sender].push(vault);
        emit DomainCreated(vault, msg.sender, cfg.agentKey, agentMetadataURI);
    }

    /// @notice All vaults ever created by `domainOwner` (dashboard enumeration).
    function domainsOf(address domainOwner) external view returns (address[] memory) {
        return _domainsOf[domainOwner];
    }
}
