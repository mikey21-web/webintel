/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'webintel.diyaaaa.in' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};
module.exports = nextConfig;
