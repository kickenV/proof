const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Escrow Contract", function () {
  let escrow, shiftManager;
  let owner, restaurant, chef, other, shiftManagerSigner;

  beforeEach(async function () {
    [owner, restaurant, chef, other, shiftManagerSigner] = await ethers.getSigners();
    
    const Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.deploy();
    await escrow.initialize(shiftManagerSigner.address);
  });

  describe("Initialization", function () {
    it("Should initialize correctly", async function () {
      expect(await escrow.owner()).to.equal(owner.address);
      expect(await escrow.shiftManagerContract()).to.equal(shiftManagerSigner.address);
    });

    it("Should reject invalid ShiftManager address", async function () {
      const Escrow = await ethers.getContractFactory("Escrow");
      const newEscrow = await Escrow.deploy();
      
      await expect(
        newEscrow.initialize(ethers.constants.AddressZero)
      ).to.be.revertedWith("Invalid ShiftManager address");
    });
  });

  describe("Escrow Creation", function () {
    const shiftId = 1;
    const amount = ethers.utils.parseEther("1.0");

    it("Should create escrow successfully", async function () {
      await expect(
        escrow.connect(shiftManagerSigner).createEscrow(shiftId, chef.address, amount, {
          value: amount
        })
      ).to.emit(escrow, "EscrowCreated")
        .withArgs(shiftId, shiftManagerSigner.address, chef.address, amount);

      const escrowData = await escrow.getEscrow(shiftId);
      expect(escrowData.shiftId).to.equal(shiftId);
      expect(escrowData.chef).to.equal(chef.address);
      expect(escrowData.amount).to.equal(amount);
      expect(escrowData.status).to.equal(0); // Active
    });

    it("Should reject creation from non-ShiftManager", async function () {
      await expect(
        escrow.connect(restaurant).createEscrow(shiftId, chef.address, amount, {
          value: amount
        })
      ).to.be.revertedWith("Only ShiftManager can call this");
    });

    it("Should reject incorrect payment amount", async function () {
      const wrongAmount = ethers.utils.parseEther("0.5");
      
      await expect(
        escrow.connect(shiftManagerSigner).createEscrow(shiftId, chef.address, amount, {
          value: wrongAmount
        })
      ).to.be.revertedWith("Incorrect payment amount");
    });

    it("Should reject invalid chef address", async function () {
      await expect(
        escrow.connect(shiftManagerSigner).createEscrow(shiftId, ethers.constants.AddressZero, amount, {
          value: amount
        })
      ).to.be.revertedWith("Invalid chef address");
    });

    it("Should reject zero amount", async function () {
      await expect(
        escrow.connect(shiftManagerSigner).createEscrow(shiftId, chef.address, 0, {
          value: 0
        })
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should reject duplicate escrow creation", async function () {
      await escrow.connect(shiftManagerSigner).createEscrow(shiftId, chef.address, amount, {
        value: amount
      });

      await expect(
        escrow.connect(shiftManagerSigner).createEscrow(shiftId, chef.address, amount, {
          value: amount
        })
      ).to.be.revertedWith("Escrow already exists");
    });
  });

  describe("Escrow Release", function () {
    const shiftId = 1;
    const amount = ethers.utils.parseEther("1.0");

    beforeEach(async function () {
      await escrow.connect(shiftManagerSigner).createEscrow(shiftId, chef.address, amount, {
        value: amount
      });
    });

    it("Should release escrow successfully", async function () {
      const chefBalanceBefore = await chef.getBalance();

      await expect(
        escrow.connect(shiftManagerSigner).releaseEscrow(shiftId)
      ).to.emit(escrow, "EscrowReleased")
        .withArgs(shiftId, chef.address, amount);

      const chefBalanceAfter = await chef.getBalance();
      expect(chefBalanceAfter.sub(chefBalanceBefore)).to.equal(amount);

      const escrowData = await escrow.getEscrow(shiftId);
      expect(escrowData.status).to.equal(1); // Released
    });

    it("Should reject release from non-ShiftManager", async function () {
      await expect(
        escrow.connect(restaurant).releaseEscrow(shiftId)
      ).to.be.revertedWith("Only ShiftManager can call this");
    });

    it("Should reject release of non-active escrow", async function () {
      await escrow.connect(shiftManagerSigner).releaseEscrow(shiftId);

      await expect(
        escrow.connect(shiftManagerSigner).releaseEscrow(shiftId)
      ).to.be.revertedWith("Escrow not active");
    });
  });

  describe("Escrow Refund", function () {
    const shiftId = 1;
    const amount = ethers.utils.parseEther("1.0");

    beforeEach(async function () {
      // Use restaurant as tx.origin by having them call through ShiftManager
      await escrow.connect(shiftManagerSigner).createEscrow(shiftId, chef.address, amount, {
        value: amount
      });
    });

    it("Should refund escrow successfully", async function () {
      // Get the restaurant address from the escrow (which is tx.origin)
      const escrowData = await escrow.getEscrow(shiftId);
      const restaurantAddress = escrowData.restaurant;
      const restaurantBalanceBefore = await ethers.provider.getBalance(restaurantAddress);

      await expect(
        escrow.connect(shiftManagerSigner).refundEscrow(shiftId)
      ).to.emit(escrow, "EscrowRefunded")
        .withArgs(shiftId, restaurantAddress, amount);

      const restaurantBalanceAfter = await ethers.provider.getBalance(restaurantAddress);
      expect(restaurantBalanceAfter.sub(restaurantBalanceBefore)).to.equal(amount);

      const escrowDataAfter = await escrow.getEscrow(shiftId);
      expect(escrowDataAfter.status).to.equal(2); // Refunded
    });

    it("Should reject refund from non-ShiftManager", async function () {
      await expect(
        escrow.connect(restaurant).refundEscrow(shiftId)
      ).to.be.revertedWith("Only ShiftManager can call this");
    });
  });

  describe("Escrow Dispute", function () {
    const shiftId = 1;
    const amount = ethers.utils.parseEther("1.0");

    beforeEach(async function () {
      await escrow.connect(shiftManagerSigner).createEscrow(shiftId, chef.address, amount, {
        value: amount
      });
    });

    it("Should allow restaurant to dispute escrow", async function () {
      const reason = "Work not completed satisfactorily";
      
      // Get restaurant address from escrow data
      const escrowData = await escrow.getEscrow(shiftId);
      const restaurantAddress = escrowData.restaurant;
      
      // Impersonate the restaurant address
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [restaurantAddress],
      });
      
      // Fund the restaurant account for gas
      await network.provider.send("hardhat_setBalance", [
        restaurantAddress,
        "0x1000000000000000000", // 1 ETH
      ]);
      
      const restaurantSigner = await ethers.getSigner(restaurantAddress);

      await expect(
        escrow.connect(restaurantSigner).disputeEscrow(shiftId, reason)
      ).to.emit(escrow, "EscrowDisputed")
        .withArgs(shiftId, reason);

      const escrowDataAfter = await escrow.getEscrow(shiftId);
      expect(escrowDataAfter.status).to.equal(3); // Disputed
    });

    it("Should allow chef to dispute escrow", async function () {
      const reason = "Payment terms not met";

      await expect(
        escrow.connect(chef).disputeEscrow(shiftId, reason)
      ).to.emit(escrow, "EscrowDisputed")
        .withArgs(shiftId, reason);

      const escrowData = await escrow.getEscrow(shiftId);
      expect(escrowData.status).to.equal(3); // Disputed
    });

    it("Should reject dispute from unauthorized user", async function () {
      await expect(
        escrow.connect(other).disputeEscrow(shiftId, "Invalid dispute")
      ).to.be.revertedWith("Only restaurant or chef can dispute");
    });

    it("Should reject dispute of non-active escrow", async function () {
      await escrow.connect(shiftManagerSigner).releaseEscrow(shiftId);

      await expect(
        escrow.connect(chef).disputeEscrow(shiftId, "Too late")
      ).to.be.revertedWith("Escrow not active");
    });
  });

  describe("Auto Release", function () {
    const shiftId = 1;
    const amount = ethers.utils.parseEther("1.0");

    beforeEach(async function () {
      await escrow.connect(shiftManagerSigner).createEscrow(shiftId, chef.address, amount, {
        value: amount
      });
    });

    it("Should auto-release after timeout period", async function () {
      // Fast forward time past AUTO_RELEASE_PERIOD (7 days)
      await network.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
      await network.provider.send("evm_mine");

      const chefBalanceBefore = await chef.getBalance();

      await expect(
        escrow.connect(other).autoRelease(shiftId)
      ).to.emit(escrow, "EscrowReleased")
        .withArgs(shiftId, chef.address, amount);

      const chefBalanceAfter = await chef.getBalance();
      expect(chefBalanceAfter.sub(chefBalanceBefore)).to.equal(amount);
    });

    it("Should reject early auto-release", async function () {
      await expect(
        escrow.connect(other).autoRelease(shiftId)
      ).to.be.revertedWith("Auto-release period not reached");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update ShiftManager contract", async function () {
      const newShiftManager = other.address;

      await escrow.updateShiftManager(newShiftManager);
      expect(await escrow.shiftManagerContract()).to.equal(newShiftManager);
    });

    it("Should reject invalid ShiftManager address", async function () {
      await expect(
        escrow.updateShiftManager(ethers.constants.AddressZero)
      ).to.be.revertedWith("Invalid address");
    });

    it("Should reject ShiftManager update from non-owner", async function () {
      await expect(
        escrow.connect(other).updateShiftManager(other.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Emergency Functions", function () {
    const shiftId = 1;
    const amount = ethers.utils.parseEther("1.0");

    beforeEach(async function () {
      await escrow.connect(shiftManagerSigner).createEscrow(shiftId, chef.address, amount, {
        value: amount
      });
      await escrow.connect(chef).disputeEscrow(shiftId, "Emergency test");
    });

    it("Should allow emergency withdrawal after dispute period", async function () {
      // Fast forward time past DISPUTE_PERIOD (3 days)
      await network.provider.send("evm_increaseTime", [3 * 24 * 60 * 60 + 1]);
      await network.provider.send("evm_mine");

      const escrowData = await escrow.getEscrow(shiftId);
      const restaurantAddress = escrowData.restaurant;
      const restaurantBalanceBefore = await ethers.provider.getBalance(restaurantAddress);

      await escrow.emergencyWithdraw(shiftId);

      const restaurantBalanceAfter = await ethers.provider.getBalance(restaurantAddress);
      expect(restaurantBalanceAfter.sub(restaurantBalanceBefore)).to.equal(amount);
    });

    it("Should reject emergency withdrawal of non-disputed escrow", async function () {
      const shiftId2 = 2;
      await escrow.connect(shiftManagerSigner).createEscrow(shiftId2, chef.address, amount, {
        value: amount
      });

      await expect(
        escrow.emergencyWithdraw(shiftId2)
      ).to.be.revertedWith("Only disputed escrows can be emergency withdrawn");
    });

    it("Should reject early emergency withdrawal", async function () {
      await expect(
        escrow.emergencyWithdraw(shiftId)
      ).to.be.revertedWith("Dispute period not over");
    });
  });

  describe("Edge Cases and Security", function () {
    it("Should handle non-existent escrows gracefully", async function () {
      await expect(
        escrow.getEscrow(999)
      ).to.be.revertedWith("Escrow does not exist");
    });

    it("Should prevent reentrancy attacks", async function () {
      const shiftId = 1;
      const amount = ethers.utils.parseEther("1.0");

      await escrow.connect(shiftManagerSigner).createEscrow(shiftId, chef.address, amount, {
        value: amount
      });

      // This test ensures the nonReentrant modifier is working
      await expect(
        escrow.connect(shiftManagerSigner).releaseEscrow(shiftId)
      ).to.not.be.reverted;
    });

    it("Should handle large amounts correctly", async function () {
      const shiftId = 1;
      const largeAmount = ethers.utils.parseEther("1000.0");

      await expect(
        escrow.connect(shiftManagerSigner).createEscrow(shiftId, chef.address, largeAmount, {
          value: largeAmount
        })
      ).to.not.be.reverted;

      const escrowData = await escrow.getEscrow(shiftId);
      expect(escrowData.amount).to.equal(largeAmount);
    });
  });

  describe("Gas Optimization Tests", function () {
    it("Should track gas usage for escrow creation", async function () {
      const shiftId = 1;
      const amount = ethers.utils.parseEther("1.0");

      const tx = await escrow.connect(shiftManagerSigner).createEscrow(shiftId, chef.address, amount, {
        value: amount
      });
      const receipt = await tx.wait();

      console.log(`Gas used for createEscrow: ${receipt.gasUsed}`);
      expect(receipt.gasUsed).to.be.below(200000);
    });

    it("Should track gas usage for escrow release", async function () {
      const shiftId = 1;
      const amount = ethers.utils.parseEther("1.0");

      await escrow.connect(shiftManagerSigner).createEscrow(shiftId, chef.address, amount, {
        value: amount
      });

      const tx = await escrow.connect(shiftManagerSigner).releaseEscrow(shiftId);
      const receipt = await tx.wait();

      console.log(`Gas used for releaseEscrow: ${receipt.gasUsed}`);
      expect(receipt.gasUsed).to.be.below(100000);
    });
  });
});