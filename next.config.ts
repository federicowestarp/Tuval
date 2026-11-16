import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Fotos de fachada y listas (PDF/foto) se suben por Server Actions; las fotos se comprimen en el navegador.
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  partialPrefetching: true,
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
