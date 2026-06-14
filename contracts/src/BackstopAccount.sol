// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title BackstopAccount
/// @notice Smart account whose owner (an AI agent key) can only PROPOSE calls.
///         A call only executes if it carries the guardian's EIP-712 co-signature.
///         The guardian can only veto (emit Blocked + burn the nonce) — never move funds.
///         If the guardian goes silent for `recoveryDelayBlocks`, the owner may act alone.
contract BackstopAccount is EIP712 {
    /// @dev EIP-712 type hash for a proposed call. `data` is hashed per EIP-712 dynamic-bytes rules.
    bytes32 public constant CALL_TYPEHASH =
        keccak256("Call(address to,uint256 value,bytes data,uint256 nonce)");

    address public immutable owner;     // the agent key — propose-only
    address public immutable guardian;  // the Backstop keeper — veto-only co-signer
    uint256 public immutable recoveryDelayBlocks;

    uint256 public nonce;               // monotonic; prevents replay; advanced by execute/timeout/veto
    uint256 public lastActivityBlock;   // updated ONLY by owner actions (execute/executeAfterTimeout)

    event CoSigned(uint256 indexed nonce, address indexed to, uint256 value, bytes data);
    event Blocked(uint256 indexed nonce, address indexed to, bytes32 callHash, string reason);
    event RecoveryExecuted(uint256 indexed nonce, address indexed to, uint256 value);

    error NotOwner();
    error NotGuardian();
    error BadGuardianSig();
    error CallReverted(bytes returnData);
    error TooEarly(uint256 unlockBlock);
    error NonceMismatch(uint256 expected, uint256 provided);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyGuardian() {
        if (msg.sender != guardian) revert NotGuardian();
        _;
    }

    constructor(address _owner, address _guardian, uint256 _recoveryDelayBlocks)
        EIP712("Backstop", "1")
    {
        owner = _owner;
        guardian = _guardian;
        recoveryDelayBlocks = _recoveryDelayBlocks;
        lastActivityBlock = block.number;
    }

    receive() external payable {}

    /// @notice Owner executes a call ONLY if it carries the guardian's co-signature over
    ///         (to, value, data, currentNonce). Reverts otherwise. Nonce burned before the
    ///         external call (checks-effects-interactions / replay-safe).
    function execute(address to, uint256 value, bytes calldata data, bytes calldata guardianSig)
        external
        onlyOwner
        returns (bytes memory)
    {
        bytes32 structHash =
            keccak256(abi.encode(CALL_TYPEHASH, to, value, keccak256(data), nonce));
        bytes32 digest = _hashTypedDataV4(structHash);
        if (ECDSA.recover(digest, guardianSig) != guardian) revert BadGuardianSig();

        uint256 executed = nonce;
        nonce = executed + 1;            // effects before interactions
        lastActivityBlock = block.number;

        (bool ok, bytes memory ret) = to.call{value: value}(data);
        if (!ok) revert CallReverted(ret);

        emit CoSigned(executed, to, value, data);
        return ret;
    }

    /// @notice Liveness escape: if the guardian has not let the owner act for
    ///         `recoveryDelayBlocks`, the owner may execute without a co-signature.
    ///         A silent/compromised guardian can therefore never permanently freeze funds.
    function executeAfterTimeout(address to, uint256 value, bytes calldata data)
        external
        onlyOwner
        returns (bytes memory)
    {
        uint256 unlockBlock = lastActivityBlock + recoveryDelayBlocks;
        if (block.number < unlockBlock) revert TooEarly(unlockBlock);

        uint256 executed = nonce;
        nonce = executed + 1;
        lastActivityBlock = block.number;

        (bool ok, bytes memory ret) = to.call{value: value}(data);
        if (!ok) revert CallReverted(ret);

        emit RecoveryExecuted(executed, to, value);
        return ret;
    }

    /// @notice Guardian vetoes the pending proposal at `vetoNonce`: burns the nonce so the
    ///         vetoed call can never execute, and records an on-chain Blocked artifact.
    ///         NEVER touches funds and NEVER updates lastActivityBlock (so a rogue guardian
    ///         cannot extend the recovery window) — this is the veto-only invariant.
    function guardianVeto(uint256 vetoNonce, address to, bytes32 callHash, string calldata reason)
        external
        onlyGuardian
    {
        if (vetoNonce != nonce) revert NonceMismatch(nonce, vetoNonce);
        nonce = vetoNonce + 1; // burn the proposed nonce; does NOT touch lastActivityBlock
        emit Blocked(vetoNonce, to, callHash, reason);
    }
}
