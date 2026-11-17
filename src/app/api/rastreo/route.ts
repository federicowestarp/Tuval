import { timingSafeEqual } from "node:crypto";
import { sql } from "@/lib/db";

/**
 * Recibe posiciones de los rastreadores GPS de los vehículos.
 * Formatos: flespi HTTP stream (arreglo de mensajes con "ident", "position.latitude"...),
 * Traccar "forward" JSON ({ device: { uniqueId }, position: { latitude, ... } }) y la app
 * Traccar Client del celular: protocolo OsmAnd (?id=&lat=&lon=&timestamp=&speed=) o su JSON
 * ({ device_id, location: { timestamp, coords: { latitude, longitude, speed } } }).
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
  // Traccar Client (JSON nuevo); speed en m/s
  const loc = m.location as Record<string, unknown> | undefined;
  if (loc && typeof loc.coords === "object" && m.device_id) {
    const c = loc.coords as Record<string, unknown>;
    const v = n(c.speed);
    return { ident: String(m.device_id), lat: n(c.latitude), lng: n(c.longitude), kmh: Number.isFinite(v) && v >= 0 ? v * 3.6 : null, t: loc.timestamp ? new Date(String(loc.timestamp)) : new Date() };
  }
  // OsmAnd (parámetros); speed en nudos, timestamp en segundos o ISO
  if ("id" in m && "lat" in m && "lon" in m) {
    const ts = String(m.timestamp ?? "");
    const v = n(m.speed);
    return { ident: String(m.id), lat: n(m.lat), lng: n(m.lon), kmh: Number.isFinite(v) ? v * 1.852 : null, t: /^\d+$/.test(ts) ? new Date(Number(ts) * (ts.length > 11 ? 1 : 1000)) : ts ? new Date(ts) : new Date() };
  }
  // Traccar
  const d = m.device as Record<string, unknown> | undefined, p = m.position as Record<string, unknown> | undefined;
  if (d && p) {
    const nudos = n(p.speed);
    return { ident: String(d.uniqueId), lat: n(p.latitude), lng: n(p.longitude), kmh: Number.isFinite(nudos) ? nudos * 1.852 : null, t: p.fixTime ? new Date(String(p.fixTime)) : new Date() };
  }
  return null;
}

export async function GET(req: Request) {
  if (!autorizado(req)) return new Response("No autorizado", { status: 401 });
  return guardar([Object.fromEntries(new URL(req.url).searchParams)]);
}

export async function POST(req: Request) {
  if (!autorizado(req)) return new Response("No autorizado", { status: 401 });
  const params = Object.fromEntries(new URL(req.url).searchParams);
  if (params.lat && params.lon) return guardar([params]);
  const texto = await req.text();
  let cuerpo: unknown;
  try { cuerpo = JSON.parse(texto); } catch {
    const form = Object.fromEntries(new URLSearchParams(texto));
    if (form.lat && form.lon) return guardar([form]);
    return new Response("Formato no reconocido", { status: 400 });
  }
  return guardar((Array.isArray(cuerpo) ? cuerpo : [cuerpo]) as Record<string, unknown>[]);
}

async function guardar(entrada: Record<string, unknown>[]) {
  const mensajes = entrada.slice(0, 1000);
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
