const { ethers } = require("hardhat");

async function main() {
  console.log("Starting deployment to local network...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying from: ${deployer.address}`);
  console.log(`Account balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);

  // Deploy Reputation contract
  console.log("\n1. Deploying Reputation contract...");
  const Reputation = await ethers.getContractFactory("Reputation");
  const reputation = await Reputation.deploy();
  await reputation.deployed();
  console.log(`Reputation deployed to: ${reputation.address}`);

  // Deploy Escrow contract  
  console.log("\n2. Deploying Escrow contract...");
  const Escrow = await ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy();
  await escrow.deployed();
  console.log(`Escrow deployed to: ${escrow.address}`);

  // Deploy ShiftManager contract
  console.log("\n3. Deploying ShiftManager contract...");
  const ShiftManager = await ethers.getContractFactory("ShiftManager");
  const shiftManager = await ShiftManager.deploy();
  await shiftManager.deployed();
  console.log(`ShiftManager deployed to: ${shiftManager.address}`);

  // Initialize contracts
  console.log("\n4. Initializing contracts...");
  
  await reputation.initialize();
  console.log("Reputation initialized");
  
  await shiftManager.initialize(escrow.address, reputation.address);
  console.log("ShiftManager initialized");
  
  await escrow.initialize(shiftManager.address);
  console.log("Escrow initialized");

  // Set up authorization
  await reputation.addAuthorizedContract(shiftManager.address);
  console.log("ShiftManager authorized in Reputation contract");

  // Verify deployments
  console.log("\n5. Verifying deployments...");
  
  // Test basic functionality
  const nextShiftId = await shiftManager.nextShiftId();
  console.log(`ShiftManager nextShiftId: ${nextShiftId}`);
  
  const escrowShiftManager = await escrow.shiftManagerContract();
  console.log(`Escrow ShiftManager: ${escrowShiftManager}`);
  
  const isAuthorized = await reputation.authorizedContracts(shiftManager.address);
  console.log(`ShiftManager authorized: ${isAuthorized}`);

  console.log("\n=== Deployment Summary ===");
  console.log(`Reputation: ${reputation.address}`);
  console.log(`Escrow: ${escrow.address}`);
  console.log(`ShiftManager: ${shiftManager.address}`);
  console.log(`Deployer: ${deployer.address}`);
  
  console.log("\n✅ Deployment completed successfully!");

  // Save addresses to file for frontend
  const addresses = {
    reputation: reputation.address,
    escrow: escrow.address,
    shiftManager: shiftManager.address,
    deployer: deployer.address,
    network: await ethers.provider.getNetwork()
  };

  const fs = require('fs');
  fs.writeFileSync('./deployed-addresses.json', JSON.stringify(addresses, null, 2));
  console.log("📄 Contract addresses saved to deployed-addresses.json");

  return {
    reputation,
    escrow,
    shiftManager
  };
}

// For testing purposes
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Deployment failed:");
      console.error(error);
      process.exit(1);
    });
}

module.exports = main;