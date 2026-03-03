import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function loadRootEnvFallback() {
  // Next.js only auto-loads env files within `web/`.
  // For local dev convenience, also read `../.env` if present (without overriding existing env).
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const rootEnvPath = path.resolve(__dirname, "..", ".env");

  if (!fs.existsSync(rootEnvPath)) return;

  const text = fs.readFileSync(rootEnvPath, "utf-8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    if (!key) continue;
    if (process.env[key] !== undefined && process.env[key] !== "") continue;
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadRootEnvFallback();

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["*"]
    }
  }
};

export default nextConfig;
