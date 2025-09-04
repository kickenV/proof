import React from 'react';
import Link from 'next/link';
import { useWeb3 } from '@/context/Web3Context';
import WalletConnect from '../web3/WalletConnect';

const Header: React.FC = () => {
  const { account, isConnected } = useWeb3();

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-2xl font-bold text-blue-600">
              ChefsPlan
            </Link>
            <nav className="hidden md:flex space-x-6">
              <Link href="/" className="text-gray-600 hover:text-gray-900">
                Browse Shifts
              </Link>
              {isConnected && (
                <>
                  <Link href="/chef/dashboard" className="text-gray-600 hover:text-gray-900">
                    Chef Dashboard
                  </Link>
                  <Link href="/restaurant/portal" className="text-gray-600 hover:text-gray-900">
                    Restaurant Portal
                  </Link>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <WalletConnect />
            {isConnected && account && (
              <span className="text-sm text-gray-500">
                {account.slice(0, 6)}...{account.slice(-4)}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;