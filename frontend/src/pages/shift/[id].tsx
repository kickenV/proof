import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useWeb3 } from '@/context/Web3Context';

// Mock shift data (in real app, this would be fetched based on ID)
const mockShift = {
  id: 1,
  title: 'Line Cook - Evening Shift',
  description: 'We are looking for an experienced line cook to join our team for evening dinner service. The ideal candidate should have experience in a fast-paced kitchen environment and be able to work efficiently under pressure. You will be responsible for preparing dishes according to our recipes and maintaining high quality standards.',
  restaurantName: 'The Golden Spoon',
  restaurantAddress: '0x1234567890123456789012345678901234567890',
  payment: '0.5',
  startTime: new Date(Date.now() + 86400000).toISOString(),
  endTime: new Date(Date.now() + 86400000 + 28800000).toISOString(),
  status: 'open',
  requirements: [
    'Minimum 2 years kitchen experience',
    'Food safety certification',
    'Ability to work in fast-paced environment',
    'Team player with good communication skills'
  ],
  applications: 3,
  postedAt: new Date(Date.now() - 86400000).toISOString(),
};

export default function ShiftDetails() {
  const router = useRouter();
  const { id } = router.query;
  const { isConnected } = useWeb3();
  const [isApplying, setIsApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);

  const handleApply = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    setIsApplying(true);
    try {
      // Here you would integrate with smart contracts
      console.log('Applying to shift:', id);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      setHasApplied(true);
    } catch (error) {
      console.error('Failed to apply:', error);
    } finally {
      setIsApplying(false);
    }
  };

  if (!id) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Head>
        <title>{mockShift.title} - ChefsPlan</title>
        <meta name="description" content={mockShift.description} />
      </Head>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Breadcrumb */}
        <nav className="text-sm">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-800"
          >
            ← Back to Shifts
          </button>
        </nav>

        {/* Shift Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{mockShift.title}</h1>
              <p className="text-xl text-gray-600 mb-4">{mockShift.restaurantName}</p>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span>Posted {new Date(mockShift.postedAt).toLocaleDateString()}</span>
                <span>•</span>
                <span>{mockShift.applications} applications</span>
                <span>•</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  mockShift.status === 'open' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {mockShift.status.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-green-600">{mockShift.payment} ETH</div>
              <div className="text-sm text-gray-500">Payment</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Job Description</h2>
              <p className="text-gray-700 leading-relaxed">{mockShift.description}</p>
            </div>

            {/* Requirements */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Requirements</h2>
              <ul className="space-y-2">
                {mockShift.requirements.map((requirement, index) => (
                  <li key={index} className="flex items-start">
                    <svg
                      className="w-5 h-5 text-green-500 mt-0.5 mr-2 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-gray-700">{requirement}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Shift Details */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Shift Details</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-500">Start Time</div>
                  <div className="font-medium">
                    {new Date(mockShift.startTime).toLocaleDateString()} at{' '}
                    {new Date(mockShift.startTime).toLocaleTimeString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">End Time</div>
                  <div className="font-medium">
                    {new Date(mockShift.endTime).toLocaleDateString()} at{' '}
                    {new Date(mockShift.endTime).toLocaleTimeString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Duration</div>
                  <div className="font-medium">
                    {Math.round((new Date(mockShift.endTime).getTime() - new Date(mockShift.startTime).getTime()) / (1000 * 60 * 60))} hours
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Restaurant</div>
                  <div className="font-medium">{mockShift.restaurantName}</div>
                  <div className="text-xs text-gray-400 break-all">
                    {mockShift.restaurantAddress.slice(0, 6)}...{mockShift.restaurantAddress.slice(-4)}
                  </div>
                </div>
              </div>
            </div>

            {/* Application Action */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Apply for this Shift</h3>
              
              {!isConnected ? (
                <div className="text-center">
                  <p className="text-gray-600 mb-4">Connect your wallet to apply for this shift.</p>
                  <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md font-medium">
                    Connect Wallet
                  </button>
                </div>
              ) : hasApplied ? (
                <div className="text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-green-600 font-medium">Application Submitted!</p>
                  <p className="text-sm text-gray-600 mt-2">
                    You&apos;ll be notified when the restaurant reviews your application.
                  </p>
                </div>
              ) : mockShift.status === 'open' ? (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Your payment will be held in escrow until the shift is completed.
                  </p>
                  <button
                    onClick={handleApply}
                    disabled={isApplying}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white py-3 px-4 rounded-md font-medium transition-colors"
                  >
                    {isApplying ? 'Applying...' : 'Apply Now'}
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-gray-600">This shift is no longer accepting applications.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}