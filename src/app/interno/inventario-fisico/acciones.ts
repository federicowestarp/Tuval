"use server";

import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { mover } from "@/lib/inventario";
import { refrescar } from "@/lib/refrescar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Abre un inventario físico: una tarjeta por producto del almacén (folio consecutivo, ubicación)
 * y congela la existencia del sistema en ese momento. Mientras dura no conviene mover mercancía del almacén.
 */
export async function crearInventario(fd: FormData) {
  const yo = await requerirInterno("supervisor");
  const almacen = String(fd.get("almacen_id"));
  if (!UUID.test(almacen)) return;
  const todos = fd.get("todos") === "on";
  const nombre = String(fd.get("nombre") ?? "").trim() || `Inventario ${new Date().toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" })}`;
  const id = await sql.begin(async (tx) => {
    // Un solo inventario abierto por almacén: si ya hay uno, se lleva a ese.
    const [ya] = await tx<{ id: string }[]>`select id from inventarios_fisicos where almacen_id = ${almacen} and estado = 'abierto'`;
    if (ya) return ya.id;
    const [inv] = await tx<{ id: string }[]>`insert into inventarios_fisicos (almacen_id, nombre, creado_por) values (${almacen}, ${nombre}, ${yo.id}) returning id`;
    await tx`
      insert into tarjetas_inventario (inventario_id, folio, producto_id, ubicacion, sistema)
      select ${inv.id}, row_number() over (order by u.codigo nulls last, p.nombre), p.id, u.codigo, coalesce(e.cantidad, 0)
      from productos p
      left join existencias e on e.producto_id = p.id and e.almacen_id = ${almacen}
      left join ubicaciones u on u.id = e.ubicacion_id
      where p.activo and (${todos} or e.producto_id is not null)`;
    return inv.id;
  });
  refrescar("/interno/inventario-fisico");
  if (id) redirect(`/interno/inventario-fisico/${id}`);
}

export type EstadoConteo = { error?: string; mensaje?: string; siguiente?: string | null };

/**
 * Conteo ciego: quien cuenta nunca ve lo que dice el sistema ni el otro conteo.
 * 1er y 2º conteo los hacen personas distintas; si no coinciden se pide un 3º (de una tercera persona) y ese manda.
 */
export async function registrarConteo(_p: EstadoConteo, fd: FormData): Promise<EstadoConteo> {
  const yo = await requerirInterno("mostrador");
  const id = String(fd.get("tarjeta_id"));
  const n = Number(String(fd.get("cantidad") ?? "").replace(",", "."));
  if (!UUID.test(id)) return { error: "Tarjeta no válida." };
  if (!Number.isFinite(n) || n < 0) return { error: "Escribe la cantidad contada (0 si no hay)." };
  const r = await sql.begin(async (tx) => {
    const [t] = await tx<{ inventario_id: string; estado: string; conteo1: number | null; contador1: string | null; conteo2: number | null; contador2: string | null; conteo3: number | null }[]>`
      select t.inventario_id, i.estado, t.conteo1::float conteo1, t.contador1, t.conteo2::float conteo2, t.contador2, t.conteo3::float conteo3
      from tarjetas_inventario t join inventarios_fisicos i on i.id = t.inventario_id where t.id = ${id} for update of t`;
    if (!t) return { error: "Tarjeta no encontrada." };
    if (t.estado !== "abierto") return { error: "Este inventario ya se cerró." };
    if (t.conteo1 == null) {
      await tx`update tarjetas_inventario set conteo1 = ${n}, contador1 = ${yo.id}, conteo1_en = now() where id = ${id}`;
      return { mensaje: "1er conteo guardado. El 2º lo hace otra persona.", inv: t.inventario_id };
    }
    if (t.conteo2 == null) {
      if (t.contador1 === yo.id) return { error: "Ya hiciste el 1er conteo de esta tarjeta; el 2º lo hace otra persona." };
      const final = n === t.conteo1 ? n : null;
      await tx`update tarjetas_inventario set conteo2 = ${n}, contador2 = ${yo.id}, conteo2_en = now(), final = ${final} where id = ${id}`;
      return { mensaje: final != null ? "2º conteo guardado ✓" : "2º conteo guardado. No coincide con el 1º: se pedirá un 3er conteo.", inv: t.inventario_id };
    }
    if (t.conteo3 == null && t.conteo1 !== t.conteo2) {
      if (t.contador1 === yo.id || t.contador2 === yo.id) return { error: "El 3er conteo lo hace alguien que no contó antes esta tarjeta." };
      await tx`update tarjetas_inventario set conteo3 = ${n}, contador3 = ${yo.id}, conteo3_en = now(), final = ${n} where id = ${id}`;
      return { mensaje: "3er conteo guardado ✓ Este es el definitivo.", inv: t.inventario_id };
    }
    return { error: "Esta tarjeta ya tiene sus conteos completos." };
  });
  if ("inv" in r && r.inv) {
    refrescar(`/interno/inventario-fisico/${r.inv}`);
    const siguiente = await siguienteTarjeta(r.inv, yo.id);
    return { mensaje: r.mensaje, siguiente };
  }
  return r;
}

/** La siguiente tarjeta que esta persona puede contar (para seguir sin volver a la lista). */
async function siguienteTarjeta(inventarioId: string, usuario: string): Promise<string | null> {
  const [t] = await sql<{ id: string }[]>`
    select id from tarjetas_inventario
    where inventario_id = ${inventarioId}
      and (conteo1 is null
           or (conteo2 is null and contador1 <> ${usuario})
           or (conteo2 is not null and conteo1 <> conteo2 and conteo3 is null and contador1 <> ${usuario} and contador2 <> ${usuario}))
    order by folio limit 1`;
  return t?.id ?? null;
}

/** Cierra el inventario: ajusta existencias contra lo que dijo el sistema al abrir y deja la valuación de las diferencias. */
export async function cerrarInventario(fd: FormData) {
  const yo = await requerirInterno("admin");
  const id = String(fd.get("id"));
  if (!UUID.test(id)) return;
  await sql.begin(async (tx) => {
    const [inv] = await tx<{ almacen_id: string; nombre: string }[]>`select almacen_id, nombre from inventarios_fisicos where id = ${id} and estado = 'abierto' for update`;
    if (!inv) return;
    const [pend] = await tx<{ n: number }[]>`select count(*)::int n from tarjetas_inventario where inventario_id = ${id} and final is null`;
    if (pend.n > 0) return;
    const tarjetas = await tx<{ producto_id: string; folio: number; sistema: number; final: number; costo: number | null }[]>`
      select t.producto_id, t.folio, t.sistema::float sistema, t.final::float final, p.costo_promedio::float costo
      from tarjetas_inventario t join productos p on p.id = t.producto_id where t.inventario_id = ${id} and t.final <> t.sistema`;
    for (const t of tarjetas) {
      const dif = t.final - t.sistema;
      await mover(tx, {
        producto: t.producto_id, cantidad: Math.abs(dif), tipo: "ajuste_conteo",
        origen: dif < 0 ? inv.almacen_id : null, destino: dif > 0 ? inv.almacen_id : null, costo: t.costo,
        referencia: `INV ${inv.nombre} · tarjeta ${t.folio}`, nota: `Inventario físico: sistema ${t.sistema}, contado ${t.final}`, usuario: yo.id, escaneado: true,
      });
    }
    await tx`update inventarios_fisicos set estado = 'cerrado', cerrado_en = now() where id = ${id}`;
  });
  refrescar(`/interno/inventario-fisico/${id}`);
  refrescar("/interno/inventario");
}
