import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-100 border-t">
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            © 2024 ChefsPlan. Powered by zkSync Era.
          </div>
          <div className="flex space-x-4 text-sm">
            <a href="#" className="text-gray-600 hover:text-gray-900">About</a>
            <a href="#" className="text-gray-600 hover:text-gray-900">Terms</a>
            <a href="#" className="text-gray-600 hover:text-gray-900">Privacy</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;