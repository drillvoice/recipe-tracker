import process from 'node:process';

/** @type {import('next').NextConfig} */
const deployTarget = process.env.NEXT_DEPLOY_TARGET;
const isFirebaseStaticExport = deployTarget === 'firebase-hosting';

const nextConfig = {
  ...(isFirebaseStaticExport ? { output: 'export' } : {}),
  // Security-related webpack configuration
  webpack: (config, { dev }) => {
    if (!dev) {
      // Production optimizations
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Vendor chunk
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /node_modules/,
              priority: 20
            },
            // Common chunk
            common: {
              name: 'common',
              minChunks: 2,
              priority: 10,
              reuseExistingChunk: true,
              enforce: true
            }
          }
        }
      };
    }
    return config;
  }
};

export default nextConfig;