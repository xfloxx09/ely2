import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ely/db"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
