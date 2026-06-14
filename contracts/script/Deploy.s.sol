// File: contracts/script/Deploy.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {BackstopAccountFactory} from "../src/BackstopAccountFactory.sol";

contract Deploy is Script {
    // ERC-8004 IdentityRegistry on Mantle Sepolia (5003)
    address constant IDENTITY_REGISTRY = 0x8004A818BFB912233c491871b3d84c89A494BD9e;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_KEY");
        vm.startBroadcast(pk);
        BackstopAccountFactory factory = new BackstopAccountFactory(IDENTITY_REGISTRY);
        vm.stopBroadcast();
        console2.log("FACTORY_ADDRESS=", address(factory));
    }
}
