import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // librerie Node con file propri (pdf.js, worker di tesseract): non vanno impacchettate
  serverExternalPackages: ["pdf-parse", "tesseract.js"],
  experimental: { serverActions: { bodySizeLimit: "30mb" } },
};

export default nextConfig;
