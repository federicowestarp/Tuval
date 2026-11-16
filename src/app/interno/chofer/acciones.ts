"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { guardarArchivo, TIPOS_IMAGEN } from "@/lib/archivos";
import { hoyMx, rutaDeHoy } from "@/lib/ruta";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function asegurarRuta(choferId: string, vehiculoId: string | null = null) {
  const [r] = await sql<{ id: string }[]>`
    insert into rutas (chofer_id, fecha, iniciada_en, vehiculo_id) values (${choferId}, ${hoyMx()}, now(), ${vehiculoId})
    on conflict (chofer_id, fecha) do update set iniciada_en = coalesce(rutas.iniciada_en, now()), terminada_en = null,
      vehiculo_id = coalesce(excluded.vehiculo_id, rutas.vehiculo_id)
    returning id`;
  return r.id;
}

export async function iniciarRuta(fd: FormData) {
  const yo = await requerirInterno();
  const v = String(fd.get("vehiculo_id") ?? "");
  await asegurarRuta(yo.id, UUID.test(v) ? v : null);
  revalidatePath("/interno/chofer");
}

export async function terminarRuta() {
  const yo = await requerirInterno();
  await sql`update rutas set terminada_en = now() where chofer_id = ${yo.id} and fecha = ${hoyMx()}`;
  revalidatePath("/interno/chofer");
}

/** El chofer toma el pedido: queda "en ruta" y el cliente ve su ubicación. */
export async function salirAEntregar(fd: FormData) {
  const yo = await requerirInterno();
  const pedidoId = String(fd.get("pedido_id"));
  if (!UUID.test(pedidoId)) return;
  const rutaId = await asegurarRuta(yo.id);
  await sql.begin(async (tx) => {
    const [p] = await tx<{ estado: string }[]>`select estado from pedidos where id = ${pedidoId} for update`;
    if (!p || (p.estado !== "surtido" && p.estado !== "en_ruta")) return;
    await tx`update pedidos set estado = 'en_ruta' where id = ${pedidoId}`;
    const [e] = await tx`select 1 from entregas where pedido_id = ${pedidoId} and estado in ('programada', 'en_ruta')`;
    if (e) await tx`update entregas set ruta_id = ${rutaId}, estado = 'en_ruta' where pedido_id = ${pedidoId} and estado in ('programada', 'en_ruta')`;
    else await tx`insert into entregas (pedido_id, ruta_id, estado) values (${pedidoId}, ${rutaId}, 'en_ruta')`;
    if (p.estado !== "en_ruta") await tx`insert into pedido_eventos (pedido_id, estado, nota, usuario_id) values (${pedidoId}, 'en_ruta', 'Salió a entregar', ${yo.id})`;
  });
  revalidatePath("/interno/chofer");
}

export async function registrarPosicion(lat: number, lng: number, precision: number | null) {
  const yo = await requerirInterno();
  if (!(lat > 14 && lat < 33 && lng > -118 && lng < -86)) return;
  const r = await rutaDeHoy(yo.id);
  if (!r || r.terminada_en) return;
  await sql`insert into posiciones_ruta (ruta_id, lat, lng, precision_m) values (${r.id}, ${lat}, ${lng}, ${precision})`;
}

export type EstadoEntrega = { error?: string; ok?: boolean };

/** Entrega con evidencia: al menos una foto; nombre de quien recibe salvo entrega sin recepción. */
export async function entregar(_prev: EstadoEntrega, fd: FormData): Promise<EstadoEntrega> {
  const yo = await requerirInterno();
  const pedidoId = String(fd.get("pedido_id"));
  if (!UUID.test(pedidoId)) return { error: "Pedido no válido." };
  const [p] = await sql<{ estado: string; sin_recepcion_solicitada: boolean }[]>`select estado, sin_recepcion_solicitada from pedidos where id = ${pedidoId}`;
  if (!p || (p.estado !== "en_ruta" && p.estado !== "surtido")) return { error: "Este pedido ya no está pendiente de entrega." };

  const sinRecepcion = fd.get("sin_recepcion") === "on";
  if (sinRecepcion && !p.sin_recepcion_solicitada) return { error: "El cliente no autorizó dejarlo sin recepción." };
  const recibio = String(fd.get("recibio") ?? "").trim();
  if (!sinRecepcion && recibio.length < 3) return { error: "Escribe quién recibió." };
  const fotos = fd.getAll("fotos").filter((f): f is File => typeof f !== "string" && f.size > 0).slice(0, 4);
  if (fotos.length === 0) return { error: "Toma al menos una foto del material entregado." };
  const lat = Number(fd.get("lat")) || null;
  const lng = Number(fd.get("lng")) || null;

  let ids: string[];
  try {
    ids = (await Promise.all(fotos.map((f) => guardarArchivo(f, TIPOS_IMAGEN)))).filter((x): x is string => !!x);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const rutaId = await asegurarRuta(yo.id);
  await sql.begin(async (tx) => {
    let [e] = await tx<{ id: string }[]>`select id from entregas where pedido_id = ${pedidoId} and estado in ('programada', 'en_ruta') limit 1`;
    if (!e) [e] = await tx<{ id: string }[]>`insert into entregas (pedido_id, ruta_id, estado) values (${pedidoId}, ${rutaId}, 'en_ruta') returning id`;
    await tx`
      update entregas set estado = 'entregada', entregada_en = now(), sin_recepcion = ${sinRecepcion},
        recibio_nombre = ${sinRecepcion ? null : recibio}, recibio_telefono = ${String(fd.get("recibio_telefono") ?? "").replace(/\D/g, "") || null},
        notas = ${String(fd.get("notas") ?? "").trim() || null}, lat = ${lat}, lng = ${lng}
      where id = ${e.id}`;
    for (const a of ids) await tx`insert into entrega_fotos (entrega_id, url, lat, lng) values (${e.id}, ${"/archivos/" + a}, ${lat}, ${lng})`;
    await tx`update pedidos set estado = 'entregado' where id = ${pedidoId} and estado in ('en_ruta', 'surtido')`;
    await tx`
      insert into pedido_eventos (pedido_id, estado, nota, usuario_id)
      values (${pedidoId}, 'entregado', ${sinRecepcion ? "Entregado sin recepción (con foto)" : `Recibió ${recibio}`}, ${yo.id})`;
  });
  revalidatePath("/interno/chofer");
  return { ok: true };
}
