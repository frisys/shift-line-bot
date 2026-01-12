import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  env: {
    ...require(`./config/${process.env.APP_ENV || 'local'}.json`),
  },
}

export default nextConfig;
