import React, { useState } from 'react';
import Head from 'next/head';
import ShiftCard from '@/components/shift/ShiftCard';
import { useWeb3 } from '@/context/Web3Context';

// Mock data for demonstration
const mockShifts = [
  {
    id: 1,
    title: 'Line Cook - Evening Shift',
    description: 'Looking for an experienced line cook to help with dinner service at our busy downtown location.',
    restaurantName: 'The Golden Spoon',
    payment: '0.5',
    startTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    endTime: new Date(Date.now() + 86400000 + 28800000).toISOString(), // Tomorrow + 8 hours
    status: 'open' as const,
  },
  {
    id: 2,
    title: 'Prep Cook - Morning Shift',
    description: 'Need a reliable prep cook for morning preparation work. Must be able to work independently.',
    restaurantName: 'Fresh Bistro',
    payment: '0.4',
    startTime: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
    endTime: new Date(Date.now() + 172800000 + 21600000).toISOString(), // Day after tomorrow + 6 hours
    status: 'open' as const,
  },
  {
    id: 3,
    title: 'Sous Chef - Weekend',
    description: 'Experienced sous chef needed for weekend brunch service. Great opportunity!',
    restaurantName: 'Brunch & Co',
    payment: '0.8',
    startTime: new Date(Date.now() + 259200000).toISOString(), // 3 days from now
    endTime: new Date(Date.now() + 259200000 + 25200000).toISOString(), // 3 days from now + 7 hours
    status: 'filled' as const,
  },
];

export default function Home() {
  const { isConnected } = useWeb3();
  const [shifts] = useState(mockShifts);
  const [filter, setFilter] = useState<'all' | 'open' | 'filled'>('all');

  const filteredShifts = shifts.filter(shift => 
    filter === 'all' || shift.status === filter
  );

  return (
    <>
      <Head>
        <title>ChefsPlan - Decentralized Chef Marketplace</title>
        <meta name="description" content="Connect chefs and restaurants on zkSync Era blockchain" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="space-y-8">
        {/* Hero Section */}
        <section className="text-center py-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to ChefsPlan
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            The decentralized marketplace connecting talented chefs with restaurants, 
            powered by zkSync Era blockchain for secure and transparent transactions.
          </p>
          
          {!isConnected && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-md mx-auto">
              <p className="text-blue-700 mb-4">
                Connect your wallet to start applying for shifts or posting opportunities.
              </p>
            </div>
          )}
        </section>

        {/* Filter Section */}
        <section>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">Available Shifts</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'all' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                All ({shifts.length})
              </button>
              <button
                onClick={() => setFilter('open')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'open' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Open ({shifts.filter(s => s.status === 'open').length})
              </button>
              <button
                onClick={() => setFilter('filled')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'filled' 
                    ? 'bg-yellow-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Filled ({shifts.filter(s => s.status === 'filled').length})
              </button>
            </div>
          </div>

          {/* Shifts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredShifts.map((shift) => (
              <ShiftCard key={shift.id} shift={shift} />
            ))}
          </div>

          {filteredShifts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No shifts found matching your filter.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}