/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
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
