# ChefsPlan MVP Project Structure Template

This document provides the complete project structure that should be created for the ChefsPlan MVP implementation.

## Root Directory Structure

```
chefsplan-mvp/
├── contracts/                  # Smart contracts
│   ├── ShiftManager.sol
│   ├── Escrow.sol  
│   ├── Reputation.sol
│   └── interfaces/
│       ├── IEscrow.sol
│       ├── IReputation.sol
│       └── IShiftManager.sol
├── scripts/                    # Deployment scripts
│   ├── deploy.js
│   ├── verify.js
│   └── setup-testnet.js
├── test/                       # Smart contract tests
│   ├── ShiftManager.test.js
│   ├── Escrow.test.js
│   ├── Reputation.test.js
│   └── integration/
│       └── full-workflow.test.js
├── agents/                     # Off-chain automation
│   ├── MatchingAgent.js
│   ├── PayoutAgent.js
│   └── NotificationService.js
├── frontend/                   # Next.js application
│   ├── pages/
│   │   ├── index.tsx           # Landing page
│   │   ├── _app.tsx           # App wrapper
│   │   ├── chef/
│   │   │   ├── dashboard.tsx
│   │   │   └── applications.tsx
│   │   ├── restaurant/
│   │   │   ├── portal.tsx
│   │   │   └── shifts.tsx
│   │   └── shift/
│   │       └── [id].tsx        # Shift details
│   ├── components/
│   │   ├── common/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── Layout.tsx
│   │   ├── web3/
│   │   │   ├── WalletConnect.tsx
│   │   │   ├── NetworkSwitch.tsx
│   │   │   └── TransactionModal.tsx
│   │   ├── shift/
│   │   │   ├── ShiftCard.tsx
│   │   │   ├── ShiftForm.tsx
│   │   │   └── ApplicationCard.tsx
│   │   └── profile/
│   │       ├── ProfileCard.tsx
│   │       └── ReputationDisplay.tsx
│   ├── context/
│   │   ├── Web3Context.tsx
│   │   └── ShiftContext.tsx
│   ├── utils/
│   │   ├── contracts.ts
│   │   ├── ipfs.ts
│   │   ├── web3.ts
│   │   └── helpers.ts
│   ├── hooks/
│   │   ├── useContract.ts
│   │   ├── useShifts.ts
│   │   └── useReputation.ts
│   ├── styles/
│   │   ├── globals.css
│   │   └── components/
│   ├── abis/
│   │   ├── ShiftManager.json
│   │   ├── Escrow.json
│   │   └── Reputation.json
│   └── types/
│       ├── contracts.ts
│       ├── shift.ts
│       └── user.ts
├── docs/                       # Documentation
│   ├── API.md
│   ├── DEPLOYMENT.md
│   └── TESTING.md
├── .env.example                # Environment template
├── .env.local                  # Local environment (not in git)
├── .gitignore
├── hardhat.config.js
├── package.json
├── tsconfig.json
├── next.config.js
└── README.md
```

## Key Files Content Templates

### package.json
```json
{
  "name": "chefsplan-mvp",
  "version": "1.0.0",
  "description": "ChefsPlan MVP - Decentralized gig platform for chefs",
  "scripts": {
    "compile": "hardhat compile",
    "test": "hardhat test",
    "deploy:testnet": "hardhat run scripts/deploy.js --network zkSyncTestnet",
    "verify": "hardhat run scripts/verify.js --network zkSyncTestnet",
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "type-check": "tsc --noEmit",
    "test:frontend": "jest",
    "agents:start": "node agents/startup.js"
  },
  "dependencies": {
    "@openzeppelin/contracts-upgradeable": "^4.9.0",
    "ethers": "^6.7.0",
    "zksync-web3": "^0.14.0",
    "next": "^13.5.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.0.0",
    "ipfs-http-client": "^60.0.0"
  },
  "devDependencies": {
    "@matterlabs/hardhat-zksync-solc": "^1.0.0",
    "@matterlabs/hardhat-zksync-deploy": "^1.0.0",
    "hardhat": "^2.17.0",
    "@types/react": "^18.0.0",
    "@types/node": "^20.0.0",
    "jest": "^29.0.0",
    "@testing-library/react": "^13.0.0"
  }
}
```

### .gitignore
```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Production builds
dist/
build/
.next/
out/

# Environment files
.env.local
.env.development.local
.env.test.local
.env.production.local

# Hardhat
cache/
artifacts/
typechain-types/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Private keys (NEVER commit these!)
*.key
private-keys.txt
mnemonic.txt
```

### .env.example
```bash
# Private Keys (NEVER commit actual values!)
PRIVATE_KEY=your_private_key_here
MNEMONIC=your_twelve_word_mnemonic_here

# API Keys
INFURA_API_KEY=your_infura_api_key
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_KEY=your_pinata_secret

# Contract Addresses (update after deployment)
NEXT_PUBLIC_SHIFT_MANAGER_ADDRESS=
NEXT_PUBLIC_ESCROW_ADDRESS=
NEXT_PUBLIC_REPUTATION_ADDRESS=

# Network Configuration
NEXT_PUBLIC_ZKSYNC_RPC_URL=https://testnet.era.zksync.dev
NEXT_PUBLIC_CHAIN_ID=280
NEXT_PUBLIC_NETWORK_NAME=zkSync Era Testnet

# Frontend Configuration
NEXT_PUBLIC_APP_NAME=ChefsPlan
NEXT_PUBLIC_APP_URL=http://localhost:3000

# IPFS Configuration
NEXT_PUBLIC_IPFS_GATEWAY=https://ipfs.io/ipfs/
IPFS_API_URL=https://ipfs.infura.io:5001
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/components/*": ["frontend/components/*"],
      "@/pages/*": ["frontend/pages/*"],
      "@/utils/*": ["frontend/utils/*"],
      "@/context/*": ["frontend/context/*"],
      "@/hooks/*": ["frontend/hooks/*"],
      "@/types/*": ["frontend/types/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

### next.config.js
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['ipfs.io', 'gateway.pinata.cloud'],
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  async rewrites() {
    return [
      {
        source: '/api/ipfs/:path*',
        destination: 'https://ipfs.infura.io:5001/api/v0/:path*',
      },
    ];
  },
}

module.exports = nextConfig;
```

## Implementation Priority

### Week 1: Foundation (20-25 hours)
1. **Day 1-2**: Project setup, smart contracts structure
2. **Day 3-4**: Core smart contracts implementation  
3. **Day 5**: Testing and testnet deployment

### Week 2: Frontend (20-25 hours)
1. **Day 1-2**: Next.js setup, Web3 integration
2. **Day 3-4**: Core pages and components
3. **Day 5**: Integration testing and refinement

### Week 3: Integration & Polish (15-20 hours)
1. **Day 1-2**: Off-chain agents, IPFS integration
2. **Day 3-4**: End-to-end testing, bug fixes
3. **Day 5**: Documentation, deployment preparation

## Critical Success Metrics

### Technical Metrics
- [ ] All smart contracts compile and deploy successfully
- [ ] 90%+ test coverage on critical functions
- [ ] Frontend builds without errors
- [ ] Complete user workflow functions end-to-end

### Functional Metrics  
- [ ] Restaurant can post shifts
- [ ] Chefs can apply to shifts
- [ ] Payment escrow works correctly
- [ ] Reputation system updates
- [ ] Real-time notifications function

### User Experience Metrics
- [ ] Wallet connection < 5 seconds
- [ ] Transaction confirmation < 30 seconds on zkSync
- [ ] UI responsive on mobile and desktop
- [ ] Error states handled gracefully

---

*This project structure provides a solid foundation for the ChefsPlan MVP development. Follow this template to ensure consistent organization and maintainable code.*