import type { MetadataRoute } from "next";
import { URL_SITIO } from "@/lib/sitio";
import { skusPublicos } from "@/lib/catalogo";
import { CATEGORIAS } from "@/lib/categorias";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fijas = ["", "/tienda", "/lista", "/obras"].map((r) => ({ url: `${URL_SITIO}${r}`, changeFrequency: "weekly" as const, priority: r === "" ? 1 : 0.8 }));
  const cats = CATEGORIAS.map((c) => ({ url: `${URL_SITIO}/tienda?cat=${c.id}`, changeFrequency: "weekly" as const, priority: 0.6 }));
  let productos: MetadataRoute.Sitemap = [];
  try {
    productos = (await skusPublicos()).map((p) => ({ url: `${URL_SITIO}/producto/${encodeURIComponent(p.sku)}`, changeFrequency: "weekly" as const, priority: 0.5 }));
  } catch {
    // sin base de datos (compilación): solo páginas fijas
  }
  return [...fijas, ...cats, ...productos];
}
