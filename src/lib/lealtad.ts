import type postgres from "postgres";
import { sql } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- sql o transacción
type Tx = postgres.Sql<any> | postgres.TransactionSql<any>;

export type ParamLealtad = { puntos_por_cada_100: number; valor_punto: number; puntos_recomienda: number; puntos_recomendado: number; compra_minima_recomendado: number };

export async function paramLealtad(tx: Tx = sql): Promise<ParamLealtad> {
  const f = await tx<{ clave: string; valor: number }[]>`
    select clave, valor::float valor from parametros_operacion
    where clave in ('puntos_por_cada_100', 'valor_punto', 'puntos_recomienda', 'puntos_recomendado', 'compra_minima_recomendado')`;
  return Object.fromEntries(f.map((x) => [x.clave, x.valor])) as ParamLealtad;
}

/**
 * Al pagarse una compra: puntos por compra (sobre lo pagado con dinero, no con puntos) y, si es la primera compra
 * de un cliente recomendado que alcanza el mínimo, puntos para él y para quien lo recomendó (una sola vez).
 */
export async function otorgarPuntos(tx: Tx, clienteId: string, pedidoId: string, montoPagado: number) {
  const p = await paramLealtad(tx);
  const puntos = Math.floor((montoPagado / 100) * (p.puntos_por_cada_100 ?? 0));
  const [ya] = await tx`select 1 from movimientos_puntos where pedido_id = ${pedidoId} and motivo = 'compra'`;
  if (puntos > 0 && !ya) await tx`insert into movimientos_puntos (cliente_id, pedido_id, puntos, motivo) values (${clienteId}, ${pedidoId}, ${puntos}, 'compra')`;
  const [c] = await tx<{ recomendado_por: string | null; recompensa: Date | null }[]>`
    select recomendado_por, recompensa_recomendado_en recompensa from clientes where id = ${clienteId} for update`;
  if (c?.recomendado_por && !c.recompensa && montoPagado >= (p.compra_minima_recomendado ?? 0)) {
    await tx`insert into movimientos_puntos (cliente_id, pedido_id, puntos, motivo, nota) values
             (${clienteId}, ${pedidoId}, ${p.puntos_recomendado}, 'bienvenida', 'Primera compra como recomendado'),
             (${c.recomendado_por}, ${pedidoId}, ${p.puntos_recomienda}, 'recomendado', 'Su recomendado hizo su primera compra')`;
    await tx`update clientes set recompensa_recomendado_en = now() where id = ${clienteId}`;
  }
  return puntos;
}
