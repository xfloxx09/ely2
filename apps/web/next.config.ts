import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@ely/db",
    "@ely/server",
    "@ely/personality",
    "@ely/ai",
    "@ely/mlm",
    "@ely/gamification",
    "@ely/chat",
  ],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"],
    };
    return config;
  },
};

export default nextConfig;
