import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  devIndicators: false,
  env: {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ...require(`./config/${process.env.APP_ENV || 'local'}.json`),
  },
}

export default nextConfig;
