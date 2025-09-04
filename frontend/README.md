# ChefsPlan Frontend

This is the frontend application for ChefsPlan - a decentralized gig-work platform connecting chefs and restaurants on zkSync Era blockchain.

## Features Implemented

### Core Pages
- **Landing Page** (`/`) - Browse available shifts with filtering capabilities
- **Chef Dashboard** (`/chef/dashboard`) - Manage applications and view earnings
- **Restaurant Portal** (`/restaurant/portal`) - Post shifts and manage applications
- **Shift Details** (`/shift/[id]`) - Detailed view of individual shifts

### Components
- **WalletConnect** - Web3 wallet integration with zkSync Era
- **ShiftCard** - Display shift information with status indicators
- **Layout Components** - Header, Footer, and responsive layout
- **Web3Context** - Global state management for blockchain interactions

### Technologies Used
- Next.js 15 with TypeScript
- Tailwind CSS for styling
- Ethers.js v6 for blockchain interactions
- zksync-ethers for zkSync Era integration
- React Context for state management

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env.local
```

3. Start development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

## Project Structure

```
src/
├── components/
│   ├── common/          # Layout components
│   ├── web3/           # Web3 related components
│   └── shift/          # Shift-related components
├── context/            # React Context providers
├── pages/              # Next.js pages
├── types/              # TypeScript type definitions
└── styles/             # Global styles
```

## Key Features

- **Responsive Design** - Works on mobile and desktop
- **Web3 Integration** - Connect MetaMask and other wallets
- **zkSync Era Support** - Optimized for zkSync Era testnet
- **Type Safety** - Full TypeScript implementation
- **Modern UI** - Clean, professional interface with Tailwind CSS

## Next Steps

The frontend is ready for integration with:
- Smart contracts deployment
- IPFS file storage
- Real-time notifications
- Advanced filtering and search
