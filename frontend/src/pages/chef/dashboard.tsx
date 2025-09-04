import React, { useState } from 'react';
import Head from 'next/head';
import { useWeb3 } from '@/context/Web3Context';
import { useRouter } from 'next/router';

// Mock data for chef's applications and completed shifts
const mockApplications = [
  {
    id: 1,
    shiftId: 1,
    shiftTitle: 'Line Cook - Evening Shift',
    restaurantName: 'The Golden Spoon',
    payment: '0.5',
    status: 'pending',
    appliedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 2,
    shiftId: 2,
    shiftTitle: 'Prep Cook - Morning Shift',
    restaurantName: 'Fresh Bistro',
    payment: '0.4',
    status: 'accepted',
    appliedAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

const mockCompletedShifts = [
  {
    id: 3,
    shiftTitle: 'Weekend Brunch Cook',
    restaurantName: 'Sunday Kitchen',
    payment: '0.6',
    completedAt: new Date(Date.now() - 604800000).toISOString(),
    rating: 5,
  },
];

export default function ChefDashboard() {
  const { isConnected } = useWeb3();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'applications' | 'completed'>('applications');

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">
          Chef Dashboard
        </h1>
        <p className="text-gray-600 mb-6">
          Please connect your wallet to access the chef dashboard.
        </p>
        <button
          onClick={() => router.push('/')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md"
        >
          Go to Home
        </button>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Chef Dashboard - ChefsPlan</title>
        <meta name="description" content="Manage your shift applications and completed work" />
      </Head>

      <div className="space-y-8">
        {/* Dashboard Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Chef Dashboard</h1>
          <p className="text-gray-600">Welcome back! Manage your shift applications and track your earnings.</p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-900">Active Applications</h3>
              <p className="text-2xl font-bold text-blue-600">{mockApplications.length}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-green-900">Completed Shifts</h3>
              <p className="text-2xl font-bold text-green-600">{mockCompletedShifts.length}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-purple-900">Total Earned</h3>
              <p className="text-2xl font-bold text-purple-600">
                {mockCompletedShifts.reduce((sum, shift) => sum + parseFloat(shift.payment), 0)} ETH
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('applications')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'applications'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              My Applications
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'completed'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Completed Shifts
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'applications' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">My Applications</h2>
            {mockApplications.map((application) => (
              <div key={application.id} className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{application.shiftTitle}</h3>
                    <p className="text-gray-600">{application.restaurantName}</p>
                    <p className="text-sm text-gray-500">
                      Applied on {new Date(application.appliedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-green-600">{application.payment} ETH</p>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      application.status === 'pending' 
                        ? 'bg-yellow-100 text-yellow-800'
                        : application.status === 'accepted'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {application.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'completed' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Completed Shifts</h2>
            {mockCompletedShifts.map((shift, index) => (
              <div key={index} className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{shift.shiftTitle}</h3>
                    <p className="text-gray-600">{shift.restaurantName}</p>
                    <p className="text-sm text-gray-500">
                      Completed on {new Date(shift.completedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-green-600">{shift.payment} ETH</p>
                    <div className="flex items-center mt-1">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`w-4 h-4 ${
                            i < shift.rating ? 'text-yellow-400' : 'text-gray-300'
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}