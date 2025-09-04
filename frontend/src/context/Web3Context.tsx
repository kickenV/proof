import React, { createContext, useContext, useState } from 'react';
import { ethers } from 'ethers';
import { Provider } from 'zksync-ethers';

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
    if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        const zkProvider = new Provider('https://testnet.era.zksync.dev');
        const ethProvider = new ethers.BrowserProvider(window.ethereum);
        const zkSigner = await ethProvider.getSigner();
        
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
    if (!window.ethereum) return;
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x118' }], // zkSync Era Testnet
      });
    } catch (switchError: unknown) {
      // Chain not added, add it
      if (typeof switchError === 'object' && switchError !== null && 'code' in switchError && (switchError as { code: number }).code === 4902) {
        await window.ethereum?.request({
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