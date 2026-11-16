import { sql } from "@/lib/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sirve un archivo por su id (no adivinable). Pendiente: permisos por cuenta al agregar inicio de sesión. */
export async function GET(_req: Request, ctx: RouteContext<"/archivos/[id]">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response("No encontrado", { status: 404 });
  const [a] = await sql<{ mime: string; datos: Buffer; nombre: string | null }[]>`
    select mime, datos, nombre from archivos where id = ${id}`;
  if (!a) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(a.datos), {
    headers: {
      "Content-Type": a.mime,
      "Content-Disposition": `inline; filename="${encodeURIComponent(a.nombre ?? "archivo")}"`,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
