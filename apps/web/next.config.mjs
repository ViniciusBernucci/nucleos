import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

// Segredos ficam no servidor: nao usar nextConfig.env nem NEXT_PUBLIC_*.
try {
  loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch (error) {
  if (error.code !== "ENOENT") throw new Error("arquivo .env ilegivel");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
};
export default nextConfig;
