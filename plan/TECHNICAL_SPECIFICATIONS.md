# ChefsPlan MVP Technical Specifications

## Smart Contract Specifications

### ShiftManager.sol - Detailed Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./interfaces/IEscrow.sol";
import "./interfaces/IReputation.sol";

contract ShiftManager is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    
    // State Variables
    struct Shift {
        uint256 id;
        address restaurant;
        address chef;
        string detailsCID;      // IPFS hash for shift details
        uint256 payment;        // Payment amount in wei
        ShiftStatus status;
        uint256 createdAt;
        uint256 startTime;      // Shift start timestamp
        uint256 endTime;        // Shift end timestamp
    }
    
    enum ShiftStatus { 
        Posted,     // 0 - Shift posted, accepting applications
        Applied,    // 1 - At least one chef has applied
        Accepted,   // 2 - Restaurant has accepted a chef
        Completed,  // 3 - Shift completed successfully
        Disputed,   // 4 - Dispute raised
        Cancelled   // 5 - Shift cancelled
    }
    
    // Mappings
    mapping(uint256 => Shift) public shifts;
    mapping(uint256 => address[]) public shiftApplications;
    mapping(address => uint256[]) public restaurantShifts;
    mapping(address => uint256[]) public chefApplications;
    
    // State
    uint256 public nextShiftId;
    IEscrow public escrowContract;
    IReputation public reputationContract;
    
    // Constants
    uint256 public constant APPLICATION_PERIOD = 1 hours;
    uint256 public constant COMPLETION_TIMEOUT = 2 hours;
    
    // Events
    event ShiftPosted(
        uint256 indexed shiftId, 
        address indexed restaurant, 
        string detailsCID, 
        uint256 payment,
        uint256 startTime,
        uint256 endTime
    );
    
    event ShiftApplied(uint256 indexed shiftId, address indexed chef);
    event ShiftAccepted(uint256 indexed shiftId, address indexed chef);
    event ShiftCompleted(uint256 indexed shiftId, address indexed chef);
    event ShiftDisputed(uint256 indexed shiftId, string reason);
    event ShiftCancelled(uint256 indexed shiftId, string reason);
    
    // Modifiers
    modifier onlyRestaurant(uint256 shiftId) {
        require(shifts[shiftId].restaurant == msg.sender, "Only restaurant can perform this action");
        _;
    }
    
    modifier onlyAcceptedChef(uint256 shiftId) {
        require(shifts[shiftId].chef == msg.sender, "Only accepted chef can perform this action");
        _;
    }
    
    modifier validShift(uint256 shiftId) {
        require(shiftId < nextShiftId && shiftId > 0, "Invalid shift ID");
        _;
    }
    
    // Functions
    function initialize(address _escrow, address _reputation) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        escrowContract = IEscrow(_escrow);
        reputationContract = IReputation(_reputation);
        nextShiftId = 1;
    }
    
    function postShift(
        string memory detailsCID,
        uint256 payment,
        uint256 startTime,
        uint256 endTime
    ) external nonReentrant returns (uint256) {
        require(bytes(detailsCID).length > 0, "Details CID required");
        require(payment > 0, "Payment must be greater than 0");
        require(startTime > block.timestamp, "Start time must be in future");
        require(endTime > startTime, "End time must be after start time");
        
        uint256 shiftId = nextShiftId++;
        
        shifts[shiftId] = Shift({
            id: shiftId,
            restaurant: msg.sender,
            chef: address(0),
            detailsCID: detailsCID,
            payment: payment,
            status: ShiftStatus.Posted,
            createdAt: block.timestamp,
            startTime: startTime,
            endTime: endTime
        });
        
        restaurantShifts[msg.sender].push(shiftId);
        
        emit ShiftPosted(shiftId, msg.sender, detailsCID, payment, startTime, endTime);
        return shiftId;
    }
    
    function applyToShift(uint256 shiftId) external validShift(shiftId) {
        Shift storage shift = shifts[shiftId];
        require(shift.status == ShiftStatus.Posted, "Shift not accepting applications");
        require(msg.sender != shift.restaurant, "Restaurant cannot apply to own shift");
        require(block.timestamp < shift.startTime - APPLICATION_PERIOD, "Application period closed");
        
        // Check if chef already applied
        address[] storage applications = shiftApplications[shiftId];
        for (uint i = 0; i < applications.length; i++) {
            require(applications[i] != msg.sender, "Already applied to this shift");
        }
        
        applications.push(msg.sender);
        chefApplications[msg.sender].push(shiftId);
        
        if (shift.status == ShiftStatus.Posted) {
            shifts[shiftId].status = ShiftStatus.Applied;
        }
        
        emit ShiftApplied(shiftId, msg.sender);
    }
    
    function acceptApplication(uint256 shiftId, address chef) 
        external 
        validShift(shiftId) 
        onlyRestaurant(shiftId) 
        nonReentrant 
    {
        Shift storage shift = shifts[shiftId];
        require(shift.status == ShiftStatus.Applied, "No applications to accept");
        require(chef != address(0), "Invalid chef address");
        
        // Verify chef applied
        address[] storage applications = shiftApplications[shiftId];
        bool hasApplied = false;
        for (uint i = 0; i < applications.length; i++) {
            if (applications[i] == chef) {
                hasApplied = true;
                break;
            }
        }
        require(hasApplied, "Chef has not applied to this shift");
        
        shift.chef = chef;
        shift.status = ShiftStatus.Accepted;
        
        // Create escrow
        escrowContract.createEscrow{value: shift.payment}(shiftId, chef, shift.payment);
        
        emit ShiftAccepted(shiftId, chef);
    }
    
    function markShiftComplete(uint256 shiftId) 
        external 
        validShift(shiftId) 
        onlyAcceptedChef(shiftId) 
    {
        Shift storage shift = shifts[shiftId];
        require(shift.status == ShiftStatus.Accepted, "Shift not in accepted state");
        require(block.timestamp >= shift.endTime, "Shift not yet completed");
        
        shift.status = ShiftStatus.Completed;
        
        emit ShiftCompleted(shiftId, msg.sender);
    }
    
    function confirmCompletion(uint256 shiftId) 
        external 
        validShift(shiftId) 
        onlyRestaurant(shiftId) 
        nonReentrant 
    {
        Shift storage shift = shifts[shiftId];
        require(shift.status == ShiftStatus.Completed, "Shift not marked as completed");
        
        // Release escrow
        escrowContract.releaseEscrow(shiftId);
        
        // Update reputation (basic implementation)
        reputationContract.updateReputation(shift.chef, 5, "Shift completed successfully");
        reputationContract.updateReputation(shift.restaurant, 5, "Payment released on time");
    }
    
    // View functions
    function getShift(uint256 shiftId) external view validShift(shiftId) returns (Shift memory) {
        return shifts[shiftId];
    }
    
    function getShiftApplications(uint256 shiftId) external view validShift(shiftId) returns (address[] memory) {
        return shiftApplications[shiftId];
    }
    
    function getRestaurantShifts(address restaurant) external view returns (uint256[] memory) {
        return restaurantShifts[restaurant];
    }
    
    function getChefApplications(address chef) external view returns (uint256[] memory) {
        return chefApplications[chef];
    }
}
```

### Escrow.sol - Detailed Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract Escrow is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    
    struct EscrowData {
        uint256 shiftId;
        address restaurant;
        address chef;
        uint256 amount;
        EscrowStatus status;
        uint256 createdAt;
        uint256 releaseAfter;
    }
    
    enum EscrowStatus {
        Active,     // 0 - Funds locked
        Released,   // 1 - Funds released to chef
        Refunded,   // 2 - Funds refunded to restaurant
        Disputed    // 3 - Under dispute
    }
    
    mapping(uint256 => EscrowData) public escrows;
    address public shiftManagerContract;
    
    uint256 public constant AUTO_RELEASE_PERIOD = 7 days;
    
    event EscrowCreated(uint256 indexed shiftId, address indexed restaurant, address indexed chef, uint256 amount);
    event EscrowReleased(uint256 indexed shiftId, address indexed chef, uint256 amount);
    event EscrowRefunded(uint256 indexed shiftId, address indexed restaurant, uint256 amount);
    event EscrowDisputed(uint256 indexed shiftId, string reason);
    
    modifier onlyShiftManager() {
        require(msg.sender == shiftManagerContract, "Only ShiftManager can call this");
        _;
    }
    
    function initialize(address _shiftManager) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        shiftManagerContract = _shiftManager;
    }
    
    function createEscrow(
        uint256 shiftId,
        address chef,
        uint256 amount
    ) external payable onlyShiftManager nonReentrant {
        require(msg.value == amount, "Incorrect payment amount");
        require(chef != address(0), "Invalid chef address");
        require(escrows[shiftId].shiftId == 0, "Escrow already exists");
        
        escrows[shiftId] = EscrowData({
            shiftId: shiftId,
            restaurant: tx.origin, // The restaurant that initiated the transaction
            chef: chef,
            amount: amount,
            status: EscrowStatus.Active,
            createdAt: block.timestamp,
            releaseAfter: block.timestamp + AUTO_RELEASE_PERIOD
        });
        
        emit EscrowCreated(shiftId, tx.origin, chef, amount);
    }
    
    function releaseEscrow(uint256 shiftId) external onlyShiftManager nonReentrant {
        EscrowData storage escrow = escrows[shiftId];
        require(escrow.status == EscrowStatus.Active, "Escrow not active");
        
        escrow.status = EscrowStatus.Released;
        
        (bool success, ) = escrow.chef.call{value: escrow.amount}("");
        require(success, "Payment transfer failed");
        
        emit EscrowReleased(shiftId, escrow.chef, escrow.amount);
    }
    
    function autoRelease(uint256 shiftId) external nonReentrant {
        EscrowData storage escrow = escrows[shiftId];
        require(escrow.status == EscrowStatus.Active, "Escrow not active");
        require(block.timestamp >= escrow.releaseAfter, "Auto-release period not reached");
        
        escrow.status = EscrowStatus.Released;
        
        (bool success, ) = escrow.chef.call{value: escrow.amount}("");
        require(success, "Payment transfer failed");
        
        emit EscrowReleased(shiftId, escrow.chef, escrow.amount);
    }
    
    function getEscrow(uint256 shiftId) external view returns (EscrowData memory) {
        return escrows[shiftId];
    }
}
```

## Frontend Technical Specifications

### Web3 Context Provider

```typescript
// context/Web3Context.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Provider, Wallet } from 'zksync-web3';

interface Web3ContextType {
  provider: Provider | null;
  signer: ethers.Signer | null;
  account: string | null;
  isConnected: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchToZkSync: () => Promise<void>;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        const zkProvider = new Provider('https://testnet.era.zksync.dev');
        const ethProvider = new ethers.providers.Web3Provider(window.ethereum);
        const zkSigner = zkProvider.getSigner();
        
        setProvider(zkProvider);
        setSigner(zkSigner);
        
        const address = await zkSigner.getAddress();
        setAccount(address);
        setIsConnected(true);
        
        await switchToZkSync();
      } catch (error) {
        console.error('Failed to connect wallet:', error);
      }
    }
  };

  const switchToZkSync = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x118' }], // zkSync Era Testnet
      });
    } catch (switchError: any) {
      // Chain not added, add it
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x118',
            chainName: 'zkSync Era Testnet',
            nativeCurrency: {
              name: 'Ethereum',
              symbol: 'ETH',
              decimals: 18,
            },
            rpcUrls: ['https://testnet.era.zksync.dev'],
            blockExplorerUrls: ['https://goerli.explorer.zksync.io/'],
          }],
        });
      }
    }
  };

  const disconnectWallet = () => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setIsConnected(false);
  };

  return (
    <Web3Context.Provider value={{
      provider,
      signer,
      account,
      isConnected,
      connectWallet,
      disconnectWallet,
      switchToZkSync
    }}>
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within Web3Provider');
  }
  return context;
};
```

### Contract Interaction Utilities

```typescript
// utils/contracts.ts
import { ethers } from 'ethers';
import { Contract } from 'zksync-web3';
import ShiftManagerABI from '../abis/ShiftManager.json';
import EscrowABI from '../abis/Escrow.json';

export const CONTRACT_ADDRESSES = {
  SHIFT_MANAGER: process.env.NEXT_PUBLIC_SHIFT_MANAGER_ADDRESS || '',
  ESCROW: process.env.NEXT_PUBLIC_ESCROW_ADDRESS || '',
  REPUTATION: process.env.NEXT_PUBLIC_REPUTATION_ADDRESS || '',
};

export class ContractService {
  private shiftManager: Contract;
  private escrow: Contract;

  constructor(signer: ethers.Signer) {
    this.shiftManager = new Contract(
      CONTRACT_ADDRESSES.SHIFT_MANAGER,
      ShiftManagerABI.abi,
      signer
    );
    
    this.escrow = new Contract(
      CONTRACT_ADDRESSES.ESCROW,
      EscrowABI.abi,
      signer
    );
  }

  async postShift(details: ShiftDetails): Promise<string> {
    const tx = await this.shiftManager.postShift(
      details.detailsCID,
      ethers.utils.parseEther(details.payment),
      details.startTime,
      details.endTime
    );
    
    const receipt = await tx.wait();
    const event = receipt.events?.find((e: any) => e.event === 'ShiftPosted');
    return event?.args?.shiftId.toString() || '';
  }

  async applyToShift(shiftId: string): Promise<void> {
    const tx = await this.shiftManager.applyToShift(shiftId);
    await tx.wait();
  }

  async acceptApplication(shiftId: string, chefAddress: string): Promise<void> {
    const shift = await this.shiftManager.getShift(shiftId);
    const tx = await this.shiftManager.acceptApplication(shiftId, chefAddress, {
      value: shift.payment
    });
    await tx.wait();
  }

  async getShift(shiftId: string): Promise<any> {
    return await this.shiftManager.getShift(shiftId);
  }

  async getShiftApplications(shiftId: string): Promise<string[]> {
    return await this.shiftManager.getShiftApplications(shiftId);
  }
}

interface ShiftDetails {
  detailsCID: string;
  payment: string;
  startTime: number;
  endTime: number;
}
```

## Testing Specifications

### Smart Contract Tests

```javascript
// test/ShiftManager.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployContract, getWallet } = require("@matterlabs/hardhat-zksync-deploy");

describe("ShiftManager", function () {
  let shiftManager, escrow, reputation;
  let restaurant, chef, admin;

  beforeEach(async function () {
    [admin, restaurant, chef] = await ethers.getSigners();
    
    // Deploy contracts
    reputation = await deployContract("Reputation", []);
    escrow = await deployContract("Escrow", []);
    shiftManager = await deployContract("ShiftManager", []);
    
    // Initialize contracts
    await shiftManager.initialize(escrow.address, reputation.address);
    await escrow.initialize(shiftManager.address);
  });

  describe("Shift Posting", function () {
    it("Should allow restaurant to post a shift", async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const endTime = startTime + 28800; // 8 hours shift

      const tx = await shiftManager.connect(restaurant).postShift(
        detailsCID,
        payment,
        startTime,
        endTime
      );

      await expect(tx)
        .to.emit(shiftManager, "ShiftPosted")
        .withArgs(1, restaurant.address, detailsCID, payment, startTime, endTime);

      const shift = await shiftManager.getShift(1);
      expect(shift.restaurant).to.equal(restaurant.address);
      expect(shift.payment).to.equal(payment);
    });

    it("Should reject invalid shift parameters", async function () {
      await expect(
        shiftManager.connect(restaurant).postShift("", ethers.utils.parseEther("1.0"), 0, 0)
      ).to.be.revertedWith("Details CID required");

      await expect(
        shiftManager.connect(restaurant).postShift("QmTest", 0, Date.now(), Date.now())
      ).to.be.revertedWith("Payment must be greater than 0");
    });
  });

  describe("Applications", function () {
    let shiftId;

    beforeEach(async function () {
      const detailsCID = "QmTestHash123";
      const payment = ethers.utils.parseEther("1.0");
      const startTime = Math.floor(Date.now() / 1000) + 7200; // 2 hours from now
      const endTime = startTime + 28800;

      await shiftManager.connect(restaurant).postShift(detailsCID, payment, startTime, endTime);
      shiftId = 1;
    });

    it("Should allow chef to apply to shift", async function () {
      const tx = await shiftManager.connect(chef).applyToShift(shiftId);
      
      await expect(tx)
        .to.emit(shiftManager, "ShiftApplied")
        .withArgs(shiftId, chef.address);

      const applications = await shiftManager.getShiftApplications(shiftId);
      expect(applications).to.include(chef.address);
    });

    it("Should prevent duplicate applications", async function () {
      await shiftManager.connect(chef).applyToShift(shiftId);
      
      await expect(
        shiftManager.connect(chef).applyToShift(shiftId)
      ).to.be.revertedWith("Already applied to this shift");
    });
  });
});
```

### Frontend Integration Tests

```typescript
// __tests__/integration/shift-workflow.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import ShiftDashboard from '../../pages/chef/dashboard';
import { Web3Provider } from '../../context/Web3Context';

// Mock Web3 context
const mockWeb3Context = {
  provider: null,
  signer: null,
  account: '0x123...abc',
  isConnected: true,
  connectWallet: jest.fn(),
  disconnectWallet: jest.fn(),
  switchToZkSync: jest.fn(),
};

jest.mock('../../context/Web3Context', () => ({
  useWeb3: () => mockWeb3Context,
}));

describe('Shift Workflow Integration', () => {
  it('should allow chef to view and apply to shifts', async () => {
    render(
      <Web3Provider>
        <ShiftDashboard />
      </Web3Provider>
    );

    // Wait for shifts to load
    await waitFor(() => {
      expect(screen.getByText('Available Shifts')).toBeInTheDocument();
    });

    // Find and click apply button
    const applyButton = screen.getByText('Apply to Shift');
    fireEvent.click(applyButton);

    // Verify application modal appears
    await waitFor(() => {
      expect(screen.getByText('Confirm Application')).toBeInTheDocument();
    });
  });
});
```

## Deployment Scripts

### Hardhat Deployment Script

```javascript
// scripts/deploy.js
const { deployContract } = require("@matterlabs/hardhat-zksync-deploy");
const { getWallet } = require("@matterlabs/hardhat-zksync-deploy");

async function main() {
  console.log("Starting deployment to zkSync Era...");
  
  const wallet = getWallet();
  console.log(`Deploying from: ${wallet.address}`);

  // Deploy Reputation contract
  console.log("Deploying Reputation...");
  const reputation = await deployContract("Reputation", []);
  console.log(`Reputation deployed to: ${reputation.address}`);

  // Deploy Escrow contract  
  console.log("Deploying Escrow...");
  const escrow = await deployContract("Escrow", []);
  console.log(`Escrow deployed to: ${escrow.address}`);

  // Deploy ShiftManager contract
  console.log("Deploying ShiftManager...");
  const shiftManager = await deployContract("ShiftManager", []);
  console.log(`ShiftManager deployed to: ${shiftManager.address}`);

  // Initialize contracts
  console.log("Initializing contracts...");
  
  await shiftManager.initialize(escrow.address, reputation.address);
  console.log("ShiftManager initialized");
  
  await escrow.initialize(shiftManager.address);
  console.log("Escrow initialized");

  // Verify deployments
  console.log("\n=== Deployment Summary ===");
  console.log(`Reputation: ${reputation.address}`);
  console.log(`Escrow: ${escrow.address}`);
  console.log(`ShiftManager: ${shiftManager.address}`);
  
  console.log("\nDeployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

This technical specification provides detailed implementation guidance for the smart contracts, frontend components, testing strategies, and deployment procedures outlined in the main roadmap.