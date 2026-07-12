/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@lunaro-gate/shared'],
};

export default nextConfig;
