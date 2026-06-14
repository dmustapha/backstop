// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BackstopAccountFactory} from "../src/BackstopAccountFactory.sol";
import {BackstopAccount} from "../src/BackstopAccount.sol";

contract MockRegistry {
    uint256 public next;
    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    function register(string calldata agentURI) external returns (uint256 id) {
        id = next++;
        emit Registered(id, agentURI, msg.sender);
    }
}

contract FactoryTest is Test {
    BackstopAccountFactory factory;
    MockRegistry registry;

    function setUp() public {
        registry = new MockRegistry();
        factory = new BackstopAccountFactory(address(registry));
    }

    function test_CreateAccount_DeploysAndRegisters() public {
        address owner = address(0xA11CE);
        address guardian = address(0xB0B);
        address predicted = factory.computeAddress(owner, guardian, 100);
        (address account, uint256 agentId) = factory.createAccount(owner, guardian, 100, "data:application/json,{}");
        assertEq(account, predicted, "CREATE2 address mismatch");
        assertEq(agentId, 0);
        assertEq(BackstopAccount(payable(account)).owner(), owner);
        assertEq(BackstopAccount(payable(account)).guardian(), guardian);
    }
}
