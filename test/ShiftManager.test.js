const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ShiftManager Contract", function () {
  let shiftManager, escrow, reputation;
  let owner, restaurant, chef1, chef2, other;

  beforeEach(async function () {
    [owner, restaurant, chef1, chef2, other] = await ethers.getSigners();
    
    // Deploy Reputation contract
    const Reputation = await ethers.getContractFactory("Reputation");
    reputation = await Reputation.deploy();
    await reputation.initialize();
    
    // Deploy Escrow contract
    const Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.deploy();
    
    // Deploy ShiftManager contract
    const ShiftManager = await ethers.getContractFactory("ShiftManager");
    shiftManager = await ShiftManager.deploy();
    await shiftManager.initialize(escrow.address, reputation.address);
    
    // Initialize Escrow with ShiftManager address
    await escrow.initialize(shiftManager.address);
    
    // Authorize ShiftManager in Reputation contract
    await reputation.addAuthorizedContract(shiftManager.address);
  });

  describe("Initialization", function () {
    it("Should initialize correctly", async function () {
      expect(await shiftManager.owner()).to.equal(owner.address);
      expect(await shiftManager.escrowContract()).to.equal(escrow.address);
      expect(await shiftManager.reputationContract()).to.equal(reputation.address);
      expect(await shiftManager.nextShiftId()).to.equal(1);
    });

    it("Should reject invalid initialization parameters", async function () {
      const ShiftManager = await ethers.getContractFactory("ShiftManager");
      const newShiftManager = await ShiftManager.deploy();
      
      await expect(
        newShiftManager.initialize(ethers.constants.AddressZero, reputation.address)
      ).to.be.revertedWith("Invalid escrow address");

      await expect(
        newShiftManager.initialize(escrow.address, ethers.constants.AddressZero)
      ).to.be.revertedWith("Invalid reputation address");
    });
  });

  describe("Shift Posting", function () {
    const detailsCID = "QmTestHash123";
    const payment = ethers.utils.parseEther("1.0");
    const startTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const endTime = startTime + 8 * 3600; // 8 hours later

    it("Should allow restaurant to post a shift", async function () {
      await expect(
        shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime)
      ).to.emit(shiftManager, "ShiftPosted")
        .withArgs(1, restaurant.address, detailsCID, payment, startTime, endTime);

      const shift = await shiftManager.getShift(1);
      expect(shift.restaurant).to.equal(restaurant.address);
      expect(shift.payment).to.equal(payment);
      expect(shift.status).to.equal(0); // Posted
    });

    it("Should track restaurant shifts", async function () {
      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime + 86400, endTime + 86400);

      const restaurantShifts = await shiftManager.getRestaurantShifts(restaurant.address);
      expect(restaurantShifts.length).to.equal(2);
      expect(restaurantShifts[0]).to.equal(1);
      expect(restaurantShifts[1]).to.equal(2);
    });

    it("Should reject invalid shift parameters", async function () {
      // Empty details CID
      await expect(
        shiftManager.connect(restaurant).postShift("", payment, startTime, endTime)
      ).to.be.revertedWith("Details CID required");

      // Payment too low
      await expect(
        shiftManager.connect(restaurant).postShift(detailsCID, ethers.utils.parseEther("0.005"), startTime, endTime)
      ).to.be.revertedWith("Payment too low");

      // Start time in past
      const pastTime = Math.floor(Date.now() / 1000) - 3600;
      await expect(
        shiftManager.connect(restaurant).postShift(detailsCID, payment, pastTime, endTime)
      ).to.be.revertedWith("Start time must be in future");

      // End time before start time
      await expect(
        shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, startTime - 3600)
      ).to.be.revertedWith("End time must be after start time");

      // Shift too long (more than 12 hours)
      const longEndTime = startTime + 13 * 3600;
      await expect(
        shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, longEndTime)
      ).to.be.revertedWith("Shift too long");
    });

    it("Should increment nextShiftId correctly", async function () {
      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      expect(await shiftManager.nextShiftId()).to.equal(2);

      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime + 86400, endTime + 86400);
      expect(await shiftManager.nextShiftId()).to.equal(3);
    });
  });

  describe("Shift Applications", function () {
    let shiftId;
    const detailsCID = "QmTestHash123";
    const payment = ethers.utils.parseEther("1.0");
    const startTime = Math.floor(Date.now() / 1000) + 7200; // 2 hours from now
    const endTime = startTime + 8 * 3600;

    beforeEach(async function () {
      const tx = await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      const receipt = await tx.wait();
      shiftId = receipt.events.find(e => e.event === "ShiftPosted").args.shiftId.toNumber();
    });

    it("Should allow chef to apply to shift", async function () {
      await expect(
        shiftManager.connect(chef1).applyToShift(shiftId)
      ).to.emit(shiftManager, "ShiftApplied")
        .withArgs(shiftId, chef1.address);

      const applications = await shiftManager.getShiftApplications(shiftId);
      expect(applications).to.include(chef1.address);

      const shift = await shiftManager.getShift(shiftId);
      expect(shift.status).to.equal(1); // Applied
    });

    it("Should track chef applications", async function () {
      await shiftManager.connect(chef1).applyToShift(shiftId);

      const chefApplications = await shiftManager.getChefApplications(chef1.address);
      expect(chefApplications).to.include(shiftId);
    });

    it("Should allow multiple chefs to apply", async function () {
      await shiftManager.connect(chef1).applyToShift(shiftId);
      await shiftManager.connect(chef2).applyToShift(shiftId);

      const applications = await shiftManager.getShiftApplications(shiftId);
      expect(applications.length).to.equal(2);
      expect(applications).to.include(chef1.address);
      expect(applications).to.include(chef2.address);
    });

    it("Should reject duplicate applications", async function () {
      await shiftManager.connect(chef1).applyToShift(shiftId);

      await expect(
        shiftManager.connect(chef1).applyToShift(shiftId)
      ).to.be.revertedWith("Already applied to this shift");
    });

    it("Should reject restaurant applying to own shift", async function () {
      await expect(
        shiftManager.connect(restaurant).applyToShift(shiftId)
      ).to.be.revertedWith("Restaurant cannot apply to own shift");
    });

    it("Should reject applications too close to start time", async function () {
      // Create a shift starting very soon
      const nearStartTime = Math.floor(Date.now() / 1000) + 1800; // 30 minutes from now
      const nearEndTime = nearStartTime + 8 * 3600;
      
      const tx = await shiftManager.connect(restaurant).postShift(detailsCID, payment, nearStartTime, nearEndTime);
      const receipt = await tx.wait();
      const nearShiftId = receipt.events.find(e => e.event === "ShiftPosted").args.shiftId.toNumber();

      await expect(
        shiftManager.connect(chef1).applyToShift(nearShiftId)
      ).to.be.revertedWith("Application period closed");
    });

    it("Should reject applications to invalid shifts", async function () {
      await expect(
        shiftManager.connect(chef1).applyToShift(999)
      ).to.be.revertedWith("Invalid shift ID");
    });
  });

  describe("Application Acceptance", function () {
    let shiftId;
    const detailsCID = "QmTestHash123";
    const payment = ethers.utils.parseEther("1.0");
    const startTime = Math.floor(Date.now() / 1000) + 7200;
    const endTime = startTime + 8 * 3600;

    beforeEach(async function () {
      const tx = await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      const receipt = await tx.wait();
      shiftId = receipt.events.find(e => e.event === "ShiftPosted").args.shiftId.toNumber();
      
      await shiftManager.connect(chef1).applyToShift(shiftId);
      await shiftManager.connect(chef2).applyToShift(shiftId);
    });

    it("Should allow restaurant to accept chef application", async function () {
      await expect(
        shiftManager.connect(restaurant).acceptApplication(shiftId, chef1.address, {
          value: payment
        })
      ).to.emit(shiftManager, "ShiftAccepted")
        .withArgs(shiftId, chef1.address);

      const shift = await shiftManager.getShift(shiftId);
      expect(shift.chef).to.equal(chef1.address);
      expect(shift.status).to.equal(2); // Accepted

      const chefAcceptedShifts = await shiftManager.getChefAcceptedShifts(chef1.address);
      expect(chefAcceptedShifts).to.include(shiftId);
    });

    it("Should create escrow when accepting application", async function () {
      await shiftManager.connect(restaurant).acceptApplication(shiftId, chef1.address, {
        value: payment
      });

      const escrowData = await escrow.getEscrow(shiftId);
      expect(escrowData.chef).to.equal(chef1.address);
      expect(escrowData.amount).to.equal(payment);
      expect(escrowData.status).to.equal(0); // Active
    });

    it("Should reject acceptance with incorrect payment", async function () {
      const wrongPayment = ethers.utils.parseEther("0.5");

      await expect(
        shiftManager.connect(restaurant).acceptApplication(shiftId, chef1.address, {
          value: wrongPayment
        })
      ).to.be.revertedWith("Incorrect payment amount");
    });

    it("Should reject acceptance from non-restaurant", async function () {
      await expect(
        shiftManager.connect(other).acceptApplication(shiftId, chef1.address, {
          value: payment
        })
      ).to.be.revertedWith("Only restaurant can perform this action");
    });

    it("Should reject acceptance of non-applied chef", async function () {
      await expect(
        shiftManager.connect(restaurant).acceptApplication(shiftId, other.address, {
          value: payment
        })
      ).to.be.revertedWith("Chef has not applied to this shift");
    });

    it("Should reject invalid chef address", async function () {
      await expect(
        shiftManager.connect(restaurant).acceptApplication(shiftId, ethers.constants.AddressZero, {
          value: payment
        })
      ).to.be.revertedWith("Invalid chef address");
    });
  });

  describe("Shift Completion", function () {
    let shiftId;
    const detailsCID = "QmTestHash123";
    const payment = ethers.utils.parseEther("1.0");
    const startTime = Math.floor(Date.now() / 1000) + 3600;
    const endTime = startTime + 8 * 3600;

    beforeEach(async function () {
      const tx = await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      const receipt = await tx.wait();
      shiftId = receipt.events.find(e => e.event === "ShiftPosted").args.shiftId.toNumber();
      
      await shiftManager.connect(chef1).applyToShift(shiftId);
      await shiftManager.connect(restaurant).acceptApplication(shiftId, chef1.address, {
        value: payment
      });
    });

    it("Should allow chef to mark shift complete after end time", async function () {
      // Fast forward past end time
      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await network.provider.send("evm_mine");

      await expect(
        shiftManager.connect(chef1).markShiftComplete(shiftId)
      ).to.emit(shiftManager, "ShiftCompleted")
        .withArgs(shiftId, chef1.address);

      const shift = await shiftManager.getShift(shiftId);
      expect(shift.status).to.equal(3); // Completed
    });

    it("Should reject completion before end time", async function () {
      await expect(
        shiftManager.connect(chef1).markShiftComplete(shiftId)
      ).to.be.revertedWith("Shift not yet ended");
    });

    it("Should reject completion from non-accepted chef", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await network.provider.send("evm_mine");

      await expect(
        shiftManager.connect(chef2).markShiftComplete(shiftId)
      ).to.be.revertedWith("Only accepted chef can perform this action");
    });

    it("Should allow restaurant to confirm completion", async function () {
      // Complete the shift first
      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await network.provider.send("evm_mine");
      await shiftManager.connect(chef1).markShiftComplete(shiftId);

      await expect(
        shiftManager.connect(restaurant).confirmCompletion(shiftId)
      ).to.not.be.reverted;

      // Check that escrow was released
      const escrowData = await escrow.getEscrow(shiftId);
      expect(escrowData.status).to.equal(1); // Released
    });

    it("Should update reputation on confirmation", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await network.provider.send("evm_mine");
      await shiftManager.connect(chef1).markShiftComplete(shiftId);

      await shiftManager.connect(restaurant).confirmCompletion(shiftId);

      const chefReputation = await reputation.getReputation(chef1.address);
      const restaurantReputation = await reputation.getReputation(restaurant.address);

      expect(chefReputation.completedShifts).to.equal(1);
      expect(restaurantReputation.completedShifts).to.equal(1);
      expect(chefReputation.ratingCount).to.equal(1);
      expect(restaurantReputation.ratingCount).to.equal(1);
    });
  });

  describe("Shift Disputes", function () {
    let shiftId;
    const detailsCID = "QmTestHash123";
    const payment = ethers.utils.parseEther("1.0");
    const startTime = Math.floor(Date.now() / 1000) + 3600;
    const endTime = startTime + 8 * 3600;

    beforeEach(async function () {
      const tx = await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      const receipt = await tx.wait();
      shiftId = receipt.events.find(e => e.event === "ShiftPosted").args.shiftId.toNumber();
      
      await shiftManager.connect(chef1).applyToShift(shiftId);
      await shiftManager.connect(restaurant).acceptApplication(shiftId, chef1.address, {
        value: payment
      });
    });

    it("Should allow restaurant to dispute shift", async function () {
      const reason = "Chef did not show up";

      await expect(
        shiftManager.connect(restaurant).disputeShift(shiftId, reason)
      ).to.emit(shiftManager, "ShiftDisputed")
        .withArgs(shiftId, reason);

      const shift = await shiftManager.getShift(shiftId);
      expect(shift.status).to.equal(4); // Disputed
    });

    it("Should allow chef to dispute shift", async function () {
      const reason = "Unsafe working conditions";

      await expect(
        shiftManager.connect(chef1).disputeShift(shiftId, reason)
      ).to.emit(shiftManager, "ShiftDisputed")
        .withArgs(shiftId, reason);

      const shift = await shiftManager.getShift(shiftId);
      expect(shift.status).to.equal(4); // Disputed
    });

    it("Should reject dispute from unauthorized user", async function () {
      await expect(
        shiftManager.connect(other).disputeShift(shiftId, "Invalid dispute")
      ).to.be.revertedWith("Only restaurant or chef can dispute");
    });

    it("Should also dispute the escrow", async function () {
      await shiftManager.connect(restaurant).disputeShift(shiftId, "Test dispute");

      const escrowData = await escrow.getEscrow(shiftId);
      expect(escrowData.status).to.equal(3); // Disputed
    });
  });

  describe("Shift Cancellation", function () {
    let shiftId;
    const detailsCID = "QmTestHash123";
    const payment = ethers.utils.parseEther("1.0");
    const startTime = Math.floor(Date.now() / 1000) + 7200;
    const endTime = startTime + 8 * 3600;

    beforeEach(async function () {
      const tx = await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      const receipt = await tx.wait();
      shiftId = receipt.events.find(e => e.event === "ShiftPosted").args.shiftId.toNumber();
    });

    it("Should allow restaurant to cancel posted shift", async function () {
      const reason = "No longer needed";

      await expect(
        shiftManager.connect(restaurant).cancelShift(shiftId, reason)
      ).to.emit(shiftManager, "ShiftCancelled")
        .withArgs(shiftId, reason);

      const shift = await shiftManager.getShift(shiftId);
      expect(shift.status).to.equal(5); // Cancelled
    });

    it("Should allow restaurant to cancel shift with applications", async function () {
      await shiftManager.connect(chef1).applyToShift(shiftId);

      const reason = "Change of plans";
      await expect(
        shiftManager.connect(restaurant).cancelShift(shiftId, reason)
      ).to.not.be.reverted;
    });

    it("Should reject cancellation of accepted shift", async function () {
      await shiftManager.connect(chef1).applyToShift(shiftId);
      await shiftManager.connect(restaurant).acceptApplication(shiftId, chef1.address, {
        value: payment
      });

      await expect(
        shiftManager.connect(restaurant).cancelShift(shiftId, "Too late")
      ).to.be.revertedWith("Cannot cancel accepted shift");
    });

    it("Should reject cancellation from non-restaurant", async function () {
      await expect(
        shiftManager.connect(other).cancelShift(shiftId, "Invalid")
      ).to.be.revertedWith("Only restaurant can perform this action");
    });
  });

  describe("View Functions", function () {
    let shiftId1, shiftId2, shiftId3;
    const detailsCID = "QmTestHash123";
    const payment = ethers.utils.parseEther("1.0");
    const startTime = Math.floor(Date.now() / 1000) + 7200;
    const endTime = startTime + 8 * 3600;

    beforeEach(async function () {
      // Create multiple shifts with different statuses
      let tx = await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      let receipt = await tx.wait();
      shiftId1 = receipt.events.find(e => e.event === "ShiftPosted").args.shiftId.toNumber();

      tx = await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime + 86400, endTime + 86400);
      receipt = await tx.wait();
      shiftId2 = receipt.events.find(e => e.event === "ShiftPosted").args.shiftId.toNumber();

      tx = await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime + 172800, endTime + 172800);
      receipt = await tx.wait();
      shiftId3 = receipt.events.find(e => e.event === "ShiftPosted").args.shiftId.toNumber();

      // Apply to some shifts
      await shiftManager.connect(chef1).applyToShift(shiftId1);
      await shiftManager.connect(chef1).applyToShift(shiftId2);
      await shiftManager.connect(chef2).applyToShift(shiftId2);

      // Accept one application
      await shiftManager.connect(restaurant).acceptApplication(shiftId2, chef1.address, {
        value: payment
      });
    });

    it("Should return active shifts correctly", async function () {
      const activeShifts = await shiftManager.getActiveShifts();
      
      // Should include Posted and Applied shifts
      expect(activeShifts.length).to.equal(2);
      expect(activeShifts).to.include(shiftId1);
      expect(activeShifts).to.include(shiftId3);
      expect(activeShifts).to.not.include(shiftId2); // This one is Accepted
    });

    it("Should return restaurant shifts correctly", async function () {
      const restaurantShifts = await shiftManager.getRestaurantShifts(restaurant.address);
      expect(restaurantShifts.length).to.equal(3);
    });

    it("Should return chef applications correctly", async function () {
      const chef1Applications = await shiftManager.getChefApplications(chef1.address);
      const chef2Applications = await shiftManager.getChefApplications(chef2.address);

      expect(chef1Applications.length).to.equal(2);
      expect(chef2Applications.length).to.equal(1);
    });

    it("Should return chef accepted shifts correctly", async function () {
      const chef1Accepted = await shiftManager.getChefAcceptedShifts(chef1.address);
      const chef2Accepted = await shiftManager.getChefAcceptedShifts(chef2.address);

      expect(chef1Accepted.length).to.equal(1);
      expect(chef1Accepted[0]).to.equal(shiftId2);
      expect(chef2Accepted.length).to.equal(0);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update escrow contract", async function () {
      const newEscrow = other.address;

      await shiftManager.updateEscrowContract(newEscrow);
      expect(await shiftManager.escrowContract()).to.equal(newEscrow);
    });

    it("Should allow owner to update reputation contract", async function () {
      const newReputation = other.address;

      await shiftManager.updateReputationContract(newReputation);
      expect(await shiftManager.reputationContract()).to.equal(newReputation);
    });

    it("Should reject updates from non-owner", async function () {
      await expect(
        shiftManager.connect(other).updateEscrowContract(other.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        shiftManager.connect(other).updateReputationContract(other.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should reject invalid addresses", async function () {
      await expect(
        shiftManager.updateEscrowContract(ethers.constants.AddressZero)
      ).to.be.revertedWith("Invalid address");

      await expect(
        shiftManager.updateReputationContract(ethers.constants.AddressZero)
      ).to.be.revertedWith("Invalid address");
    });
  });

  describe("Gas Optimization Tests", function () {
    it("Should track gas usage for shift posting", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const endTime = startTime + 8 * 3600;

      const tx = await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      const receipt = await tx.wait();

      console.log(`Gas used for postShift: ${receipt.gasUsed}`);
      expect(receipt.gasUsed).to.be.below(300000);
    });

    it("Should track gas usage for application", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 7200;
      const endTime = startTime + 8 * 3600;

      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);

      const tx = await shiftManager.connect(chef1).applyToShift(1);
      const receipt = await tx.wait();

      console.log(`Gas used for applyToShift: ${receipt.gasUsed}`);
      expect(receipt.gasUsed).to.be.below(200000);
    });
  });

  describe("Edge Cases and Security", function () {
    it("Should handle maximum number of applications", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 7200;
      const endTime = startTime + 8 * 3600;

      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);

      // Create multiple chef accounts and apply
      const chefs = [];
      for (let i = 0; i < 10; i++) {
        const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
        await owner.sendTransaction({
          to: wallet.address,
          value: ethers.utils.parseEther("1.0")
        });
        chefs.push(wallet);
      }

      for (const chef of chefs) {
        await shiftManager.connect(chef).applyToShift(1);
      }

      const applications = await shiftManager.getShiftApplications(1);
      expect(applications.length).to.equal(10);
    });

    it("Should prevent reentrancy attacks", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 7200;
      const endTime = startTime + 8 * 3600;

      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);

      // This test ensures the nonReentrant modifier is working
      await expect(
        shiftManager.connect(chef1).applyToShift(1)
      ).to.not.be.reverted;
    });

    it("Should handle concurrent operations correctly", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 7200;
      const endTime = startTime + 8 * 3600;

      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);

      // Multiple applications at the same time
      const promises = [
        shiftManager.connect(chef1).applyToShift(1),
        shiftManager.connect(chef2).applyToShift(1)
      ];

      await Promise.all(promises);

      const applications = await shiftManager.getShiftApplications(1);
      expect(applications.length).to.equal(2);
    });
  });
});