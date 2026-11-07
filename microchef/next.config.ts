import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // il client libSQL usa moduli nativi opzionali: lo lasciamo fuori dal bundle del server
  serverExternalPackages: ["@libsql/client", "@prisma/adapter-libsql"],
};

export default nextConfig;
