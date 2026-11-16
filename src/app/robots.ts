import type { MetadataRoute } from "next";
import { URL_SITIO } from "@/lib/sitio";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/interno", "/pedido/", "/entrega/", "/cuenta", "/carrito", "/archivos/"] },
    sitemap: `${URL_SITIO}/sitemap.xml`,
  };
}
