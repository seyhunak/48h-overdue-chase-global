import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone server (`.next/standalone`) for the $5 VPS Docker image:
  // minimal runtime without devDependencies. Local `next dev` is unaffected.
  output: "standalone",
};

export default nextConfig;
