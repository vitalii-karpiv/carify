import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stats moved onto the dashboard.
  async redirects() {
    return [{ source: "/stats", destination: "/", permanent: true }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
