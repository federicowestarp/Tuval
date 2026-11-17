import { timingSafeEqual } from "node:crypto";
import { sql } from "@/lib/db";

/**
 * Recibe posiciones de los rastreadores GPS de los vehículos.
 * Formatos: flespi HTTP stream (arreglo de mensajes con "ident", "position.latitude"...)
 * y Traccar "forward" JSON ({ device: { uniqueId }, position: { latitude, ... } }).
 * Autenticación: header Authorization: Bearer <RASTREO_TOKEN> (o ?token= si el servicio no permite headers).
 */
type Pos = { ident: string; lat: number; lng: number; kmh: number | null; t: Date };

function autorizado(req: Request) {
  const esperado = process.env.RASTREO_TOKEN;
  if (!esperado || esperado.length < 16) return false;
  const dado = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? new URL(req.url).searchParams.get("token") ?? "";
  const a = Buffer.from(dado), b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

function leer(m: Record<string, unknown>): Pos | null {
  const n = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN);
  // flespi
  if ("ident" in m && "position.latitude" in m) {
    const t = n(m["timestamp"]);
    return { ident: String(m.ident), lat: n(m["position.latitude"]), lng: n(m["position.longitude"]), kmh: Number.isFinite(n(m["position.speed"])) ? n(m["position.speed"]) : null, t: Number.isFinite(t) ? new Date(t * 1000) : new Date() };
  }
  // Traccar
  const d = m.device as Record<string, unknown> | undefined, p = m.position as Record<string, unknown> | undefined;
  if (d && p) {
    const nudos = n(p.speed);
    return { ident: String(d.uniqueId), lat: n(p.latitude), lng: n(p.longitude), kmh: Number.isFinite(nudos) ? nudos * 1.852 : null, t: p.fixTime ? new Date(String(p.fixTime)) : new Date() };
  }
  return null;
}

export async function POST(req: Request) {
  if (!autorizado(req)) return new Response("No autorizado", { status: 401 });
  let cuerpo: unknown;
  try { cuerpo = await req.json(); } catch { return new Response("JSON inválido", { status: 400 }); }
  const mensajes = (Array.isArray(cuerpo) ? cuerpo : [cuerpo]).slice(0, 1000) as Record<string, unknown>[];
  const pos = mensajes.map(leer).filter((p): p is Pos =>
    !!p && p.lat > 14 && p.lat < 33 && p.lng > -118 && p.lng < -86 && !Number.isNaN(p.t.getTime()));
  if (pos.length === 0) return Response.json({ guardadas: 0 });
  const idents = [...new Set(pos.map((p) => p.ident))];
  const vehiculos = await sql<{ id: string; rastreador_id: string }[]>`select id, rastreador_id from vehiculos where rastreador_id = any(${idents})`;
  const mapa = new Map(vehiculos.map((v) => [v.rastreador_id, v.id]));
  const filas = pos.filter((p) => mapa.has(p.ident));
  if (filas.length) await sql`
    insert into posiciones_vehiculo (vehiculo_id, lat, lng, velocidad_kmh, registrada_en)
    select * from unnest(${filas.map((p) => mapa.get(p.ident)!)}::uuid[], ${filas.map((p) => p.lat)}::float8[], ${filas.map((p) => p.lng)}::float8[],
                         ${filas.map((p) => p.kmh)}::float8[], ${filas.map((p) => p.t.toISOString())}::timestamptz[])`;
  return Response.json({ guardadas: filas.length, sin_vehiculo: [...new Set(pos.filter((p) => !mapa.has(p.ident)).map((p) => p.ident))] });
}
