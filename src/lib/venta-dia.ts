import { sql } from "@/lib/db";

export type VentaDelDia = {
  total: number;
  porTipo: { tipo: string; monto: number; cobros: number }[];
  pendienteTransferencia: number;
  enLinea: number;
};

/** Venta del día (hora de México) con su desglose por tipo de cobro. Solo para Admin y Supervisor. */
export async function ventaDelDia(): Promise<VentaDelDia> {
  const hoy = sql`(date_trunc('day', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City')`;
  const [porTipo, [extra]] = await Promise.all([
    sql<{ tipo: string; monto: number; cobros: number }[]>`
      select case when g.forma = 'efectivo' then 'Efectivo'
                  when g.forma = 'tarjeta' then 'Tarjeta · ' || coalesce(t.nombre, 'sin terminal')
                  when g.forma = 'transferencia' then 'Transferencia confirmada'
                  when g.forma = 'credito' then 'Crédito'
                  else initcap(g.forma) end tipo,
             sum(g.monto)::float monto, count(*)::int cobros
      from pagos g join pedidos p on p.id = g.pedido_id left join terminales t on t.id = g.terminal_id
      where g.pagado_en >= ${hoy} and g.estado = 'confirmado' and p.canal = 'mostrador'
      group by 1 order by 2 desc`,
    sql<{ pendiente: number; en_linea: number }[]>`
      select coalesce((select sum(monto) from pagos where estado = 'pendiente' and pagado_en >= ${hoy}), 0)::float pendiente,
             coalesce((select sum(g.monto) from pagos g join pedidos p on p.id = g.pedido_id
                       where g.pagado_en >= ${hoy} and g.estado = 'confirmado' and p.canal <> 'mostrador'), 0)::float en_linea`,
  ]);
  const total = porTipo.reduce((a, x) => a + x.monto, 0) + extra.en_linea;
  return { total, porTipo: extra.en_linea ? [...porTipo, { tipo: "Pedidos en línea (cobrado)", monto: extra.en_linea, cobros: 0 }] : porTipo, pendienteTransferencia: extra.pendiente, enLinea: extra.en_linea };
}
