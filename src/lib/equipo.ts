import { cache } from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { sql } from "@/lib/db";

/** Sesión del equipo Tuval (panel interno). Contraseñas con scrypt; la cookie solo guarda un token aleatorio. */
const scrypt = promisify(scryptCb) as (pw: string, sal: Buffer, largo: number) => Promise<Buffer>;
export const COOKIE_INTERNA = "tuval_interno";
const DIAS_SESION = 7;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

export type RolInterno = "admin" | "operador" | "chofer" | "mostrador" | "supervisor";
export type Minimo = "admin" | "operador" | "mostrador" | "supervisor";
export type UsuarioInterno = { id: string; nombre: string; correo: string; rol: RolInterno };

export async function hashContrasena(contrasena: string): Promise<string> {
  const sal = randomBytes(16);
  const h = await scrypt(contrasena, sal, 64);
  return `${sal.toString("hex")}:${h.toString("hex")}`;
}

export async function contrasenaValida(contrasena: string, guardada: string): Promise<boolean> {
  const [salHex, hashHex] = guardada.split(":");
  if (!salHex || !hashHex) return false;
  const h = await scrypt(contrasena, Buffer.from(salHex, "hex"), 64);
  const esperado = Buffer.from(hashHex, "hex");
  return esperado.length === h.length && timingSafeEqual(esperado, h);
}

/** Reglas mínimas: 10 caracteres, con letras y números. */
export function problemaContrasena(c: string): string | null {
  if (c.length < 10) return "La contraseña debe tener al menos 10 caracteres.";
  if (!/[a-zA-Z]/.test(c) || !/\d/.test(c)) return "Usa letras y números.";
  return null;
}

export async function iniciarSesion(usuarioId: string) {
  const token = randomBytes(32).toString("base64url");
  await sql`
    insert into sesiones_internas (token_hash, usuario_id, expira_en)
    values (${hash(token)}, ${usuarioId}, now() + ${`${DIAS_SESION} days`}::interval)`;
  await sql`update usuarios_internos set ultimo_acceso = now() where id = ${usuarioId}`;
  (await cookies()).set(COOKIE_INTERNA, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DIAS_SESION * 24 * 60 * 60,
  });
}

/** Una sola consulta por petición aunque la llamen la barra y la página (React cache). */
export const usuarioInterno = cache(async (): Promise<UsuarioInterno | null> => {
  const token = (await cookies()).get(COOKIE_INTERNA)?.value;
  if (!token) return null;
  const [u] = await sql<UsuarioInterno[]>`
    select u.id, u.nombre, u.correo, u.rol
    from sesiones_internas s join usuarios_internos u on u.id = s.usuario_id
    where s.token_hash = ${hash(token)} and s.expira_en > now() and u.activo`;
  return u ?? null;
});

/**
 * Qué puede ver cada rol. admin: todo · operador: pedidos, demanda, mostrador, inventario y ruta ·
 * mostrador: punto de venta e inventario · chofer: solo su ruta.
 */
export const puede = (rol: RolInterno, minimo?: Minimo) =>
  !minimo || rol === "admin" ||
  (minimo === "operador" && rol === "operador") ||
  (minimo === "mostrador" && (rol === "operador" || rol === "mostrador" || rol === "supervisor")) ||
  // Supervisor de caja: ve esperados y diferencias, autoriza aperturas, retiros, transferencias e incidentes.
  (minimo === "supervisor" && rol === "supervisor");

/** Para páginas y acciones del panel: sin sesión → a la entrada; sin rol suficiente → no existe. */
export async function requerirInterno(minimo?: Minimo): Promise<UsuarioInterno> {
  const u = await usuarioInterno();
  if (!u) redirect("/interno/entrar");
  if (!puede(u.rol, minimo)) notFound();
  return u;
}

export async function terminarSesion() {
  const jar = await cookies();
  const token = jar.get(COOKIE_INTERNA)?.value;
  if (token) await sql`delete from sesiones_internas where token_hash = ${hash(token)}`;
  jar.delete(COOKIE_INTERNA);
}

/** 5 intentos fallidos en 15 minutos bloquean ese correo un rato. */
export async function bloqueado(correo: string): Promise<boolean> {
  const [r] = await sql<{ n: number }[]>`
    select count(*)::int as n from intentos_acceso
    where correo = ${correo} and not exitoso and creado_en > now() - interval '15 minutes'`;
  return r.n >= 5;
}

export async function registrarIntento(correo: string, exitoso: boolean) {
  await sql`insert into intentos_acceso (correo, exitoso) values (${correo}, ${exitoso})`;
}

/** Invitación de un solo uso (24 h). Devuelve el token: se muestra una vez y no se guarda en claro. */
export async function crearInvitacion(rol: RolInterno, creadaPor: string | null): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await sql`
    insert into invitaciones_internas (token_hash, rol, creada_por, expira_en)
    values (${hash(token)}, ${rol}, ${creadaPor}, now() + interval '24 hours')`;
  return token;
}

export async function invitacionVigente(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const [i] = await sql<{ rol: RolInterno }[]>`
    select rol from invitaciones_internas where token_hash = ${hash(token)} and usada_en is null and expira_en > now()`;
  return i ?? null;
}

export const hashToken = hash;
