// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Min {
    function balanceOf(address) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

/// @title BackstopSimulator
/// @notice NEVER DEPLOYED. The keeper injects this contract's deployedBytecode at the guarded
///         account's address via an eth_call `code` state-override, then calls `simulate(...)`.
///         Because the override is at the account address, the inner pending call runs with
///         msg.sender == account — identical to production execution.
contract BackstopSimulator {
    struct SimResult {
        int256 nativeSelfDelta;
        int256[] tokenSelfDeltas;
        int256[] allowanceDeltas;
        bool execOk;
        bytes returnData;
    }

    function simulate(
        address to,
        uint256 value,
        bytes calldata data,
        address[] calldata watchedTokens,
        address[] calldata allowanceTokens,
        address[] calldata allowanceSpenders
    ) external returns (SimResult memory r) {
        // ---- snapshot (address(this) == the guarded account; override is at its address) ----
        uint256 nativeBefore = address(this).balance;
        uint256[] memory tokBefore = new uint256[](watchedTokens.length);
        for (uint256 i = 0; i < watchedTokens.length; ++i) {
            tokBefore[i] = _bal(watchedTokens[i], address(this));
        }
        uint256[] memory allowBefore = new uint256[](allowanceTokens.length);
        for (uint256 i = 0; i < allowanceTokens.length; ++i) {
            allowBefore[i] = _allow(allowanceTokens[i], address(this), allowanceSpenders[i]);
        }

        // ---- execute the pending call AS the account (helper keeps ok/ret off the main stack) ----
        (r.execOk, r.returnData) = _exec(to, value, data);

        // ---- re-read + signed deltas ----
        r.nativeSelfDelta = _diff(address(this).balance, nativeBefore);
        r.tokenSelfDeltas = new int256[](watchedTokens.length);
        for (uint256 i = 0; i < watchedTokens.length; ++i) {
            r.tokenSelfDeltas[i] = _diff(_bal(watchedTokens[i], address(this)), tokBefore[i]);
        }
        r.allowanceDeltas = new int256[](allowanceTokens.length);
        for (uint256 i = 0; i < allowanceTokens.length; ++i) {
            r.allowanceDeltas[i] = _diff(_allow(allowanceTokens[i], address(this), allowanceSpenders[i]), allowBefore[i]);
        }
    }

    function _exec(address to, uint256 value, bytes calldata data) private returns (bool, bytes memory) {
        return to.call{value: value}(data);
    }

    function _bal(address token, address who) private view returns (uint256) {
        (bool ok, bytes memory d) =
            token.staticcall(abi.encodeWithSelector(IERC20Min.balanceOf.selector, who));
        if (!ok || d.length < 32) return 0;
        return abi.decode(d, (uint256));
    }

    function _allow(address token, address ownr, address spender) private view returns (uint256) {
        (bool ok, bytes memory d) =
            token.staticcall(abi.encodeWithSelector(IERC20Min.allowance.selector, ownr, spender));
        if (!ok || d.length < 32) return 0;
        return abi.decode(d, (uint256));
    }

    function _diff(uint256 post, uint256 pre) private pure returns (int256) {
        if (post >= pre) return int256(post - pre);
        return -int256(pre - post);
    }
}
