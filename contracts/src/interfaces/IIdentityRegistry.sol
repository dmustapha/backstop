// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal ERC-8004 IdentityRegistry surface used by the factory.
///         Sepolia: 0x8004A818BFB912233c491871b3d84c89A494BD9e
///         Mainnet: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
interface IIdentityRegistry {
    /// @return agentId ERC-721 tokenId (starts at 0); minted to msg.sender; permissionless.
    function register(string calldata agentURI) external returns (uint256 agentId);

    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
}
