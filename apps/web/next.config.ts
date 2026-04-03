import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mypixelpage/shared", "@mypixelpage/runtime", "@mypixelpage/editor"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  headers: async () => [
    {
      source: "/assets/:path*",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
  ],
};

export default nextConfig;
