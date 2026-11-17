"use server";

import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { buscarClientes, nuevoCodigoRecomendado, type ClienteLista } from "@/lib/clientes";
import { refrescar } from "@/lib/refrescar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const t = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const o = (fd: FormData, k: string) => t(fd, k) || null;
const PREF = ["whatsapp", "llamada", "correo"];

export async function buscarClientesAccion(q: string): Promise<ClienteLista[]> {
  await requerirInterno("mostrador");
  return buscarClientes(String(q).slice(0, 80));
}

/** Alta rápida (mostrador o panel). Devuelve el id; el código de recomendado se genera solo. */
export async function crearClienteRapido(d: { nombre: string; telefono?: string; rfc?: string; codigo?: string }): Promise<{ id?: string; error?: string }> {
  await requerirInterno("mostrador");
  const nombre = String(d.nombre ?? "").trim();
  if (nombre.length < 2) return { error: "Escribe el nombre." };
  const tel = String(d.telefono ?? "").replace(/\D/g, "").slice(-10) || null;
  if (tel) {
    const [ya] = await sql<{ id: string }[]>`select id from clientes where regexp_replace(coalesce(telefono, ''), '\\D', '', 'g') like ${"%" + tel} and activo limit 1`;
    if (ya) return { id: ya.id };
  }
  const codigo = String(d.codigo ?? "").trim().toUpperCase();
  const [quien] = codigo ? await sql<{ id: string }[]>`select id from clientes where codigo_recomendado = ${codigo}` : [];
  const rfc = String(d.rfc ?? "").trim().toUpperCase() || null;
  const [c] = await sql<{ id: string }[]>`
    insert into clientes (tipo, nombre, telefono, rfc, codigo_recomendado, recomendado_por)
    values (${rfc && rfc.length === 12 ? "empresa" : "persona"}, ${nombre.slice(0, 120)}, ${tel}, ${rfc}, ${nuevoCodigoRecomendado()}, ${quien?.id ?? null}) returning id`;
  refrescar("/interno/clientes");
  return { id: c.id };
}

export async function crearCliente(fd: FormData) {
  const r = await crearClienteRapido({ nombre: t(fd, "nombre"), telefono: t(fd, "telefono"), rfc: t(fd, "rfc"), codigo: t(fd, "codigo") });
  if (r.id) redirect(`/interno/clientes/${r.id}`);
}

export async function guardarCliente(fd: FormData) {
  await requerirInterno("operador");
  const id = t(fd, "id");
  if (!UUID.test(id) || t(fd, "nombre").length < 2) return;
  const pref = t(fd, "preferencia_contacto");
  await sql`
    update clientes set nombre = ${t(fd, "nombre")}, razon_social = ${o(fd, "razon_social")}, rfc = ${o(fd, "rfc")?.toUpperCase() ?? null},
      regimen_fiscal = ${o(fd, "regimen_fiscal")}, codigo_postal_fiscal = ${o(fd, "codigo_postal_fiscal")}, uso_cfdi = ${o(fd, "uso_cfdi")},
      telefono = ${o(fd, "telefono")}, correo = ${o(fd, "correo")}, direccion_fiscal = ${o(fd, "direccion_fiscal")}, direccion_oficina = ${o(fd, "direccion_oficina")},
      preferencia_contacto = ${PREF.includes(pref) ? pref : "whatsapp"}, horario_contacto = ${o(fd, "horario_contacto")},
      acepta_promociones = ${fd.get("acepta_promociones") === "on"}, notas = ${o(fd, "notas")}
    where id = ${id}`;
  refrescar(`/interno/clientes/${id}`);
}

export async function agregarContacto(fd: FormData) {
  await requerirInterno("operador");
  const id = t(fd, "cliente_id");
  if (!UUID.test(id) || t(fd, "nombre").length < 2) return;
  const pref = t(fd, "preferencia");
  await sql`insert into cliente_contactos (cliente_id, nombre, puesto, telefono, correo, preferencia)
            values (${id}, ${t(fd, "nombre")}, ${o(fd, "puesto")}, ${o(fd, "telefono")}, ${o(fd, "correo")}, ${PREF.includes(pref) ? pref : "whatsapp"})`;
  refrescar(`/interno/clientes/${id}`);
}

export async function quitarContacto(fd: FormData) {
  await requerirInterno("operador");
  const id = t(fd, "id"), cliente = t(fd, "cliente_id");
  if (!UUID.test(id)) return;
  await sql`delete from cliente_contactos where id = ${id}`;
  refrescar(`/interno/clientes/${cliente}`);
}

/** Crédito y lista de precios: solo Admin. */
export async function guardarCredito(fd: FormData) {
  await requerirInterno("admin");
  const id = t(fd, "id");
  if (!UUID.test(id)) return;
  const limite = Number(t(fd, "limite_credito").replace(/[$,\s]/g, "")), dias = Math.round(Number(t(fd, "dias_credito")));
  const lista = t(fd, "lista_precio_id");
  await sql`update clientes set credito_activo = ${fd.get("credito_activo") === "on"}, limite_credito = ${limite > 0 ? limite : null},
            dias_credito = ${dias > 0 ? dias : null}, lista_precio_id = ${UUID.test(lista) ? lista : null} where id = ${id}`;
  refrescar(`/interno/clientes/${id}`);
}

export async function ajustarPuntos(fd: FormData) {
  const yo = await requerirInterno("admin");
  const id = t(fd, "id"), puntos = Math.round(Number(t(fd, "puntos")));
  if (!UUID.test(id) || !puntos) return;
  await sql`insert into movimientos_puntos (cliente_id, puntos, motivo, nota, creado_por) values (${id}, ${puntos}, 'ajuste', ${o(fd, "nota")}, ${yo.id})`;
  refrescar(`/interno/clientes/${id}`);
}
