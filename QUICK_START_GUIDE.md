# ChefsPlan MVP - Quick Start Implementation Guide

## Prerequisites
- Node.js 18+ 
- Git
- MetaMask or similar Web3 wallet
- zkSync Era testnet ETH

## 1. Project Initialization

```bash
# Create project directory
mkdir chefsplan-mvp
cd chefsplan-mvp

# Initialize package.json
npm init -y

# Install core dependencies
npm install --save-dev hardhat @matterlabs/hardhat-zksync-solc @matterlabs/hardhat-zksync-deploy
npm install @openzeppelin/contracts-upgradeable ethers zksync-web3

# Install frontend dependencies
npm install next react react-dom typescript @types/react @types/node
npm install @rainbow-me/rainbowkit wagmi

# Create project structure
mkdir -p contracts scripts agents frontend/pages frontend/components frontend/utils test
```

## 2. Hardhat Configuration

Create `hardhat.config.js`:
```javascript
require("@matterlabs/hardhat-zksync-solc");
require("@matterlabs/hardhat-zksync-deploy");

module.exports = {
  zksolc: {
    version: "1.3.13",
    compilerSource: "binary",
  },
  defaultNetwork: "zkSyncTestnet",
  networks: {
    zkSyncTestnet: {
      url: "https://testnet.era.zksync.dev",
      ethNetwork: "goerli",
      chainId: 280,
      zksync: true,
    },
  },
  solidity: {
    version: "0.8.19",
  },
};
```

## 3. Smart Contract Development Priority Order

### Phase 1: Core Contracts (8-12 hours)
1. **Reputation.sol** (2-3 hours) - Simplest, no dependencies
2. **Escrow.sol** (3-4 hours) - Core payment functionality  
3. **ShiftManager.sol** (3-5 hours) - Main business logic

### Phase 2: Testing & Deployment (4-6 hours)
4. Unit tests for each contract
5. Integration tests
6. zkSync testnet deployment

## 4. Frontend Development Priority Order

### Phase 1: Core Pages (6-8 hours)
1. **Next.js setup** with TypeScript (1 hour)
2. **Web3 context provider** (2-3 hours)
3. **Landing page** with shift listings (2-3 hours)
4. **Basic shift posting form** (1-2 hours)

### Phase 2: Interactive Features (6-8 hours)  
5. **Chef application flow** (2-3 hours)
6. **Restaurant management portal** (2-3 hours)
7. **Transaction status handling** (2 hours)

## 5. Critical Implementation Commands

### Smart Contract Deployment
```bash
# Compile contracts
npx hardhat compile

# Deploy to testnet
npx hardhat run scripts/deploy.js --network zkSyncTestnet

# Verify contracts
npx hardhat verify --network zkSyncTestnet DEPLOYED_ADDRESS
```

### Frontend Development
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check
```

### Testing
```bash
# Run smart contract tests
npx hardhat test

# Run frontend tests
npm run test

# Run integration tests
npm run test:integration
```

## 6. Environment Setup

Create `.env.local`:
```bash
# Private keys (never commit!)
PRIVATE_KEY=your_private_key_here
INFURA_API_KEY=your_infura_key

# Contract addresses (update after deployment)
NEXT_PUBLIC_SHIFT_MANAGER_ADDRESS=
NEXT_PUBLIC_ESCROW_ADDRESS=
NEXT_PUBLIC_REPUTATION_ADDRESS=

# zkSync Configuration
NEXT_PUBLIC_ZKSYNC_RPC_URL=https://testnet.era.zksync.dev
NEXT_PUBLIC_CHAIN_ID=280
```

## 7. MVP Success Criteria Checklist

### Smart Contracts ✅
- [ ] Restaurant can post shifts with IPFS metadata
- [ ] Chefs can apply to available shifts  
- [ ] Restaurant can accept applications and fund escrow
- [ ] Escrow automatically releases payment on completion
- [ ] Basic reputation tracking works
- [ ] All contracts deployed on zkSync testnet

### Frontend ✅  
- [ ] Web3 wallet connection works
- [ ] Users can switch to zkSync network
- [ ] Shift listings display correctly
- [ ] Shift posting form functional
- [ ] Application process works end-to-end
- [ ] Transaction status updates in real-time

### Integration ✅
- [ ] Complete workflow tested: post → apply → accept → complete → pay
- [ ] Off-chain agents send notifications
- [ ] IPFS integration stores metadata
- [ ] No critical bugs in core flows

## 8. Common Issues & Solutions

### zkSync Compilation Issues
```bash
# Clear cache and rebuild
npx hardhat clean
npx hardhat compile
```

### Web3 Connection Issues
- Ensure MetaMask has zkSync Era testnet added
- Check RPC URL and chain ID match
- Verify wallet has testnet ETH

### Contract Interaction Failures
- Confirm contract addresses in frontend
- Check ABI files are up to date
- Verify gas limits are sufficient

## 9. Testing Workflow

### Local Testing
```bash
# 1. Run unit tests
npx hardhat test

# 2. Deploy to local node (if available)
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost

# 3. Test frontend integration
npm run dev
```

### Testnet Testing
```bash
# 1. Deploy to zkSync testnet
npx hardhat run scripts/deploy.js --network zkSyncTestnet

# 2. Update contract addresses in frontend
# 3. Test complete user flows

# 4. Monitor transactions
# Use zkSync Era testnet explorer: https://goerli.explorer.zksync.io/
```

## 10. Next Steps After MVP

1. **Security Audit** - Review contracts for vulnerabilities
2. **Gas Optimization** - Reduce transaction costs
3. **Advanced Features** - Dispute resolution, advanced matching
4. **Mobile App** - React Native implementation
5. **Mainnet Deployment** - Production launch

## Quick Reference Links

- **zkSync Era Docs**: https://era.zksync.io/docs/
- **Hardhat zkSync Plugin**: https://era.zksync.io/docs/tools/hardhat/
- **OpenZeppelin Contracts**: https://docs.openzeppelin.com/contracts/
- **Next.js Docs**: https://nextjs.org/docs
- **zkSync Explorer**: https://goerli.explorer.zksync.io/

---

*This guide provides the essential commands and steps needed to implement the ChefsPlan MVP efficiently. Follow the priority order for optimal development flow.*