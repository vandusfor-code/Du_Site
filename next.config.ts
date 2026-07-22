import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ hostname: "i.pravatar.cc" }],
  },
};

export default nextConfig;
