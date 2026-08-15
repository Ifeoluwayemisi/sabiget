import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Ensure Turbopack uses the frontend folder as the workspace root
  turbopack: {
    // Turbopack requires an absolute root path. Resolve to this frontend folder.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
