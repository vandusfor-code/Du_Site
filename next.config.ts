import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [{ hostname: "i.pravatar.cc" }],
  },
};

export default nextConfig;
