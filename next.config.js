/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // node:sqlite is a Node.js built-in (available Node 22+).
      // Tell webpack to leave it as a require() call rather than bundling it.
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        "node:sqlite",
      ];
    }
    return config;
  },
};

module.exports = nextConfig;
