import React from 'react';
import Link from 'next/link';

interface ShiftCardProps {
  shift: {
    id: number;
    title: string;
    description: string;
    restaurantName: string;
    payment: string;
    startTime: string;
    endTime: string;
    status: 'open' | 'filled' | 'completed';
  };
}

const ShiftCard: React.FC<ShiftCardProps> = ({ shift }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-green-100 text-green-800';
      case 'filled':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md border p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-semibold text-gray-900">{shift.title}</h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(shift.status)}`}>
          {shift.status.toUpperCase()}
        </span>
      </div>
      
      <p className="text-gray-600 mb-3">{shift.description}</p>
      
      <div className="space-y-2 mb-4">
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Restaurant:</span>
          <span className="text-sm font-medium">{shift.restaurantName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Payment:</span>
          <span className="text-sm font-medium text-green-600">{shift.payment} ETH</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Time:</span>
          <span className="text-sm font-medium">
            {new Date(shift.startTime).toLocaleDateString()} {new Date(shift.startTime).toLocaleTimeString()} - {new Date(shift.endTime).toLocaleTimeString()}
          </span>
        </div>
      </div>
      
      <div className="flex space-x-3">
        <Link
          href={`/shift/${shift.id}`}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-4 rounded-md text-sm font-medium transition-colors"
        >
          View Details
        </Link>
        {shift.status === 'open' && (
          <button className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors">
            Apply Now
          </button>
        )}
      </div>
    </div>
  );
};

export default ShiftCard;