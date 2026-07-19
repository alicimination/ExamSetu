import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  // Skip type checking during build (we handle it separately)
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
