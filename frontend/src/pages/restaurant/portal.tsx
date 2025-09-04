import React, { useState } from 'react';
import Head from 'next/head';
import { useWeb3 } from '@/context/Web3Context';
import { useRouter } from 'next/router';

// Mock data for restaurant's posted shifts
const mockPostedShifts = [
  {
    id: 1,
    title: 'Line Cook - Evening Shift',
    description: 'Looking for an experienced line cook to help with dinner service.',
    payment: '0.5',
    startTime: new Date(Date.now() + 86400000).toISOString(),
    endTime: new Date(Date.now() + 86400000 + 28800000).toISOString(),
    status: 'open',
    applications: 3,
  },
  {
    id: 2,
    title: 'Prep Cook - Morning Shift',
    description: 'Need a reliable prep cook for morning preparation work.',
    payment: '0.4',
    startTime: new Date(Date.now() + 172800000).toISOString(),
    endTime: new Date(Date.now() + 172800000 + 21600000).toISOString(),
    status: 'filled',
    applications: 5,
    selectedChef: '0x1234...5678',
  },
];

export default function RestaurantPortal() {
  const { isConnected } = useWeb3();
  const router = useRouter();
  const [showPostForm, setShowPostForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    payment: '',
    startTime: '',
    endTime: '',
  });

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">
          Restaurant Portal
        </h1>
        <p className="text-gray-600 mb-6">
          Please connect your wallet to access the restaurant portal.
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Here you would integrate with smart contracts
    console.log('Posting shift:', formData);
    setShowPostForm(false);
    setFormData({
      title: '',
      description: '',
      payment: '',
      startTime: '',
      endTime: '',
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <>
      <Head>
        <title>Restaurant Portal - ChefsPlan</title>
        <meta name="description" content="Post shifts and manage applications" />
      </Head>

      <div className="space-y-8">
        {/* Portal Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Restaurant Portal</h1>
              <p className="text-gray-600">Manage your shift postings and connect with talented chefs.</p>
            </div>
            <button
              onClick={() => setShowPostForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium"
            >
              Post New Shift
            </button>
          </div>
          
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-900">Active Shifts</h3>
              <p className="text-2xl font-bold text-blue-600">
                {mockPostedShifts.filter(s => s.status === 'open').length}
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-green-900">Filled Shifts</h3>
              <p className="text-2xl font-bold text-green-600">
                {mockPostedShifts.filter(s => s.status === 'filled').length}
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-purple-900">Total Applications</h3>
              <p className="text-2xl font-bold text-purple-600">
                {mockPostedShifts.reduce((sum, shift) => sum + shift.applications, 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Post Shift Form Modal */}
        {showPostForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Post New Shift</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                    Shift Title
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="payment" className="block text-sm font-medium text-gray-700 mb-1">
                    Payment (ETH)
                  </label>
                  <input
                    type="number"
                    id="payment"
                    name="payment"
                    value={formData.payment}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time
                    </label>
                    <input
                      type="datetime-local"
                      id="startTime"
                      name="startTime"
                      value={formData.startTime}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-1">
                      End Time
                    </label>
                    <input
                      type="datetime-local"
                      id="endTime"
                      name="endTime"
                      value={formData.endTime}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
                
                <div className="flex space-x-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md font-medium"
                  >
                    Post Shift
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPostForm(false)}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-md font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Posted Shifts */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Your Posted Shifts</h2>
          {mockPostedShifts.map((shift) => (
            <div key={shift.id} className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{shift.title}</h3>
                  <p className="text-gray-600 mt-1">{shift.description}</p>
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Payment:</span>
                      <span className="font-medium text-green-600 ml-1">{shift.payment} ETH</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Applications:</span>
                      <span className="font-medium ml-1">{shift.applications}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Start:</span>
                      <span className="font-medium ml-1">
                        {new Date(shift.startTime).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <span className={`font-medium ml-1 ${
                        shift.status === 'open' ? 'text-green-600' : 'text-yellow-600'
                      }`}>
                        {shift.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  {shift.selectedChef && (
                    <div className="mt-2 text-sm">
                      <span className="text-gray-500">Selected Chef:</span>
                      <span className="font-medium ml-1">{shift.selectedChef}</span>
                    </div>
                  )}
                </div>
                <div className="ml-4">
                  <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm">
                    View Applications
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}