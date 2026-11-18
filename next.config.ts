import type { NextConfig } from "next";

// Every page is per-persona and per-request (cookie-based demo session), so we use the
// classic dynamic rendering model rather than Cache Components.
const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  // SQL migrations are read from disk at runtime; make sure Vercel bundles them.
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
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
