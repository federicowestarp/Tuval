"use server";

import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { estadoCuenta, puntosDe } from "@/lib/clientes";
import { paramLealtad } from "@/lib/lealtad";
import { preciosParaLista } from "@/lib/precios";

export type InfoCliente = {
  id: string; nombre: string; telefono: string | null; rfc: string | null; lista: string | null; listaId: string | null;
  puntos: number; valorPunto: number; credito: { activo: boolean; disponible: number | null; vencido: number };
};

export async function infoCliente(id: string): Promise<InfoCliente | null> {
  await requerirInterno("mostrador");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [c] = await sql<{ id: string; nombre: string; telefono: string | null; rfc: string | null; lista: string | null; lista_precio_id: string | null }[]>`
    select c.id, c.nombre, c.telefono, c.rfc, l.nombre lista, c.lista_precio_id from clientes c left join listas_precio l on l.id = c.lista_precio_id where c.id = ${id}`;
  if (!c) return null;
  const [cuenta, puntos, lp] = await Promise.all([estadoCuenta(id), puntosDe(id), paramLealtad()]);
  return {
    id: c.id, nombre: c.nombre, telefono: c.telefono, rfc: c.rfc, lista: c.lista, listaId: c.lista_precio_id,
    puntos, valorPunto: lp.valor_punto ?? 1,
    credito: { activo: cuenta.activo && cuenta.limite != null, disponible: cuenta.disponible, vencido: cuenta.vencido },
  };
}

/** Precios (sin IVA) de la lista del cliente para los productos del carrito. */
export async function preciosDeLista(productos: string[], listaId: string | null): Promise<Record<string, number | null>> {
  await requerirInterno("mostrador");
  const ids = (productos ?? []).filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 200);
  if (!ids.length) return {};
  return Object.fromEntries(await preciosParaLista(ids, listaId && /^[0-9a-f-]{36}$/i.test(listaId) ? listaId : null));
}
