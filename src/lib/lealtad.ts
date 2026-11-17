import type postgres from "postgres";
import { sql } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- sql o transacción
type Tx = postgres.Sql<any> | postgres.TransactionSql<any>;

export type ParamLealtad = { puntos_por_cada_100: number; valor_punto: number; puntos_recomienda: number; puntos_recomendado: number; compra_minima_recomendado: number; recomendados_activo: number; recomendados_max_mes: number };

export async function paramLealtad(tx: Tx = sql): Promise<ParamLealtad> {
  const f = await tx<{ clave: string; valor: number }[]>`
    select clave, valor::float valor from parametros_operacion
    where clave in ('puntos_por_cada_100', 'valor_punto', 'puntos_recomienda', 'puntos_recomendado', 'compra_minima_recomendado', 'recomendados_activo', 'recomendados_max_mes')`;
  return Object.fromEntries(f.map((x) => [x.clave, x.valor])) as ParamLealtad;
}

/**
 * Al pagarse una compra: puntos por compra (sobre lo pagado con dinero, no con puntos) y, si es la primera compra
 * de un cliente recomendado que alcanza el mínimo, puntos para él y para quien lo recomendó (una sola vez).
 */
export async function otorgarPuntos(tx: Tx, clienteId: string, pedidoId: string, montoPagado: number) {
  const p = await paramLealtad(tx);
  // Solo clientes con lista que acumula (sin lista = Público). Obra / Constructora no: ya tiene mejor precio.
  if (!(await acumula(tx, clienteId))) return 0;
  const puntos = Math.floor((montoPagado / 100) * (p.puntos_por_cada_100 ?? 0));
  const [ya] = await tx`select 1 from movimientos_puntos where pedido_id = ${pedidoId} and motivo = 'compra'`;
  if (puntos > 0 && !ya) await tx`insert into movimientos_puntos (cliente_id, pedido_id, puntos, motivo) values (${clienteId}, ${pedidoId}, ${puntos}, 'compra')`;
  const [c] = await tx<{ recomendado_por: string | null; recompensa: Date | null }[]>`
    select recomendado_por, recompensa_recomendado_en recompensa from clientes where id = ${clienteId} for update`;
  // Recomendados: solo con el programa activo y hasta el tope mensual de quien recomienda.
  const [mes] = c?.recomendado_por ? await tx<{ n: number }[]>`
    select count(*)::int n from movimientos_puntos where cliente_id = ${c.recomendado_por} and motivo = 'recomendado'
      and creado_en >= date_trunc('month', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City'` : [{ n: 0 }];
  if (c?.recomendado_por && !c.recompensa && p.recomendados_activo === 1 && (await acumula(tx, c.recomendado_por)) && mes.n < (p.recomendados_max_mes ?? 0) && montoPagado >= (p.compra_minima_recomendado ?? 0)) {
    await tx`insert into movimientos_puntos (cliente_id, pedido_id, puntos, motivo, nota) values
             (${clienteId}, ${pedidoId}, ${p.puntos_recomendado}, 'bienvenida', 'Primera compra como recomendado'),
             (${c.recomendado_por}, ${pedidoId}, ${p.puntos_recomienda}, 'recomendado', 'Su recomendado hizo su primera compra')`;
    await tx`update clientes set recompensa_recomendado_en = now() where id = ${clienteId}`;
  }
  return puntos;
}

/** ¿La lista de precios del cliente acumula puntos? Sin lista asignada cuenta como Público. */
export async function acumula(tx: Tx, clienteId: string): Promise<boolean> {
  const [r] = await tx<{ si: boolean }[]>`
    select coalesce(l.acumula_puntos, (select acumula_puntos from listas_precio where nombre = 'Público'), true) si
    from clientes c left join listas_precio l on l.id = c.lista_precio_id where c.id = ${clienteId}`;
  return r?.si ?? false;
}
