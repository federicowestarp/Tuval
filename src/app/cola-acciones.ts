"use server";

import { sql } from "@/lib/db";
import { usuarioInterno } from "@/lib/equipo";
import { momento } from "@/lib/momento";
import {
  cargarCombustible, entregar, iniciarRuta, llegarARecoger, llegueConCliente, salirAEntregar, salirDeRecoger, terminarRuta,
} from "./interno/chofer/acciones";
import { registrarConteo } from "./interno/inventario-fisico/acciones";
import { registrarChequeo } from "./interno/chequeo/acciones";
import { guardarRecorrido } from "./interno/recorrido/acciones";

/** Lo que se puede hacer sin señal: trabajo de campo y de piso. Cobros, cotizaciones y pedidos de clientes necesitan señal. */
const ACCIONES = {
  iniciarRuta: (fd: FormData) => iniciarRuta(fd),
  terminarRuta: (fd: FormData) => terminarRuta(fd),
  salirAEntregar: (fd: FormData) => salirAEntregar(fd),
  llegarARecoger: (fd: FormData) => llegarARecoger(fd),
  salirDeRecoger: (fd: FormData) => salirDeRecoger(fd),
  llegueConCliente: (fd: FormData) => llegueConCliente(fd),
  entregar: (fd: FormData) => entregar({}, fd),
  cargarCombustible: (fd: FormData) => cargarCombustible({}, fd),
  registrarConteo: (fd: FormData) => registrarConteo({}, fd),
  registrarChequeo: (fd: FormData) => {
    const [id, contado, etiqueta] = JSON.parse(String(fd.get("_args") ?? "[]"));
    return registrarChequeo(String(id), Number(contado), !!etiqueta);
  },
  guardarRecorrido: (fd: FormData) => guardarRecorrido({ ...JSON.parse(String(fd.get("_args") ?? "{}")), terminado: String(fd.get("_ocurrido") ?? "") }),
} as const;
export type AccionCola = keyof typeof ACCIONES;

export type RespuestaCola = { ok: boolean; resultado?: unknown; error?: string; sinSesion?: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Aplica un cambio hecho en el teléfono (con o sin señal). `_id` lo genera el teléfono: si llega dos veces, la segunda no hace nada.
 * Campos de control: `_id`, `_accion`, `_ocurrido` (hora real) y `_args` (JSON, para acciones que no usan formulario).
 */
export async function aplicarCambio(fd: FormData): Promise<RespuestaCola> {
  const yo = await usuarioInterno();
  if (!yo) return { ok: false, sinSesion: true, error: "Tu sesión se cerró. Entra de nuevo y se enviará lo pendiente." };
  const id = String(fd.get("_id") ?? "");
  const accion = String(fd.get("_accion") ?? "") as AccionCola;
  if (!UUID.test(id) || !(accion in ACCIONES)) return { ok: false, error: "Cambio no válido." };

  const [nuevo] = await sql<{ id: string }[]>`
    insert into cambios_sin_conexion (id, usuario_id, accion, ocurrido_en) values (${id}, ${yo.id}, ${accion}, ${momento(fd)})
    on conflict (id) do nothing returning id`;
  if (!nuevo) {
    const [r] = await sql<{ resultado: unknown }[]>`select resultado from cambios_sin_conexion where id = ${id}`;
    return { ok: true, resultado: r?.resultado ?? null };
  }
  try {
    const resultado = (await ACCIONES[accion](fd)) ?? null;
    await sql`update cambios_sin_conexion set resultado = ${sql.json(resultado as never)} where id = ${id}`;
    const error = resultado && typeof resultado === "object" && "error" in resultado ? String((resultado as { error?: unknown }).error ?? "") : "";
    return error ? { ok: false, resultado, error } : { ok: true, resultado };
  } catch (e) {
    // Falló en el servidor: se borra el registro para que el teléfono pueda reintentar.
    await sql`delete from cambios_sin_conexion where id = ${id}`;
    throw e;
  }
}
