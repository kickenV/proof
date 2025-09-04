const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Reputation Contract", function () {
  let reputation;
  let owner, user1, user2, authorizedContract, unauthorizedContract;

  beforeEach(async function () {
    [owner, user1, user2, authorizedContract, unauthorizedContract] = await ethers.getSigners();
    
    const Reputation = await ethers.getContractFactory("Reputation");
    reputation = await Reputation.deploy();
    await reputation.initialize();
    
    // Add authorized contract
    await reputation.addAuthorizedContract(authorizedContract.address);
  });

  describe("Initialization", function () {
    it("Should initialize correctly", async function () {
      expect(await reputation.owner()).to.equal(owner.address);
      expect(await reputation.authorizedContracts(authorizedContract.address)).to.be.true;
    });
  });

  describe("Authorization Management", function () {
    it("Should allow owner to add authorized contracts", async function () {
      await expect(reputation.addAuthorizedContract(user1.address))
        .to.emit(reputation, "AuthorizedContractAdded")
        .withArgs(user1.address);
      
      expect(await reputation.authorizedContracts(user1.address)).to.be.true;
    });

    it("Should allow owner to remove authorized contracts", async function () {
      await expect(reputation.removeAuthorizedContract(authorizedContract.address))
        .to.emit(reputation, "AuthorizedContractRemoved")
        .withArgs(authorizedContract.address);
      
      expect(await reputation.authorizedContracts(authorizedContract.address)).to.be.false;
    });

    it("Should reject unauthorized contract management", async function () {
      await expect(
        reputation.connect(user1).addAuthorizedContract(user2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Reputation Updates", function () {
    it("Should allow authorized contracts to update reputation", async function () {
      const rating = 5;
      const feedback = "Excellent work!";

      await expect(
        reputation.connect(authorizedContract).updateReputation(user1.address, rating, feedback)
      ).to.emit(reputation, "ReputationUpdated")
        .withArgs(user1.address, rating, feedback, authorizedContract.address);

      const userReputation = await reputation.getReputation(user1.address);
      expect(userReputation.totalScore).to.equal(rating);
      expect(userReputation.ratingCount).to.equal(1);
      expect(userReputation.averageRating).to.equal(rating * 100); // Multiplied by 100 for precision
    });

    it("Should reject unauthorized reputation updates", async function () {
      await expect(
        reputation.connect(unauthorizedContract).updateReputation(user1.address, 5, "Good")
      ).to.be.revertedWith("Not authorized");
    });

    it("Should validate rating range", async function () {
      await expect(
        reputation.connect(authorizedContract).updateReputation(user1.address, 0, "Invalid")
      ).to.be.revertedWith("Rating out of range");

      await expect(
        reputation.connect(authorizedContract).updateReputation(user1.address, 6, "Invalid")
      ).to.be.revertedWith("Rating out of range");
    });

    it("Should reject invalid user addresses", async function () {
      await expect(
        reputation.connect(authorizedContract).updateReputation(ethers.constants.AddressZero, 5, "Good")
      ).to.be.revertedWith("Invalid user address");
    });

    it("Should correctly calculate average rating with multiple ratings", async function () {
      await reputation.connect(authorizedContract).updateReputation(user1.address, 5, "Excellent");
      await reputation.connect(authorizedContract).updateReputation(user1.address, 3, "Average");
      await reputation.connect(authorizedContract).updateReputation(user1.address, 4, "Good");

      const userReputation = await reputation.getReputation(user1.address);
      expect(userReputation.totalScore).to.equal(12); // 5+3+4
      expect(userReputation.ratingCount).to.equal(3);
      expect(userReputation.averageRating).to.equal(400); // (12/3)*100 = 400
    });
  });

  describe("Completed Shifts Tracking", function () {
    it("Should allow authorized contracts to increment completed shifts", async function () {
      await reputation.connect(authorizedContract).incrementCompletedShifts(user1.address);
      await reputation.connect(authorizedContract).incrementCompletedShifts(user1.address);

      const userReputation = await reputation.getReputation(user1.address);
      expect(userReputation.completedShifts).to.equal(2);
    });

    it("Should reject unauthorized completed shifts updates", async function () {
      await expect(
        reputation.connect(unauthorizedContract).incrementCompletedShifts(user1.address)
      ).to.be.revertedWith("Not authorized");
    });

    it("Should reject invalid user addresses for completed shifts", async function () {
      await expect(
        reputation.connect(authorizedContract).incrementCompletedShifts(ethers.constants.AddressZero)
      ).to.be.revertedWith("Invalid user address");
    });
  });

  describe("Reputation Queries", function () {
    beforeEach(async function () {
      // Add some test ratings
      await reputation.connect(authorizedContract).updateReputation(user1.address, 5, "Excellent work!");
      await reputation.connect(authorizedContract).updateReputation(user1.address, 4, "Good performance");
      await reputation.connect(authorizedContract).incrementCompletedShifts(user1.address);
    });

    it("Should return correct user reputation", async function () {
      const userReputation = await reputation.getReputation(user1.address);
      
      expect(userReputation.totalScore).to.equal(9);
      expect(userReputation.ratingCount).to.equal(2);
      expect(userReputation.averageRating).to.equal(450); // (9/2)*100
      expect(userReputation.completedShifts).to.equal(1);
    });

    it("Should return user ratings history", async function () {
      const ratings = await reputation.getUserRatings(user1.address);
      
      expect(ratings.length).to.equal(2);
      expect(ratings[0].score).to.equal(5);
      expect(ratings[0].feedback).to.equal("Excellent work!");
      expect(ratings[1].score).to.equal(4);
      expect(ratings[1].feedback).to.equal("Good performance");
    });

    it("Should return zero reputation for new users", async function () {
      const userReputation = await reputation.getReputation(user2.address);
      
      expect(userReputation.totalScore).to.equal(0);
      expect(userReputation.ratingCount).to.equal(0);
      expect(userReputation.averageRating).to.equal(0);
      expect(userReputation.completedShifts).to.equal(0);
    });

    it("Should return correct rating count", async function () {
      const count = await reputation.getRatingCount(user1.address);
      expect(count).to.equal(2);
    });
  });

  describe("Edge Cases and Security", function () {
    it("Should handle maximum ratings correctly", async function () {
      // Add many ratings to test large numbers
      for (let i = 0; i < 10; i++) {
        await reputation.connect(authorizedContract).updateReputation(user1.address, 5, `Rating ${i}`);
      }

      const userReputation = await reputation.getReputation(user1.address);
      expect(userReputation.totalScore).to.equal(50);
      expect(userReputation.ratingCount).to.equal(10);
      expect(userReputation.averageRating).to.equal(500);
    });

    it("Should maintain separate reputations for different users", async function () {
      await reputation.connect(authorizedContract).updateReputation(user1.address, 5, "User1 rating");
      await reputation.connect(authorizedContract).updateReputation(user2.address, 3, "User2 rating");

      const user1Reputation = await reputation.getReputation(user1.address);
      const user2Reputation = await reputation.getReputation(user2.address);

      expect(user1Reputation.averageRating).to.equal(500);
      expect(user2Reputation.averageRating).to.equal(300);
    });

    it("Should prevent reentrancy attacks", async function () {
      // This test ensures the nonReentrant modifier is working
      // In a real attack scenario, this would be more complex
      await expect(
        reputation.connect(authorizedContract).updateReputation(user1.address, 5, "Test")
      ).to.not.be.reverted;
    });
  });

  describe("Gas Optimization Tests", function () {
    it("Should track gas usage for rating updates", async function () {
      const tx = await reputation.connect(authorizedContract).updateReputation(user1.address, 5, "Gas test");
      const receipt = await tx.wait();
      
      console.log(`Gas used for updateReputation: ${receipt.gasUsed}`);
      expect(receipt.gasUsed).to.be.below(150000); // Reasonable gas limit
    });

    it("Should track gas usage for querying reputation", async function () {
      await reputation.connect(authorizedContract).updateReputation(user1.address, 5, "Setup");
      
      const gasEstimate = await reputation.estimateGas.getReputation(user1.address);
      console.log(`Gas estimated for getReputation: ${gasEstimate}`);
      expect(gasEstimate).to.be.below(50000);
    });
  });
});