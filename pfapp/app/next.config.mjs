import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * .mjs rather than .ts: `next start` loads the config on every start, and a .ts config is compiled
 * with SWC first, a platform-specific native binary. A PrimeForge package carries no native files.
 */
const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.resolve(root, ".."),
  experimental: {
    // With a proxy (src/proxy.ts) Next buffers each request body for it and silently truncates it
    // past this size (default 10 MB). The content-pack import takes up to 64 MiB plus multipart
    // framing (lib/http/body bodyLimitFor), so the buffer must be larger than the route's limit.
    proxyClientMaxBodySize: "65mb",
  },
  turbopack: {
    root: path.resolve(root, ".."),
    // Tailwind 4 (src/app/globals.css), as MathTestBuddy: a build-time loader only.
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
