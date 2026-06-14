// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BackstopAccount} from "./BackstopAccount.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/// @title BackstopAccountFactory
/// @notice Deploys a guarded account (CREATE2) and registers its ERC-8004 identity in one call.
///         The factory holds the freshly-minted identity NFT; the agentId<->account link lives in
///         AccountCreated + the keeper DB (no on-chain reverse getter exists in ERC-8004).
/// @dev    The ERC-8004 IdentityRegistry safe-mints the identity NFT to msg.sender (this factory),
///         so the factory must implement IERC721Receiver or register() reverts ERC721InvalidReceiver.
contract BackstopAccountFactory is IERC721Receiver {
    IIdentityRegistry public immutable identityRegistry;

    event AccountCreated(
        address indexed account,
        address indexed owner,
        address indexed guardian,
        uint256 agentId,
        string agentURI
    );

    constructor(address _identityRegistry) {
        identityRegistry = IIdentityRegistry(_identityRegistry);
    }

    function createAccount(
        address owner,
        address guardian,
        uint256 recoveryDelayBlocks,
        string calldata agentURI
    ) external returns (address account, uint256 agentId) {
        bytes32 salt = keccak256(abi.encodePacked(owner, guardian));
        account = address(new BackstopAccount{salt: salt}(owner, guardian, recoveryDelayBlocks));
        agentId = identityRegistry.register(agentURI);
        emit AccountCreated(account, owner, guardian, agentId, agentURI);
    }

    /// @notice Deterministic address of the account for (owner, guardian, recoveryDelayBlocks).
    function computeAddress(address owner, address guardian, uint256 recoveryDelayBlocks)
        external
        view
        returns (address)
    {
        bytes32 salt = keccak256(abi.encodePacked(owner, guardian));
        bytes32 initHash = keccak256(
            abi.encodePacked(
                type(BackstopAccount).creationCode,
                abi.encode(owner, guardian, recoveryDelayBlocks)
            )
        );
        bytes32 h = keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, initHash));
        return address(uint160(uint256(h)));
    }

    /// @notice Accept the ERC-8004 identity NFT minted to this factory by register().
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
