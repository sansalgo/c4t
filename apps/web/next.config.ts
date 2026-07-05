import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui"],
  async redirects() {
    return [
      { source: "/parent/tasks", destination: "/parent?window=tasks", permanent: false },
      { source: "/parent/review", destination: "/parent?window=review", permanent: false },
      { source: "/parent/rewards", destination: "/parent?window=rewards", permanent: false },
      { source: "/parent/redemptions", destination: "/parent?window=redemptions", permanent: false },
    ]
  },
}

export default nextConfig
