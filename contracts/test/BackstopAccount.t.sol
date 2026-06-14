// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BackstopAccount} from "../src/BackstopAccount.sol";

contract Target {
    uint256 public x;
    function setX(uint256 v) external payable { x = v; }
}

contract BackstopAccountTest is Test {
    BackstopAccount acct;
    Target target;

    uint256 ownerPk = 0xA11CE;
    uint256 guardianPk = 0xB0B;
    address owner;
    address guardian;
    uint256 constant DELAY = 100;

    bytes32 constant CALL_TYPEHASH =
        keccak256("Call(address to,uint256 value,bytes data,uint256 nonce)");

    function setUp() public {
        owner = vm.addr(ownerPk);
        guardian = vm.addr(guardianPk);
        acct = new BackstopAccount(owner, guardian, DELAY);
        target = new Target();
        vm.deal(address(acct), 10 ether);
    }

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("Backstop")), keccak256(bytes("1")), block.chainid, address(acct)
        ));
    }

    function _structHash(address to, uint256 value, bytes memory data, uint256 nonce)
        internal pure returns (bytes32)
    {
        return keccak256(abi.encode(CALL_TYPEHASH, to, value, keccak256(data), nonce));
    }

    function _digest(address to, uint256 value, bytes memory data, uint256 nonce)
        internal view returns (bytes32)
    {
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), _structHash(to, value, data, nonce)));
    }

    function _sign(uint256 pk, address to, uint256 value, bytes memory data, uint256 nonce)
        internal view returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, _digest(to, value, data, nonce));
        return abi.encodePacked(r, s, v);
    }

    // (a) execute reverts without a guardian signature (wrong signer)
    function test_a_NoSig_Reverts() public {
        bytes memory data = abi.encodeWithSelector(Target.setX.selector, 42);
        bytes memory badSig = _sign(ownerPk, address(target), 0, data, 0); // signed by owner, not guardian
        vm.prank(owner);
        vm.expectRevert(BackstopAccount.BadGuardianSig.selector);
        acct.execute(address(target), 0, data, badSig);
    }

    // (b) wrong (to,value,data,nonce) struct reverts
    function test_b_WrongStruct_Reverts() public {
        bytes memory data = abi.encodeWithSelector(Target.setX.selector, 42);
        bytes memory sig = _sign(guardianPk, address(target), 0, data, 0);
        // tamper value: contract recomputes with value=1, recovered signer != guardian
        vm.prank(owner);
        vm.expectRevert(BackstopAccount.BadGuardianSig.selector);
        acct.execute(address(target), 1, data, sig);
    }

    // (c) nonce replay reverts
    function test_c_Replay_Reverts() public {
        bytes memory data = abi.encodeWithSelector(Target.setX.selector, 7);
        bytes memory sig0 = _sign(guardianPk, address(target), 0, data, 0);
        vm.prank(owner);
        acct.execute(address(target), 0, data, sig0); // nonce 0 -> 1
        assertEq(target.x(), 7);
        vm.prank(owner);
        vm.expectRevert(BackstopAccount.BadGuardianSig.selector); // sig over nonce 0 invalid now
        acct.execute(address(target), 0, data, sig0);
    }

    // (d) executeAfterTimeout reverts before N, succeeds after
    function test_d_Timeout() public {
        bytes memory data = abi.encodeWithSelector(Target.setX.selector, 99);
        vm.prank(owner);
        vm.expectRevert(); // TooEarly
        acct.executeAfterTimeout(address(target), 0, data);

        vm.roll(block.number + DELAY);
        vm.prank(owner);
        acct.executeAfterTimeout(address(target), 0, data);
        assertEq(target.x(), 99);
    }

    // (e) guardian cannot move funds via ANY path
    function test_e_GuardianCannotMoveFunds() public {
        uint256 balBefore = address(acct).balance;
        // guardian has no execute access
        bytes memory data = abi.encodeWithSelector(Target.setX.selector, 1);
        bytes memory sig = _sign(guardianPk, address(target), 1 ether, data, 0);
        vm.prank(guardian);
        vm.expectRevert(BackstopAccount.NotOwner.selector);
        acct.execute(address(target), 1 ether, data, sig);

        // guardian's only function is veto — moves no funds, only burns nonce
        vm.prank(guardian);
        acct.guardianVeto(0, address(target), keccak256("x"), "test");
        assertEq(address(acct).balance, balBefore);
        assertEq(acct.nonce(), 1);

        // veto must NOT extend the recovery window (no theft-by-DoS)
        uint256 lab = acct.lastActivityBlock();
        vm.prank(guardian);
        acct.guardianVeto(1, address(target), keccak256("y"), "test2");
        assertEq(acct.lastActivityBlock(), lab); // unchanged
    }

    // happy path: guardian co-sign executes
    function test_CoSign_Executes() public {
        bytes memory data = abi.encodeWithSelector(Target.setX.selector, 123);
        bytes memory sig = _sign(guardianPk, address(target), 0, data, 0);
        vm.prank(owner);
        acct.execute(address(target), 0, data, sig);
        assertEq(target.x(), 123);
        assertEq(acct.nonce(), 1);
    }

    // fuzz: only guardian-signed (to,value,data,nonce) ever executes
    function testFuzz_OnlyGuardianSigExecutes(uint256 signerPk, uint96 value, uint256 v) public {
        signerPk = bound(signerPk, 1, type(uint128).max);
        vm.assume(signerPk != guardianPk);
        vm.deal(address(acct), uint256(value) + 1 ether);
        bytes memory data = abi.encodeWithSelector(Target.setX.selector, v);
        bytes memory sig = _sign(signerPk, address(target), value, data, 0);
        vm.prank(owner);
        vm.expectRevert(BackstopAccount.BadGuardianSig.selector);
        acct.execute(address(target), value, data, sig);
    }

    // guardianVeto from non-guardian reverts
    function test_VetoOnlyGuardian() public {
        vm.prank(owner);
        vm.expectRevert(BackstopAccount.NotGuardian.selector);
        acct.guardianVeto(0, address(target), keccak256("x"), "nope");
    }
}
