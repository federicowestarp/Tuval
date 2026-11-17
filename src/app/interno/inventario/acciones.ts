"use server";

import { refrescar } from "@/lib/refrescar";
import { sql } from "@/lib/db";
import { recalcularPrecios } from "@/lib/precios";
import { requerirInterno } from "@/lib/equipo";
import { entradaCompra, mover, sucursal } from "@/lib/inventario";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Recepcion = { proveedor: string | null; referencia: string; lineas: { id: string; cantidad: number; costo: number | null }[] };

/** Entrada de mercancía a la sucursal (compra). El costo es sin IVA. */
export async function recibirMercancia(r: Recepcion): Promise<{ error?: string; ok?: number }> {
  const yo = await requerirInterno("mostrador");
  const lineas = (r.lineas ?? []).filter((l) => UUID.test(l.id) && Number(l.cantidad) > 0);
  if (lineas.length === 0) return { error: "Agrega al menos un producto con cantidad." };
  const s = await sucursal();
  const prov = r.proveedor && UUID.test(r.proveedor) ? r.proveedor : null;
  const ref = String(r.referencia ?? "").trim().slice(0, 80) || null;
  try {
  await sql.begin(async (tx) => {
    for (const l of lineas) {
      const costo = l.costo != null && Number(l.costo) > 0 ? Number(l.costo) : null;
      await entradaCompra(tx, { producto: l.id, cantidad: Number(l.cantidad), costo, almacen: s.id, referencia: ref, usuario: yo.id, escaneado: true });
      if (prov && costo) await tx`
        insert into productos_proveedor (producto_id, proveedor_id, costo) values (${l.id}, ${prov}, ${costo})
        on conflict (producto_id, proveedor_id) do update set costo = excluded.costo`;
    }
    await recalcularPrecios(tx, lineas.map((l) => l.id));
  });
  } catch (e) {
    return { error: `No se guardó: ${(e as Error).message}` };
  }
  refrescar("/interno/inventario");
  return { ok: lineas.length };
}

export type Conteo = { lineas: { id: string; contado: number }[] };

/** Conteo cíclico: compara contra sistema y ajusta la diferencia (queda en el libro como ajuste_conteo). */
export async function guardarConteo(c: Conteo): Promise<{ error?: string; ajustes?: number }> {
  const yo = await requerirInterno("mostrador");
  const lineas = (c.lineas ?? []).filter((l) => UUID.test(l.id) && Number(l.contado) >= 0);
  if (lineas.length === 0) return { error: "Captura al menos un producto." };
  const s = await sucursal();
  let ajustes = 0;
  await sql.begin(async (tx) => {
    const [conteo] = await tx<{ id: string }[]>`insert into conteos (almacen_id, realizado_por) values (${s.id}, ${yo.id}) returning id`;
    for (const l of lineas) {
      const [e] = await tx<{ cantidad: number }[]>`select cantidad::float cantidad from existencias where producto_id = ${l.id} and almacen_id = ${s.id} for update`;
      const sistema = e?.cantidad ?? 0;
      const contado = Number(l.contado);
      await tx`insert into conteo_partidas (conteo_id, producto_id, sistema, contado) values (${conteo.id}, ${l.id}, ${sistema}, ${contado})
               on conflict do nothing`;
      const dif = contado - sistema;
      if (dif !== 0) {
        ajustes++;
        await mover(tx, {
          producto: l.id, cantidad: Math.abs(dif), tipo: "ajuste_conteo", origen: dif < 0 ? s.id : null, destino: dif > 0 ? s.id : null,
          nota: `Conteo: sistema ${sistema}, contado ${contado}`, usuario: yo.id, escaneado: true,
        });
      }
    }
  });
  refrescar("/interno/inventario");
  return { ajustes };
}

export async function fijarMinimo(fd: FormData) {
  await requerirInterno("mostrador");
  const id = String(fd.get("producto_id"));
  const min = Number(fd.get("minimo"));
  if (!UUID.test(id) || !(min >= 0)) return;
  const s = await sucursal();
  await sql`
    insert into existencias (producto_id, almacen_id, cantidad, minimo) values (${id}, ${s.id}, 0, ${min})
    on conflict (producto_id, almacen_id) do update set minimo = ${min}`;
  refrescar("/interno/inventario");
}
