const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Deployment and Setup", function () {
  let reputation, escrow, shiftManager;
  let deployer, restaurant, chef;

  beforeEach(async function () {
    [deployer, restaurant, chef] = await ethers.getSigners();
    
    // Deploy using the deployment script
    const deploy = require("../scripts/deploy");
    const contracts = await deploy();
    
    reputation = contracts.reputation;
    escrow = contracts.escrow;
    shiftManager = contracts.shiftManager;
  });

  describe("Contract Deployment", function () {
    it("Should deploy all contracts successfully", async function () {
      expect(reputation.address).to.not.equal(ethers.constants.AddressZero);
      expect(escrow.address).to.not.equal(ethers.constants.AddressZero);
      expect(shiftManager.address).to.not.equal(ethers.constants.AddressZero);
    });

    it("Should initialize contracts correctly", async function () {
      expect(await reputation.owner()).to.equal(deployer.address);
      expect(await escrow.owner()).to.equal(deployer.address);
      expect(await shiftManager.owner()).to.equal(deployer.address);
    });

    it("Should set up contract relationships", async function () {
      expect(await escrow.shiftManagerContract()).to.equal(shiftManager.address);
      expect(await shiftManager.escrowContract()).to.equal(escrow.address);
      expect(await shiftManager.reputationContract()).to.equal(reputation.address);
    });

    it("Should authorize ShiftManager in Reputation contract", async function () {
      expect(await reputation.authorizedContracts(shiftManager.address)).to.be.true;
    });
  });

  describe("Basic Functionality After Deployment", function () {
    it("Should allow posting a shift", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const endTime = startTime + 8 * 3600;

      await expect(
        shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime)
      ).to.emit(shiftManager, "ShiftPosted");

      const shift = await shiftManager.getShift(1);
      expect(shift.restaurant).to.equal(restaurant.address);
    });

    it("Should handle complete workflow after deployment", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const endTime = startTime + 8 * 3600;

      // Post shift
      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      
      // Apply
      await shiftManager.connect(chef).applyToShift(1);
      
      // Accept
      await shiftManager.connect(restaurant).acceptApplication(1, chef.address, {
        value: payment
      });
      
      // Complete
      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await network.provider.send("evm_mine");
      await shiftManager.connect(chef).markShiftComplete(1);
      
      // Confirm
      const chefBalanceBefore = await chef.getBalance();
      await shiftManager.connect(restaurant).confirmCompletion(1);
      const chefBalanceAfter = await chef.getBalance();
      
      expect(chefBalanceAfter.sub(chefBalanceBefore)).to.equal(payment);
    });
  });

  describe("Gas Usage Analysis", function () {
    it("Should track deployment gas costs", async function () {
      // Get deployment transaction receipts
      const reputationReceipt = await reputation.deployTransaction.wait();
      const escrowReceipt = await escrow.deployTransaction.wait();
      const shiftManagerReceipt = await shiftManager.deployTransaction.wait();

      console.log(`Reputation deployment gas: ${reputationReceipt.gasUsed}`);
      console.log(`Escrow deployment gas: ${escrowReceipt.gasUsed}`);
      console.log(`ShiftManager deployment gas: ${shiftManagerReceipt.gasUsed}`);

      const totalDeploymentGas = reputationReceipt.gasUsed
        .add(escrowReceipt.gasUsed)
        .add(shiftManagerReceipt.gasUsed);

      console.log(`Total deployment gas: ${totalDeploymentGas}`);
      expect(totalDeploymentGas).to.be.below(5000000); // Reasonable deployment gas limit
    });
  });

  describe("Contract Size Analysis", function () {
    it("Should check contract sizes", async function () {
      const reputationCode = await ethers.provider.getCode(reputation.address);
      const escrowCode = await ethers.provider.getCode(escrow.address);
      const shiftManagerCode = await ethers.provider.getCode(shiftManager.address);

      console.log(`Reputation contract size: ${reputationCode.length / 2 - 1} bytes`);
      console.log(`Escrow contract size: ${escrowCode.length / 2 - 1} bytes`);
      console.log(`ShiftManager contract size: ${shiftManagerCode.length / 2 - 1} bytes`);

      // Ethereum contract size limit is 24,576 bytes (0x6000)
      expect(reputationCode.length / 2 - 1).to.be.below(24576);
      expect(escrowCode.length / 2 - 1).to.be.below(24576);
      expect(shiftManagerCode.length / 2 - 1).to.be.below(24576);
    });
  });
});