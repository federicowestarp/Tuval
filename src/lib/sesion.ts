import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { sql } from "@/lib/db";

/**
 * Cuenta de cliente ligada a una cookie segura del dispositivo.
 * Pendiente: verificación por código de WhatsApp para entrar desde otro dispositivo.
 */
const COOKIE = "tuval_sesion";
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

export type Cuenta = { id: string; nombre: string | null; telefono: string | null };

export async function cuentaActual(): Promise<Cuenta | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [c] = await sql<Cuenta[]>`
    select c.id, c.nombre, c.telefono from sesiones s join cuentas c on c.id = s.cuenta_id
    where s.token_hash = ${hash(token)}`;
  return c ?? null;
}

/** Solo en Server Actions (escribe cookie). */
export async function obtenerOCrearCuenta(): Promise<Cuenta> {
  const actual = await cuentaActual();
  if (actual) return actual;
  const token = randomBytes(32).toString("base64url");
  const [c] = await sql<Cuenta[]>`insert into cuentas default values returning id, nombre, telefono`;
  await sql`insert into sesiones (token_hash, cuenta_id) values (${hash(token)}, ${c.id})`;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return c;
}

export const tokenAleatorio = () => randomBytes(18).toString("base64url");

/** Abre sesión en este dispositivo para una cuenta ya existente (acceso dado en caja). Solo en Server Actions o rutas. */
export async function abrirSesionDeCuenta(cuentaId: string) {
  const token = randomBytes(32).toString("base64url");
  await sql`insert into sesiones (token_hash, cuenta_id) values (${hash(token)}, ${cuentaId})`;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365,
  });
}

/** Acceso de un solo uso (QR en caja): devuelve la cuenta si el token es válido y lo marca como usado. */
export async function canjearAcceso(token: string): Promise<string | null> {
  const [a] = await sql<{ cuenta_id: string }[]>`
    update accesos_cuenta set usado_en = now() where token_hash = ${hash(token)} and usado_en is null and expira_en > now() returning cuenta_id`;
  return a?.cuenta_id ?? null;
}

/** Crea el token de acceso de un solo uso (vigencia en minutos). */
export async function crearAcceso(cuentaId: string, usuarioId: string, minutos = 10): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await sql`insert into accesos_cuenta (token_hash, cuenta_id, creado_por, expira_en) values (${hash(token)}, ${cuentaId}, ${usuarioId}, now() + ${minutos + " minutes"}::interval)`;
  return token;
}
