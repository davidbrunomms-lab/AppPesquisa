import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@personalpro/shared'],
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
