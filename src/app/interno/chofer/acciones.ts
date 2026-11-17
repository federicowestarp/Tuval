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
  const id = await asegurarRuta(yo.id, UUID.test(v) ? v : null);
  const odo = Math.round(Number(fd.get("odometro")));
  let foto: string | null = null;
  try { foto = await guardarArchivo(fd.get("foto_odometro"), TIPOS_IMAGEN); } catch { foto = null; }
  if (odo > 0) await sql`update rutas set odometro_inicio = coalesce(odometro_inicio, ${odo}), foto_odometro_inicio = coalesce(foto_odometro_inicio, ${foto}) where id = ${id}`;
  revalidatePath("/interno/chofer");
}

export async function terminarRuta(fd: FormData) {
  const yo = await requerirInterno();
  const odo = Math.round(Number(fd.get("odometro")));
  let foto: string | null = null;
  try { foto = await guardarArchivo(fd.get("foto_odometro"), TIPOS_IMAGEN); } catch { foto = null; }
  await sql`
    update rutas set terminada_en = now(),
      odometro_fin = case when ${odo > 0} and ${odo} >= coalesce(odometro_inicio, 0) then ${odo > 0 ? odo : null}::int else odometro_fin end,
      foto_odometro_fin = coalesce(${foto}, foto_odometro_fin)
    where chofer_id = ${yo.id} and fecha = ${hoyMx()}`;
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
    await tx`update paradas_ruta set salida_en = now() where pedido_id = ${pedidoId} and tipo = 'entrega' and salida_en is null`;
    await tx`
      insert into pedido_eventos (pedido_id, estado, nota, usuario_id)
      values (${pedidoId}, 'entregado', ${sinRecepcion ? "Entregado sin recepción (con foto)" : `Recibió ${recibio}`}, ${yo.id})`;
  });
  revalidatePath("/interno/chofer");
  return { ok: true };
}

/** Llegó a la bodega del proveedor (o a la sucursal) a recoger. */
export async function llegarARecoger(fd: FormData) {
  const yo = await requerirInterno();
  const almacen = String(fd.get("almacen_id"));
  if (!UUID.test(almacen)) return;
  const rutaId = await asegurarRuta(yo.id);
  const [abierta] = await sql`select 1 from paradas_ruta where ruta_id = ${rutaId} and salida_en is null`;
  if (!abierta) await sql`insert into paradas_ruta (ruta_id, tipo, almacen_id, lat, lng) values (${rutaId}, 'recoleccion', ${almacen}, ${Number(fd.get("lat")) || null}, ${Number(fd.get("lng")) || null})`;
  revalidatePath("/interno/chofer");
}

/** Recogió: los pedidos marcados pasan a "surtido" y la parada se cierra (tiempo de espera en bodega). */
export async function salirDeRecoger(fd: FormData) {
  const yo = await requerirInterno();
  const parada = String(fd.get("parada_id"));
  const pedidos = fd.getAll("pedido_id").map(String).filter((x) => UUID.test(x));
  if (!UUID.test(parada)) return;
  await sql.begin(async (tx) => {
    const [p] = await tx<{ almacen: string }[]>`
      update paradas_ruta pr set salida_en = now() from rutas r, almacenes a
      where pr.id = ${parada} and r.id = pr.ruta_id and r.chofer_id = ${yo.id} and a.id = pr.almacen_id and pr.salida_en is null
      returning a.nombre almacen`;
    if (!p) return;
    for (const id of pedidos) {
      const [u] = await tx`update pedidos set estado = 'surtido' where id = ${id} and estado = 'comprado_proveedor' returning id`;
      if (!u) continue;
      await tx`insert into parada_pedidos (parada_id, pedido_id) values (${parada}, ${id}) on conflict do nothing`;
      await tx`insert into pedido_eventos (pedido_id, estado, nota, usuario_id) values (${id}, 'surtido', ${"Recolectado en " + p.almacen}, ${yo.id})`;
    }
  });
  revalidatePath("/interno/chofer");
}

/** Llegó con el cliente: desde aquí corre el tiempo de espera en obra. */
export async function llegueConCliente(fd: FormData) {
  const yo = await requerirInterno();
  const pedidoId = String(fd.get("pedido_id"));
  if (!UUID.test(pedidoId)) return;
  const rutaId = await asegurarRuta(yo.id);
  const [ya] = await sql`select 1 from paradas_ruta where pedido_id = ${pedidoId} and tipo = 'entrega' and salida_en is null`;
  if (!ya) await sql`insert into paradas_ruta (ruta_id, tipo, pedido_id, lat, lng) values (${rutaId}, 'entrega', ${pedidoId}, ${Number(fd.get("lat")) || null}, ${Number(fd.get("lng")) || null})`;
  revalidatePath("/interno/chofer");
}

export type EstadoCarga = { error?: string; ok?: number };

/** Carga de gasolina: queda como gasto del vehículo de la ruta, con litros y odómetro (rendimiento km/l). */
export async function cargarCombustible(prev: EstadoCarga, fd: FormData): Promise<EstadoCarga> {
  const yo = await requerirInterno();
  const litros = Number(String(fd.get("litros") ?? "").replace(",", "."));
  const monto = Number(String(fd.get("monto") ?? "").replace(/[$,\s]/g, ""));
  const odo = Math.round(Number(fd.get("odometro")));
  if (!(litros > 0) || !(monto > 0)) return { error: "Escribe litros y monto." };
  const r = await rutaDeHoy(yo.id);
  const [ruta] = r ? await sql<{ vehiculo_id: string | null }[]>`select vehiculo_id from rutas where id = ${r.id}` : [];
  if (!ruta?.vehiculo_id) return { error: "Inicia la ruta con un vehículo antes de registrar gasolina." };
  let foto: string | null;
  try { foto = await guardarArchivo(fd.get("ticket"), TIPOS_IMAGEN); } catch (e) { return { error: (e as Error).message }; }
  if (!foto) return { error: "Toma foto del ticket." };
  await sql`
    insert into gastos (fecha, categoria, concepto, monto, vehiculo_id, forma_pago, comprobante_id, creado_por, litros, odometro)
    values (${hoyMx()}, 'combustible', ${`Gasolina ${litros} L`}, ${monto}, ${ruta.vehiculo_id}, ${String(fd.get("forma_pago") || "Efectivo")}, ${foto}, ${yo.id}, ${litros}, ${odo > 0 ? odo : null})`;
  revalidatePath("/interno/chofer");
  return { ok: (prev.ok ?? 0) + 1 };
}
