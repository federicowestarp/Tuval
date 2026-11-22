import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Fotos de fachada y listas (PDF/foto) se suben por Server Actions; las fotos se comprimen en el navegador.
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  partialPrefetching: true,
  // El service worker del modo sin conexión siempre se revisa contra el servidor (si no, una versión vieja se queda pegada).
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] }];
  },
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
