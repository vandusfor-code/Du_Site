import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ hostname: "i.pravatar.cc" }],
  },
  experimental: {
    // Las capturas de los pasos se suben vía Server Action (FormData). El límite
    // por defecto es 1 MB; se eleva a 8 MB para admitir imágenes de hasta 5 MB
    // (validadas server-side) más el overhead del multipart.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
