import { sql } from "@/lib/db";

/**
 * Plazos de seguimiento (recomendación; cambiar aquí cambia todo el sistema).
 * - Recordar al cliente que no ha aceptado: a las 24 h y otra vez a las 72 h.
 * - La cotización al cliente vence a los 7 días.
 * - Antes de comprar, reconfirmar existencia y precio con el proveedor si su cotización tiene más de 48 h.
 * - Archivo (solo vista, nada se borra): cotizaciones no aceptadas y pedidos cerrados, a los 30 días.
 */
export const PLAZOS = {
  recordatorioHoras: 24,
  segundoRecordatorioHoras: 72,
  venceDias: 7,
  reconfirmarHoras: 48,
  archivarCotizacionDias: 30,
  archivarCerradoDias: 30,
} as const;

/** Momento desde el que cuenta la frescura de existencias/precio del proveedor. */
export const frescuraProveedor = sql`greatest(
  (select max(c.cargada_en) from cotizaciones_proveedor c where c.pedido_id = p.id), p.reconfirmado_en)`;

/** Condición SQL: el pedido está archivado (por antigüedad). */
export const archivado = sql`(
  (p.estado in ('entregado', 'entregado_con_faltantes', 'cancelado')
    and coalesce((select max(e.creado_en) from pedido_eventos e where e.pedido_id = p.id), p.creado_en)
        < now() - make_interval(days => ${PLAZOS.archivarCerradoDias}))
  or (p.estado = 'recibido' and p.aceptado_en is null and p.creado_en < now() - make_interval(days => ${PLAZOS.archivarCotizacionDias}))
)`;

export type Pendiente = { id: string; folio: string; contacto_nombre: string | null; contacto_telefono: string | null; total: number; horas: number; recordatorios: number };

/** Lo que el operador tiene que hacer hoy para que ninguna cotización se quede olvidada. */
export async function pendientesSeguimiento() {
  const [porRecordar, vencidas, reconfirmar] = await Promise.all([
    sql<Pendiente[]>`
      select p.id, p.folio, p.contacto_nombre, p.contacto_telefono, p.total::float total, p.recordatorios,
             round((extract(epoch from now() - p.confirmado_en) / 3600)::numeric)::float horas
      from pedidos p
      where p.canal <> 'mostrador' and p.estado = 'recibido' and p.confirmado_en is not null and p.aceptado_en is null
        and p.confirmado_en > now() - make_interval(days => ${PLAZOS.venceDias})
        and ((p.recordatorios = 0 and p.confirmado_en < now() - make_interval(hours => ${PLAZOS.recordatorioHoras}))
          or (p.recordatorios = 1 and p.confirmado_en < now() - make_interval(hours => ${PLAZOS.segundoRecordatorioHoras})))
      order by p.confirmado_en`,
    sql<Pendiente[]>`
      select p.id, p.folio, p.contacto_nombre, p.contacto_telefono, p.total::float total, p.recordatorios,
             round((extract(epoch from now() - p.confirmado_en) / 3600)::numeric)::float horas
      from pedidos p
      where p.canal <> 'mostrador' and p.estado = 'recibido' and p.confirmado_en is not null and p.aceptado_en is null
        and p.confirmado_en <= now() - make_interval(days => ${PLAZOS.venceDias}) and not ${archivado}
      order by p.confirmado_en`,
    sql<Pendiente[]>`
      select p.id, p.folio, p.contacto_nombre, p.contacto_telefono, p.total::float total, p.recordatorios,
             round((extract(epoch from now() - ${frescuraProveedor}) / 3600)::numeric)::float horas
      from pedidos p
      where p.canal <> 'mostrador' and p.estado = 'recibido' and (p.aceptado_en is not null or p.confirmado_en is null)
        and ${frescuraProveedor} < now() - make_interval(hours => ${PLAZOS.reconfirmarHoras})
        and not ${archivado}
      order by 7 desc`,
  ]);
  return { porRecordar, vencidas, reconfirmar };
}

/** Estado de vigencia de un pedido (para el detalle y el bloqueo de compra). */
export async function vigencia(pedidoId: string) {
  const [v] = await sql<{ horas_proveedor: number | null; dias_cliente: number | null }[]>`
    select round((extract(epoch from now() - ${frescuraProveedor}) / 3600)::numeric, 1)::float horas_proveedor,
           case when p.confirmado_en is not null and p.aceptado_en is null
                then round((extract(epoch from now() - p.confirmado_en) / 86400)::numeric, 1)::float end dias_cliente
    from pedidos p where p.id = ${pedidoId}`;
  return {
    horasProveedor: v?.horas_proveedor ?? null,
    reconfirmar: v?.horas_proveedor != null && v.horas_proveedor > PLAZOS.reconfirmarHoras,
    diasCliente: v?.dias_cliente ?? null,
    vencida: v?.dias_cliente != null && v.dias_cliente >= PLAZOS.venceDias,
  };
}
