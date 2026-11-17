"use server";

import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { mover } from "@/lib/inventario";
import { refrescar } from "@/lib/refrescar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EstadoChequeo = { error?: string; ok?: boolean; diferencia?: boolean };

/** Conteo ciego del chequeo. La existencia del sistema se toma en ese momento (no se le muestra a quien cuenta). */
export async function registrarChequeo(id: string, contado: number, etiquetaOk: boolean): Promise<EstadoChequeo> {
  const yo = await requerirInterno("mostrador");
  if (!UUID.test(id)) return { error: "Chequeo no válido." };
  if (!Number.isFinite(contado) || contado < 0) return { error: "Escribe cuántas piezas hay (0 si no hay)." };
  const [r] = await sql<{ esperado: number }[]>`
    update chequeos_anaquel c set contado = ${contado}, etiqueta_ok = ${etiquetaOk}, usuario_id = ${yo.id}, contado_en = now(),
      esperado = coalesce((select cantidad from existencias e where e.producto_id = c.producto_id and e.almacen_id = c.almacen_id), 0)
    where c.id = ${id} and c.contado is null returning esperado::float esperado`;
  if (!r) return { error: "Este chequeo ya se registró." };
  refrescar("/interno/chequeo");
  return { ok: true, diferencia: r.esperado !== contado };
}

/** Supervisión decide: ajustar el inventario al conteo, o dejarlo (se encontró la pieza, error de conteo). */
export async function resolverChequeo(fd: FormData) {
  const yo = await requerirInterno("supervisor");
  const id = String(fd.get("id"));
  const ajustar = fd.get("resolucion") === "ajustado";
  if (!UUID.test(id)) return;
  await sql.begin(async (tx) => {
    const [c] = await tx<{ producto_id: string; almacen_id: string; esperado: number; contado: number; costo: number | null }[]>`
      select c.producto_id, c.almacen_id, c.esperado::float esperado, c.contado::float contado, p.costo_promedio::float costo
      from chequeos_anaquel c join productos p on p.id = c.producto_id where c.id = ${id} and c.revisado_en is null and c.contado is not null for update of c`;
    if (!c) return;
    const dif = c.contado - c.esperado;
    if (ajustar && dif !== 0) await mover(tx, {
      producto: c.producto_id, cantidad: Math.abs(dif), tipo: "ajuste_conteo", origen: dif < 0 ? c.almacen_id : null, destino: dif > 0 ? c.almacen_id : null,
      costo: c.costo, referencia: "Chequeo de anaquel", nota: `Chequeo: sistema ${c.esperado}, contado ${c.contado}`, usuario: yo.id, escaneado: true,
    });
    await tx`update chequeos_anaquel set revisado_en = now(), revisado_por = ${yo.id}, resolucion = ${ajustar ? "ajustado" : "sin_ajuste"} where id = ${id}`;
  });
  refrescar("/interno/chequeo");
  refrescar("/interno/inventario");
}
