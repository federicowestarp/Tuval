import { sql } from "@/lib/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fotos públicas de productos. Solo sirve archivos que son foto de algún producto
 * (los demás archivos siguen en /archivos). Cada foto nueva tiene id nuevo, así que
 * se puede guardar en caché un año en el CDN.
 */
export async function GET(_req: Request, ctx: RouteContext<"/fotos/[id]">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response("No encontrado", { status: 404 });
  const [a] = await sql<{ mime: string; datos: Buffer }[]>`
    select a.mime, a.datos from archivos a
    where a.id = ${id} and exists (select 1 from productos p where p.imagen_url = ${"/fotos/" + id})`;
  if (!a) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(a.datos), {
    headers: {
      "Content-Type": a.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
