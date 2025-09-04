import React, { useState } from 'react';
import { useWeb3 } from '@/context/Web3Context';

const WalletConnect: React.FC = () => {
  const { isConnected, connectWallet, disconnectWallet, account } = useWeb3();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await connectWallet();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  if (isConnected && account) {
    return (
      <div className="flex items-center space-x-3">
        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        <button
          onClick={disconnectWallet}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isConnecting}
      className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
    >
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
};

export default WalletConnect;