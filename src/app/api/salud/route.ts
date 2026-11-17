import { sql } from "@/lib/db";

/** Latido: lo visita la base cada pocos minutos para mantener caliente el servidor y su conexión. */
export async function GET() {
  const t = Date.now();
  await sql`select 1`;
  return Response.json({ ok: true, ms: Date.now() - t }, { headers: { "Cache-Control": "no-store" } });
}
