/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // Allow importing the shared HRV engine from ../../src without copying.
  transpilePackages: [],
  webpack: (config) => {
    // Stub react-native imports the shared engine pulls transitively.
    config.resolve.alias = {
      ...config.resolve.alias,
      'react-native': false,
      'expo-sqlite': false,
      'expo-crypto': false,
    };
    return config;
  },
};
