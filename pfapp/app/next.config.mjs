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
  turbopack: { root: path.resolve(root, "..") },
};

export default nextConfig;
