import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["yahoo-finance2"],
  experimental: {
    // Required for server actions
  },
  async redirects() {
    return [
      {
        source: "/dashboard/portfolio/portfolio-primary",
        has: [{ type: "query", key: "view", value: "mf" }],
        destination: "/dashboard/wealth/mine/mf",
        permanent: true,
      },
      {
        source: "/dashboard/portfolio/portfolio-primary",
        has: [{ type: "query", key: "view", value: "us" }],
        destination: "/dashboard/wealth/mine/stocks?market=us",
        permanent: true,
      },
      {
        source: "/dashboard/portfolio/portfolio-primary",
        has: [{ type: "query", key: "view", value: "in" }],
        destination: "/dashboard/wealth/mine/stocks?market=in",
        permanent: true,
      },
      {
        source: "/dashboard/portfolio/portfolio-primary",
        destination: "/dashboard/wealth/mine",
        permanent: true,
      },
      {
        source: "/dashboard/portfolio/portfolio-mom",
        destination: "/dashboard/wealth/mother",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
