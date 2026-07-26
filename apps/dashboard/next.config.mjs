import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: no server anywhere in Peribolos. Deployable to any static host.
  output: "export",
  images: { unoptimized: true },
  // Pin monorepo root so Next does not walk up to C:\Users\HomePC\package-lock.json
  outputFileTracingRoot: path.join(__dirname, "../.."),
  typescript: { ignoreBuildErrors: false },
  // Keep webpack from following outside the workspace for @peribolos packages.
  transpilePackages: ["@peribolos/core"],
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.modules = [
      ...(config.resolve.modules || []),
      path.resolve(__dirname, "../../node_modules"),
    ];
    config.resolve.alias = {
      ...config.resolve.alias,
      "@solana-program/token": false,
      "@coinbase/cdp-sdk": false,
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      "pino-pretty": false,
      "@react-native-async-storage/async-storage": false,
    };
    return config;
  },
};

export default nextConfig;

