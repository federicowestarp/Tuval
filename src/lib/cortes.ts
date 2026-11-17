import { sql } from "@/lib/db";

export type Corte = {
  id: string; abierta_en: Date; cerrada_en: Date | null; abrio: string; cerro: string | null; fondo: number;
  tickets: number; ventas: number; efectivo: number; tarjeta: number; transferencia: number; credito: number;
  esperado: number; contado: number | null; notas: string | null;
};

/** Cortes de caja con sus totales por forma de pago. Esperado = fondo + efectivo cobrado. */
export async function listarCortes(opciones: { id?: string; limite?: number } = {}): Promise<Corte[]> {
  return sql<Corte[]>`
    select c.id, c.abierta_en, c.cerrada_en, ua.nombre abrio, uc.nombre cerro, c.fondo::float fondo,
           count(g.id)::int tickets, coalesce(sum(g.monto), 0)::float ventas,
           coalesce(sum(g.monto) filter (where g.forma = 'efectivo'), 0)::float efectivo,
           coalesce(sum(g.monto) filter (where g.forma = 'tarjeta'), 0)::float tarjeta,
           coalesce(sum(g.monto) filter (where g.forma = 'transferencia'), 0)::float transferencia,
           coalesce(sum(g.monto) filter (where g.forma = 'credito'), 0)::float credito,
           (c.fondo + coalesce(sum(g.monto) filter (where g.forma = 'efectivo'), 0))::float esperado,
           c.efectivo_contado::float contado, c.notas
    from cajas c
    join usuarios_internos ua on ua.id = c.abierta_por
    left join usuarios_internos uc on uc.id = c.cerrada_por
    left join pagos g on g.caja_id = c.id
    where ${opciones.id ? sql`c.id = ${opciones.id}` : sql`true`}
    group by c.id, ua.nombre, uc.nombre
    order by c.abierta_en desc
    limit ${opciones.limite ?? 90}`;
}

export const fechaHora = (d: Date | null) =>
  d ? new Date(d).toLocaleString("es-MX", { timeZone: "America/Mexico_City", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
