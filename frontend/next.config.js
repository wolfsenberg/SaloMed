/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: true,
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  productionBrowserSourceMaps: false,
  experimental: {
    webpackBuildWorker: true,
    webpackMemoryOptimizations: true,
    optimizePackageImports: ['framer-motion', 'lucide-react'],
    serverSourceMaps: false,
    cpus: 1, 
    workerThreads: false,
  },
  // stellar-sdk ships ESM and uses Node built-ins; polyfill them for the browser bundle
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
      };
    }
    
    config.externals = [...(config.externals || []), 'sodium-native', 'require-addon'];
    
    return config;
  },
};

module.exports = nextConfig;
