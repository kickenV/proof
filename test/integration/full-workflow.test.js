const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ChefsPlan MVP Integration Tests", function () {
  let shiftManager, escrow, reputation;
  let owner, restaurant, chef1, chef2, chef3;

  beforeEach(async function () {
    [owner, restaurant, chef1, chef2, chef3] = await ethers.getSigners();
    
    // Deploy all contracts
    const Reputation = await ethers.getContractFactory("Reputation");
    reputation = await Reputation.deploy();
    await reputation.initialize();
    
    const Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.deploy();
    
    const ShiftManager = await ethers.getContractFactory("ShiftManager");
    shiftManager = await ShiftManager.deploy();
    await shiftManager.initialize(escrow.address, reputation.address);
    
    // Initialize dependencies
    await escrow.initialize(shiftManager.address);
    await reputation.addAuthorizedContract(shiftManager.address);
  });

  describe("Complete Successful Workflow", function () {
    it("Should execute full shift lifecycle successfully", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("2.0");
      const startTime = Math.floor(Date.now() / 1000) + 7200; // 2 hours from now
      const endTime = startTime + 8 * 3600; // 8 hours later

      // 1. Restaurant posts a shift
      console.log("1. Restaurant posting shift...");
      const postTx = await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      const postReceipt = await postTx.wait();
      const shiftId = postReceipt.events.find(e => e.event === "ShiftPosted").args.shiftId.toNumber();

      // Verify shift was posted correctly
      let shift = await shiftManager.getShift(shiftId);
      expect(shift.status).to.equal(0); // Posted
      expect(shift.payment).to.equal(payment);

      // 2. Multiple chefs apply to the shift
      console.log("2. Chefs applying to shift...");
      await shiftManager.connect(chef1).applyToShift(shiftId);
      await shiftManager.connect(chef2).applyToShift(shiftId);
      await shiftManager.connect(chef3).applyToShift(shiftId);

      // Verify applications
      const applications = await shiftManager.getShiftApplications(shiftId);
      expect(applications.length).to.equal(3);
      expect(applications).to.include.members([chef1.address, chef2.address, chef3.address]);

      shift = await shiftManager.getShift(shiftId);
      expect(shift.status).to.equal(1); // Applied

      // 3. Restaurant accepts one chef's application
      console.log("3. Restaurant accepting chef application...");
      const restaurantBalanceBefore = await restaurant.getBalance();
      
      const acceptTx = await shiftManager.connect(restaurant).acceptApplication(shiftId, chef2.address, {
        value: payment
      });
      await acceptTx.wait();

      // Verify acceptance
      shift = await shiftManager.getShift(shiftId);
      expect(shift.status).to.equal(2); // Accepted
      expect(shift.chef).to.equal(chef2.address);

      // Verify escrow was created
      const escrowData = await escrow.getEscrow(shiftId);
      expect(escrowData.chef).to.equal(chef2.address);
      expect(escrowData.amount).to.equal(payment);
      expect(escrowData.status).to.equal(0); // Active

      // Verify payment was deducted from restaurant
      const restaurantBalanceAfter = await restaurant.getBalance();
      expect(restaurantBalanceBefore.sub(restaurantBalanceAfter)).to.be.above(payment);

      // 4. Time passes and shift ends
      console.log("4. Fast-forwarding time to shift end...");
      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await network.provider.send("evm_mine");

      // 5. Chef marks shift as complete
      console.log("5. Chef marking shift complete...");
      await shiftManager.connect(chef2).markShiftComplete(shiftId);

      shift = await shiftManager.getShift(shiftId);
      expect(shift.status).to.equal(3); // Completed

      // 6. Restaurant confirms completion and releases payment
      console.log("6. Restaurant confirming completion...");
      const chef2BalanceBefore = await chef2.getBalance();
      
      await shiftManager.connect(restaurant).confirmCompletion(shiftId);

      // Verify payment was released to chef
      const chef2BalanceAfter = await chef2.getBalance();
      expect(chef2BalanceAfter.sub(chef2BalanceBefore)).to.equal(payment);

      // Verify escrow was released
      const escrowDataAfter = await escrow.getEscrow(shiftId);
      expect(escrowDataAfter.status).to.equal(1); // Released

      // 7. Verify reputation updates
      console.log("7. Verifying reputation updates...");
      const chefReputation = await reputation.getReputation(chef2.address);
      const restaurantReputation = await reputation.getReputation(restaurant.address);

      expect(chefReputation.completedShifts).to.equal(1);
      expect(chefReputation.ratingCount).to.equal(1);
      expect(chefReputation.averageRating).to.equal(500); // 5.0 * 100

      expect(restaurantReputation.completedShifts).to.equal(1);
      expect(restaurantReputation.ratingCount).to.equal(1);
      expect(restaurantReputation.averageRating).to.equal(500);

      console.log("✅ Complete workflow executed successfully!");
    });
  });

  describe("Multiple Concurrent Shifts", function () {
    it("Should handle multiple shifts from same restaurant", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.5");
      const baseStartTime = Math.floor(Date.now() / 1000) + 7200;

      // Restaurant posts 3 shifts
      const shiftPromises = [];
      for (let i = 0; i < 3; i++) {
        const startTime = baseStartTime + (i * 86400); // Each day apart
        const endTime = startTime + 8 * 3600;
        shiftPromises.push(
          shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime)
        );
      }

      await Promise.all(shiftPromises);

      // Verify all shifts were created
      const restaurantShifts = await shiftManager.getRestaurantShifts(restaurant.address);
      expect(restaurantShifts.length).to.equal(3);

      // Different chefs apply to different shifts
      await shiftManager.connect(chef1).applyToShift(1);
      await shiftManager.connect(chef2).applyToShift(2);
      await shiftManager.connect(chef3).applyToShift(3);

      // Restaurant accepts all applications
      for (let i = 1; i <= 3; i++) {
        await shiftManager.connect(restaurant).acceptApplication(i, eval(`chef${i}`).address, {
          value: payment
        });
      }

      // Verify all escrows were created
      for (let i = 1; i <= 3; i++) {
        const escrowData = await escrow.getEscrow(i);
        expect(escrowData.amount).to.equal(payment);
        expect(escrowData.status).to.equal(0); // Active
      }
    });

    it("Should handle chef applying to multiple shifts", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const baseStartTime = Math.floor(Date.now() / 1000) + 7200;

      // Post multiple shifts
      for (let i = 0; i < 3; i++) {
        const startTime = baseStartTime + (i * 86400);
        const endTime = startTime + 8 * 3600;
        await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      }

      // Chef applies to all shifts
      for (let i = 1; i <= 3; i++) {
        await shiftManager.connect(chef1).applyToShift(i);
      }

      const chef1Applications = await shiftManager.getChefApplications(chef1.address);
      expect(chef1Applications.length).to.equal(3);

      // Restaurant accepts chef for 2 shifts
      await shiftManager.connect(restaurant).acceptApplication(1, chef1.address, { value: payment });
      await shiftManager.connect(restaurant).acceptApplication(3, chef1.address, { value: payment });

      const chef1AcceptedShifts = await shiftManager.getChefAcceptedShifts(chef1.address);
      expect(chef1AcceptedShifts.length).to.equal(2);
    });
  });

  describe("Dispute Resolution Workflow", function () {
    it("Should handle shift dispute by restaurant", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const endTime = startTime + 8 * 3600;

      // Setup shift
      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      await shiftManager.connect(chef1).applyToShift(1);
      await shiftManager.connect(restaurant).acceptApplication(1, chef1.address, { value: payment });

      // Restaurant disputes the shift
      const disputeReason = "Chef did not show up for shift";
      await shiftManager.connect(restaurant).disputeShift(1, disputeReason);

      // Verify dispute status
      const shift = await shiftManager.getShift(1);
      expect(shift.status).to.equal(4); // Disputed

      const escrowData = await escrow.getEscrow(1);
      expect(escrowData.status).to.equal(3); // Disputed

      // Verify no automatic payment release
      const chef1BalanceBefore = await chef1.getBalance();
      
      // Fast forward past auto-release period
      await network.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
      await network.provider.send("evm_mine");

      // Auto-release should not work for disputed escrow
      await expect(
        escrow.autoRelease(1)
      ).to.be.revertedWith("Escrow not active");

      const chef1BalanceAfter = await chef1.getBalance();
      expect(chef1BalanceAfter).to.equal(chef1BalanceBefore);
    });

    it("Should handle shift dispute by chef", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const endTime = startTime + 8 * 3600;

      // Setup shift
      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      await shiftManager.connect(chef1).applyToShift(1);
      await shiftManager.connect(restaurant).acceptApplication(1, chef1.address, { value: payment });

      // Chef disputes the shift
      const disputeReason = "Unsafe working conditions";
      await shiftManager.connect(chef1).disputeShift(1, disputeReason);

      // Verify dispute status
      const shift = await shiftManager.getShift(1);
      expect(shift.status).to.equal(4); // Disputed

      const escrowData = await escrow.getEscrow(1);
      expect(escrowData.status).to.equal(3); // Disputed
    });

    it("Should handle emergency withdrawal after dispute period", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const endTime = startTime + 8 * 3600;

      // Setup shift and dispute
      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      await shiftManager.connect(chef1).applyToShift(1);
      await shiftManager.connect(restaurant).acceptApplication(1, chef1.address, { value: payment });
      await shiftManager.connect(chef1).disputeShift(1, "Test dispute");

      // Fast forward past dispute period
      await network.provider.send("evm_increaseTime", [3 * 24 * 60 * 60 + 1]);
      await network.provider.send("evm_mine");

      const restaurantBalanceBefore = await restaurant.getBalance();

      // Owner can emergency withdraw
      await escrow.emergencyWithdraw(1);

      const restaurantBalanceAfter = await restaurant.getBalance();
      expect(restaurantBalanceAfter.sub(restaurantBalanceBefore)).to.equal(payment);
    });
  });

  describe("Auto-Release Functionality", function () {
    it("Should auto-release payment after timeout period", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const endTime = startTime + 8 * 3600;

      // Setup complete shift but restaurant doesn't confirm
      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      await shiftManager.connect(chef1).applyToShift(1);
      await shiftManager.connect(restaurant).acceptApplication(1, chef1.address, { value: payment });

      // Complete the shift
      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await network.provider.send("evm_mine");
      await shiftManager.connect(chef1).markShiftComplete(1);

      // Fast forward past auto-release period
      await network.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
      await network.provider.send("evm_mine");

      const chef1BalanceBefore = await chef1.getBalance();

      // Anyone can trigger auto-release
      await escrow.autoRelease(1);

      const chef1BalanceAfter = await chef1.getBalance();
      expect(chef1BalanceAfter.sub(chef1BalanceBefore)).to.equal(payment);

      const escrowData = await escrow.getEscrow(1);
      expect(escrowData.status).to.equal(1); // Released
    });
  });

  describe("Shift Cancellation Scenarios", function () {
    it("Should handle shift cancellation before applications", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 7200;
      const endTime = startTime + 8 * 3600;

      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);

      const cancelReason = "Change of plans";
      await shiftManager.connect(restaurant).cancelShift(1, cancelReason);

      const shift = await shiftManager.getShift(1);
      expect(shift.status).to.equal(5); // Cancelled

      // Should not be in active shifts
      const activeShifts = await shiftManager.getActiveShifts();
      expect(activeShifts).to.not.include(1);
    });

    it("Should handle shift cancellation after applications", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 7200;
      const endTime = startTime + 8 * 3600;

      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      await shiftManager.connect(chef1).applyToShift(1);
      await shiftManager.connect(chef2).applyToShift(1);

      const cancelReason = "Insufficient applications";
      await shiftManager.connect(restaurant).cancelShift(1, cancelReason);

      const shift = await shiftManager.getShift(1);
      expect(shift.status).to.equal(5); // Cancelled

      // Applications should still be recorded
      const applications = await shiftManager.getShiftApplications(1);
      expect(applications.length).to.equal(2);
    });
  });

  describe("Reputation Building Over Time", function () {
    it("Should track reputation across multiple completed shifts", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const baseStartTime = Math.floor(Date.now() / 1000) + 3600;

      // Complete 3 shifts for the same chef
      for (let i = 0; i < 3; i++) {
        const startTime = baseStartTime + (i * 100); // Small time increments for testing
        const endTime = startTime + 8 * 3600;

        await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
        await shiftManager.connect(chef1).applyToShift(i + 1);
        await shiftManager.connect(restaurant).acceptApplication(i + 1, chef1.address, { value: payment });

        // Fast forward to end time
        await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
        await network.provider.send("evm_mine");

        await shiftManager.connect(chef1).markShiftComplete(i + 1);
        await shiftManager.connect(restaurant).confirmCompletion(i + 1);
      }

      // Check final reputation
      const chefReputation = await reputation.getReputation(chef1.address);
      expect(chefReputation.completedShifts).to.equal(3);
      expect(chefReputation.ratingCount).to.equal(3);
      expect(chefReputation.totalScore).to.equal(15); // 3 shifts * 5 rating
      expect(chefReputation.averageRating).to.equal(500); // 5.0 * 100

      const restaurantReputation = await reputation.getReputation(restaurant.address);
      expect(restaurantReputation.completedShifts).to.equal(3);
      expect(restaurantReputation.ratingCount).to.equal(3);
    });
  });

  describe("Gas Usage Analysis", function () {
    it("Should measure gas costs for complete workflow", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const endTime = startTime + 8 * 3600;

      let totalGas = 0;

      // Post shift
      let tx = await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      let receipt = await tx.wait();
      totalGas += receipt.gasUsed.toNumber();
      console.log(`Post shift gas: ${receipt.gasUsed}`);

      // Apply to shift
      tx = await shiftManager.connect(chef1).applyToShift(1);
      receipt = await tx.wait();
      totalGas += receipt.gasUsed.toNumber();
      console.log(`Apply to shift gas: ${receipt.gasUsed}`);

      // Accept application
      tx = await shiftManager.connect(restaurant).acceptApplication(1, chef1.address, { value: payment });
      receipt = await tx.wait();
      totalGas += receipt.gasUsed.toNumber();
      console.log(`Accept application gas: ${receipt.gasUsed}`);

      // Complete shift
      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await network.provider.send("evm_mine");

      tx = await shiftManager.connect(chef1).markShiftComplete(1);
      receipt = await tx.wait();
      totalGas += receipt.gasUsed.toNumber();
      console.log(`Mark complete gas: ${receipt.gasUsed}`);

      // Confirm completion
      tx = await shiftManager.connect(restaurant).confirmCompletion(1);
      receipt = await tx.wait();
      totalGas += receipt.gasUsed.toNumber();
      console.log(`Confirm completion gas: ${receipt.gasUsed}`);

      console.log(`Total workflow gas: ${totalGas}`);
      expect(totalGas).to.be.below(1500000); // Reasonable total gas limit
    });
  });

  describe("System Stress Tests", function () {
    it("Should handle high volume of shifts and applications", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("0.1");
      const baseStartTime = Math.floor(Date.now() / 1000) + 7200;

      // Create multiple chef accounts
      const chefs = [];
      for (let i = 0; i < 5; i++) {
        const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
        await owner.sendTransaction({
          to: wallet.address,
          value: ethers.utils.parseEther("1.0")
        });
        chefs.push(wallet);
      }

      // Create 10 shifts
      for (let i = 0; i < 10; i++) {
        const startTime = baseStartTime + (i * 3600); // 1 hour apart
        const endTime = startTime + 8 * 3600;
        await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      }

      // Each chef applies to all shifts
      for (const chef of chefs) {
        for (let shiftId = 1; shiftId <= 10; shiftId++) {
          await shiftManager.connect(chef).applyToShift(shiftId);
        }
      }

      // Verify all applications were recorded
      for (let shiftId = 1; shiftId <= 10; shiftId++) {
        const applications = await shiftManager.getShiftApplications(shiftId);
        expect(applications.length).to.equal(5);
      }

      // Restaurant accepts one chef per shift
      for (let shiftId = 1; shiftId <= 10; shiftId++) {
        const chefIndex = (shiftId - 1) % chefs.length;
        await shiftManager.connect(restaurant).acceptApplication(shiftId, chefs[chefIndex].address, {
          value: payment
        });
      }

      // Verify active shifts count
      const activeShifts = await shiftManager.getActiveShifts();
      expect(activeShifts.length).to.equal(0); // All should be accepted, not in active list

      console.log("✅ High volume test completed successfully!");
    });
  });

  describe("Error Recovery Scenarios", function () {
    it("Should handle failed payment transfers gracefully", async function () {
      // This test would require a malicious contract that rejects payments
      // For now, we'll test the basic error handling
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const endTime = startTime + 8 * 3600;

      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      await shiftManager.connect(chef1).applyToShift(1);

      // Try to accept with insufficient payment
      await expect(
        shiftManager.connect(restaurant).acceptApplication(1, chef1.address, {
          value: ethers.utils.parseEther("0.5")
        })
      ).to.be.revertedWith("Incorrect payment amount");

      // Verify shift state remains unchanged
      const shift = await shiftManager.getShift(1);
      expect(shift.status).to.equal(1); // Still Applied
      expect(shift.chef).to.equal(ethers.constants.AddressZero);
    });

    it("Should maintain data consistency after failed operations", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const endTime = startTime + 8 * 3600;

      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);

      // Try various invalid operations
      await expect(
        shiftManager.connect(chef1).applyToShift(999)
      ).to.be.revertedWith("Invalid shift ID");

      await expect(
        shiftManager.connect(restaurant).acceptApplication(1, chef1.address, { value: payment })
      ).to.be.revertedWith("Chef has not applied to this shift");

      // Verify system state is consistent
      const shift = await shiftManager.getShift(1);
      expect(shift.status).to.equal(0); // Still Posted
      
      const applications = await shiftManager.getShiftApplications(1);
      expect(applications.length).to.equal(0);
    });
  });
});