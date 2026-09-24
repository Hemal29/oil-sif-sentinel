import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/worker",
        destination: "http://localhost:3002",
        permanent: false,
      },
      {
        source: "/worker/:path*",
        destination: "http://localhost:3002/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
