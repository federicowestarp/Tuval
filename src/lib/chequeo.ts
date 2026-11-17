/* eslint-disable @typescript-eslint/no-explicit-any */
import type postgres from "postgres";
import { sql } from "./db";
import { sucursal } from "./inventario";

type Tx = postgres.Sql<any> | postgres.TransactionSql<any>;

/**
 * Arma (una vez al día) la lista de chequeo: productos al azar con existencia en sucursal,
 * dando más peso a los de más valor y a los que no se han revisado en 30 días.
 */
export async function asegurarChequeosHoy(tx: Tx = sql) {
  const s = await sucursal(tx);
  const [p] = await tx<{ n: number }[]>`select coalesce((select valor from parametros_operacion where clave = 'chequeos_por_dia'), 5)::int n`;
  await tx`
    insert into chequeos_anaquel (producto_id, almacen_id)
    select e.producto_id, ${s.id}
    from existencias e join productos pr on pr.id = e.producto_id
    where e.almacen_id = ${s.id} and e.cantidad > 0 and pr.activo
      and not exists (select 1 from chequeos_anaquel c where c.producto_id = e.producto_id and c.almacen_id = ${s.id}
                      and c.fecha > (now() at time zone 'America/Mexico_City')::date - 30)
    order by random() * (1 + ln(1 + e.cantidad * coalesce(pr.costo_promedio, 1))) desc
    limit greatest(0, ${p.n} - (select count(*)::int from chequeos_anaquel where almacen_id = ${s.id} and fecha = (now() at time zone 'America/Mexico_City')::date))
    on conflict do nothing`;
}
