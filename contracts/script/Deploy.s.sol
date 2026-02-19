// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/JobMarketplace.sol";

contract Deploy is Script {
    function run() external {
        address agentAddress = vm.envAddress("AGENT_ADDRESS");
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        JobMarketplace marketplace = new JobMarketplace(agentAddress);
        vm.stopBroadcast();

        console.log("JobMarketplace deployed to:", address(marketplace));
        console.log("Agent address:", agentAddress);
    }
}
