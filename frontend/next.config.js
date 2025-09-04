/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['ipfs.io', 'gateway.pinata.cloud'],
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  async rewrites() {
    return [
      {
        source: '/api/ipfs/:path*',
        destination: 'https://ipfs.infura.io:5001/api/v0/:path*',
      },
    ];
  },
}

module.exports = nextConfig;
