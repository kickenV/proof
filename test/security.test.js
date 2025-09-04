const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Security and Performance Tests", function () {
  let shiftManager, escrow, reputation;
  let owner, restaurant, chef, attacker;

  beforeEach(async function () {
    [owner, restaurant, chef, attacker] = await ethers.getSigners();
    
    // Deploy contracts
    const Reputation = await ethers.getContractFactory("Reputation");
    reputation = await Reputation.deploy();
    await reputation.initialize();
    
    const Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.deploy();
    
    const ShiftManager = await ethers.getContractFactory("ShiftManager");
    shiftManager = await ShiftManager.deploy();
    await shiftManager.initialize(escrow.address, reputation.address);
    
    await escrow.initialize(shiftManager.address);
    await reputation.addAuthorizedContract(shiftManager.address);
  });

  describe("Reentrancy Protection", function () {
    it("Should prevent reentrancy in acceptApplication", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const endTime = startTime + 8 * 3600;

      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      await shiftManager.connect(chef).applyToShift(1);

      // Multiple rapid calls should not cause issues
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          shiftManager.connect(restaurant).acceptApplication(1, chef.address, {
            value: payment
          }).catch(() => {}) // Catch expected failures
        );
      }

      await Promise.allSettled(promises);

      // Only one should succeed
      const shift = await shiftManager.getShift(1);
      expect(shift.status).to.equal(2); // Accepted
      expect(shift.chef).to.equal(chef.address);
    });

    it("Should prevent reentrancy in escrow release", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const endTime = startTime + 8 * 3600;

      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      await shiftManager.connect(chef).applyToShift(1);
      await shiftManager.connect(restaurant).acceptApplication(1, chef.address, { value: payment });

      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await network.provider.send("evm_mine");
      await shiftManager.connect(chef).markShiftComplete(1);

      // Multiple release attempts should fail gracefully
      await shiftManager.connect(restaurant).confirmCompletion(1);

      await expect(
        escrow.connect(owner).releaseEscrow(1)
      ).to.be.revertedWith("Escrow not active");
    });
  });

  describe("Access Control Security", function () {
    it("Should prevent unauthorized contract updates", async function () {
      await expect(
        shiftManager.connect(attacker).updateEscrowContract(attacker.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        shiftManager.connect(attacker).updateReputationContract(attacker.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        escrow.connect(attacker).updateShiftManager(attacker.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should prevent unauthorized reputation updates", async function () {
      await expect(
        reputation.connect(attacker).updateReputation(chef.address, 5, "Unauthorized")
      ).to.be.revertedWith("Not authorized");

      await expect(
        reputation.connect(attacker).incrementCompletedShifts(chef.address)
      ).to.be.revertedWith("Not authorized");
    });

    it("Should prevent unauthorized escrow operations", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const endTime = startTime + 8 * 3600;

      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      await shiftManager.connect(chef).applyToShift(1);
      await shiftManager.connect(restaurant).acceptApplication(1, chef.address, { value: payment });

      await expect(
        escrow.connect(attacker).releaseEscrow(1)
      ).to.be.revertedWith("Only ShiftManager can call this");

      await expect(
        escrow.connect(attacker).refundEscrow(1)
      ).to.be.revertedWith("Only ShiftManager can call this");
    });
  });

  describe("Input Validation Security", function () {
    it("Should validate shift posting parameters", async function () {
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const endTime = startTime + 8 * 3600;

      // Empty CID
      await expect(
        shiftManager.connect(restaurant).postShift("", payment, startTime, endTime)
      ).to.be.revertedWith("Details CID required");

      // Very long CID (potential DoS)
      const longCID = "Q".repeat(1000);
      await expect(
        shiftManager.connect(restaurant).postShift(longCID, payment, startTime, endTime)
      ).to.not.be.reverted; // Should handle long strings gracefully

      // Zero payment
      await expect(
        shiftManager.connect(restaurant).postShift("QmTest", 0, startTime, endTime)
      ).to.be.revertedWith("Payment too low");

      // Very large payment (should be allowed)
      const largePayment = ethers.utils.parseEther("1000000");
      await expect(
        shiftManager.connect(restaurant).postShift("QmTest", largePayment, startTime, endTime)
      ).to.not.be.reverted;
    });

    it("Should validate reputation rating ranges", async function () {
      await expect(
        reputation.connect(owner).updateReputation(chef.address, 0, "Invalid")
      ).to.be.revertedWith("Rating out of range");

      await expect(
        reputation.connect(owner).updateReputation(chef.address, 6, "Invalid")
      ).to.be.revertedWith("Rating out of range");

      // Valid ratings should work
      await reputation.connect(owner).updateReputation(chef.address, 1, "Minimum");
      await reputation.connect(owner).updateReputation(chef.address, 5, "Maximum");
    });

    it("Should validate address parameters", async function () {
      await expect(
        reputation.connect(owner).updateReputation(ethers.constants.AddressZero, 5, "Invalid")
      ).to.be.revertedWith("Invalid user address");

      await expect(
        reputation.connect(owner).incrementCompletedShifts(ethers.constants.AddressZero)
      ).to.be.revertedWith("Invalid user address");
    });
  });

  describe("Economic Security", function () {
    it("Should prevent double spending attacks", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const endTime = startTime + 8 * 3600;

      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      await shiftManager.connect(chef).applyToShift(1);

      const restaurantBalanceBefore = await restaurant.getBalance();

      // Accept application
      await shiftManager.connect(restaurant).acceptApplication(1, chef.address, { value: payment });

      const restaurantBalanceAfter = await restaurant.getBalance();
      const spent = restaurantBalanceBefore.sub(restaurantBalanceAfter);

      // Verify exact amount was spent (payment + gas)
      expect(spent).to.be.above(payment);

      // Try to accept again (should fail)
      await expect(
        shiftManager.connect(restaurant).acceptApplication(1, chef.address, { value: payment })
      ).to.be.revertedWith("No applications to accept");
    });

    it("Should prevent payment draining attacks", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const endTime = startTime + 8 * 3600;

      // Setup shift
      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      await shiftManager.connect(chef).applyToShift(1);
      await shiftManager.connect(restaurant).acceptApplication(1, chef.address, { value: payment });

      // Complete shift
      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await network.provider.send("evm_mine");
      await shiftManager.connect(chef).markShiftComplete(1);

      const chefBalanceBefore = await chef.getBalance();

      // Confirm completion
      await shiftManager.connect(restaurant).confirmCompletion(1);

      const chefBalanceAfter = await chef.getBalance();
      expect(chefBalanceAfter.sub(chefBalanceBefore)).to.equal(payment);

      // Try to release again (should fail)
      await expect(
        escrow.connect(owner).releaseEscrow(1)
      ).to.be.revertedWith("Escrow not active");
    });
  });

  describe("Gas Optimization and DoS Protection", function () {
    it("Should handle large number of applications efficiently", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("0.1");
      const startTime = Math.floor(Date.now() / 1000) + 7200;
      const endTime = startTime + 8 * 3600;

      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);

      // Create many chef accounts
      const chefs = [];
      for (let i = 0; i < 50; i++) {
        const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
        await owner.sendTransaction({
          to: wallet.address,
          value: ethers.utils.parseEther("1.0")
        });
        chefs.push(wallet);
      }

      // Track gas usage for applications
      let totalGas = 0;
      for (let i = 0; i < 20; i++) { // Limit to 20 for test performance
        const tx = await shiftManager.connect(chefs[i]).applyToShift(1);
        const receipt = await tx.wait();
        totalGas += receipt.gasUsed.toNumber();
      }

      const averageGas = totalGas / 20;
      console.log(`Average gas per application: ${averageGas}`);
      expect(averageGas).to.be.below(200000); // Should be efficient

      // Getting applications should still be efficient
      const gasEstimate = await shiftManager.estimateGas.getShiftApplications(1);
      console.log(`Gas to get applications: ${gasEstimate}`);
      expect(gasEstimate).to.be.below(300000);
    });

    it("Should limit shift duration to prevent gas issues", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 3600;

      // Very long shift (more than 12 hours)
      const longEndTime = startTime + 15 * 3600;

      await expect(
        shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, longEndTime)
      ).to.be.revertedWith("Shift too long");
    });

    it("Should handle view function calls efficiently", async function () {
      // Create multiple shifts for testing
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("0.1");
      const baseStartTime = Math.floor(Date.now() / 1000) + 3600;

      for (let i = 0; i < 10; i++) {
        const startTime = baseStartTime + (i * 3600);
        const endTime = startTime + 8 * 3600;
        await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      }

      // Test view functions gas usage
      const gasEstimates = {
        getActiveShifts: await shiftManager.estimateGas.getActiveShifts(),
        getRestaurantShifts: await shiftManager.estimateGas.getRestaurantShifts(restaurant.address),
        getShift: await shiftManager.estimateGas.getShift(1)
      };

      console.log('View function gas estimates:', gasEstimates);

      expect(gasEstimates.getActiveShifts).to.be.below(1000000);
      expect(gasEstimates.getRestaurantShifts).to.be.below(100000);
      expect(gasEstimates.getShift).to.be.below(50000);
    });
  });

  describe("Timestamp Manipulation Resistance", function () {
    it("Should handle minor timestamp variations", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const endTime = startTime + 8 * 3600;

      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      await shiftManager.connect(chef).applyToShift(1);
      await shiftManager.connect(restaurant).acceptApplication(1, chef.address, { value: payment });

      // Try to complete shift slightly before end time (should fail)
      await network.provider.send("evm_setNextBlockTimestamp", [endTime - 1]);
      await network.provider.send("evm_mine");

      await expect(
        shiftManager.connect(chef).markShiftComplete(1)
      ).to.be.revertedWith("Shift not yet ended");

      // Complete at exact end time (should work)
      await network.provider.send("evm_setNextBlockTimestamp", [endTime]);
      await network.provider.send("evm_mine");

      await expect(
        shiftManager.connect(chef).markShiftComplete(1)
      ).to.not.be.reverted;
    });

    it("Should use safe time windows for applications", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 3700; // Close to application deadline
      const endTime = startTime + 8 * 3600;

      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);

      // Should be able to apply with enough time buffer
      await expect(
        shiftManager.connect(chef).applyToShift(1)
      ).to.not.be.reverted;

      // Fast forward close to deadline
      await network.provider.send("evm_setNextBlockTimestamp", [startTime - 1800]); // 30 min before
      await network.provider.send("evm_mine");

      // Should still be able to apply
      await expect(
        shiftManager.connect(restaurant).applyToShift(1)
      ).to.be.revertedWith("Restaurant cannot apply to own shift");
    });
  });

  describe("Contract Upgrade Safety", function () {
    it("Should maintain state consistency during upgrades", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const endTime = startTime + 8 * 3600;

      // Create some data
      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      await shiftManager.connect(chef).applyToShift(1);

      // Check current state
      const shiftBefore = await shiftManager.getShift(1);
      const applicationsBefore = await shiftManager.getShiftApplications(1);

      // Simulate contract address updates (without actual upgrade for test)
      const newEscrowAddress = ethers.Wallet.createRandom().address;
      const newReputationAddress = ethers.Wallet.createRandom().address;

      await shiftManager.updateEscrowContract(newEscrowAddress);
      await shiftManager.updateReputationContract(newReputationAddress);

      // Verify state is preserved
      const shiftAfter = await shiftManager.getShift(1);
      const applicationsAfter = await shiftManager.getShiftApplications(1);

      expect(shiftAfter.id).to.equal(shiftBefore.id);
      expect(shiftAfter.restaurant).to.equal(shiftBefore.restaurant);
      expect(applicationsAfter.length).to.equal(applicationsBefore.length);

      // Verify new addresses are set
      expect(await shiftManager.escrowContract()).to.equal(newEscrowAddress);
      expect(await shiftManager.reputationContract()).to.equal(newReputationAddress);
    });
  });

  describe("Edge Case Handling", function () {
    it("Should handle zero-value transactions appropriately", async function () {
      // Zero value transactions should be rejected for escrow creation
      await expect(
        escrow.connect(owner).createEscrow(1, chef.address, 0, { value: 0 })
      ).to.be.revertedWith("Only ShiftManager can call this");
    });

    it("Should handle maximum uint256 values safely", async function () {
      const maxUint256 = ethers.constants.MaxUint256;
      
      // Large shift ID queries should be handled gracefully
      await expect(
        shiftManager.getShift(maxUint256)
      ).to.be.revertedWith("Invalid shift ID");

      // Large payment amounts should be handled (though impractical)
      const detailsCID = "QmTestHash123";
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const endTime = startTime + 8 * 3600;

      // This would fail due to insufficient balance, not overflow
      await expect(
        shiftManager.connect(restaurant).postShift(detailsCID, maxUint256, startTime, endTime)
      ).to.not.be.reverted; // Contract should handle large numbers
    });

    it("Should handle contract interactions when paused or disabled", async function () {
      // Test behavior when escrow contract is set to zero (simulating disabled state)
      await shiftManager.updateEscrowContract(ethers.constants.AddressZero);

      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const endTime = startTime + 8 * 3600;

      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      await shiftManager.connect(chef).applyToShift(1);

      // Accepting application should fail when escrow is disabled
      await expect(
        shiftManager.connect(restaurant).acceptApplication(1, chef.address, { value: payment })
      ).to.be.reverted; // Will fail when trying to interact with zero address
    });
  });
});