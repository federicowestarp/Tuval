import { headers } from "next/headers";
import type postgres from "postgres";
import { sql } from "@/lib/db";
import { totalDeLineas, type LineaConteo } from "@/lib/denominaciones";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- sql o transacción
type Tx = postgres.Sql<any> | postgres.TransactionSql<any>;

export type Parametros = {
  fondo_fijo: number; tolerancia_efectivo: number; tolerancia_terminal: number; umbral_retiro: number;
  vigencia_transferencia_dias: number; horas_maximas_turno: number; minutos_retiro: number;
};

export async function parametros(tx: Tx = sql): Promise<Parametros> {
  const filas = await tx<{ clave: string; valor: number }[]>`select clave, valor::float valor from parametros_caja`;
  return Object.fromEntries(filas.map((f) => [f.clave, f.valor])) as Parametros;
}

/** Bitácora: quién, qué, cuándo y desde qué dispositivo. */
export async function bitacora(tx: Tx, usuario: string, accion: string, turno: string | null, detalle: Record<string, unknown> = {}) {
  let dispositivo: string | null = null;
  try {
    const h = await headers();
    dispositivo = [h.get("user-agent")?.slice(0, 200), h.get("x-forwarded-for")?.split(",")[0]].filter(Boolean).join(" · ") || null;
  } catch { /* fuera de una petición */ }
  await tx`insert into bitacora_caja (usuario_id, accion, turno_id, detalle, dispositivo) values (${usuario}, ${accion}, ${turno}, ${tx.json(detalle as never)}, ${dispositivo})`;
}

export async function guardarConteo(tx: Tx, turno: string, tipo: string, usuario: string, lineas: LineaConteo[], corrigeA: string | null = null) {
  const total = totalDeLineas(lineas);
  const [c] = await tx<{ id: string }[]>`
    insert into conteos_caja (turno_id, tipo, usuario_id, lineas, total, corrige_a)
    values (${turno}, ${tipo}, ${usuario}, ${tx.json(lineas as never)}, ${total}, ${corrigeA}) returning id`;
  return { id: c.id, total };
}

export type TurnoActual = { id: string; registradora_id: string; caja: string; estado: string; abierta_en: Date; cajero: string; cajero_id: string };

/** Turno vigente (no cerrado) de una caja registradora. */
export async function turnoDeCaja(registradora: string, tx: Tx = sql): Promise<TurnoActual | null> {
  const [t] = await tx<TurnoActual[]>`
    select c.id, c.registradora_id, r.nombre caja, c.estado, c.abierta_en, u.nombre cajero, u.id cajero_id
    from cajas c join cajas_registradoras r on r.id = c.registradora_id join usuarios_internos u on u.id = c.abierta_por
    where c.registradora_id = ${registradora} and c.cerrada_en is null order by c.abierta_en desc limit 1`;
  return t ?? null;
}

/** Efectivo de VENTAS que debería estar en caja (sin fondo, ya restados los retiros). Solo para servidor/supervisor. */
export async function efectivoVentasEnCaja(turno: string, tx: Tx = sql) {
  const [r] = await tx<{ ventas: number; retiros: number }[]>`
    select coalesce((select sum(monto) from pagos where caja_id = ${turno} and forma = 'efectivo' and estado = 'confirmado'), 0)::float ventas,
           coalesce((select sum(cc.total) from retiros_caja rc join conteos_caja cc on cc.id = rc.conteo_id where rc.turno_id = ${turno}), 0)::float retiros`;
  return { ventas: r.ventas, retiros: r.retiros, enCaja: Math.round((r.ventas - r.retiros) * 100) / 100 };
}

export type Conciliacion = {
  fondo_apertura: number; ventas_efectivo: number; retiros: number; esperado: number; contado: number | null; diferencia: number | null;
  terminales: { terminal_id: string; nombre: string; ventas: number; transacciones: number; lote: number | null; lote_transacciones: number | null; diferencia: number | null; foto_id: string | null }[];
  transferencias: { confirmadas: number; pendientes: number; monto_confirmado: number; monto_pendiente: number };
};

/** Conciliación del turno, por separado: efectivo, cada terminal y transferencias. */
export async function conciliacion(turno: string, tx: Tx = sql): Promise<Conciliacion> {
  const [base] = await tx<{ fondo: number; contado: number | null }[]>`
    select coalesce((select total from conteos_caja where turno_id = ${turno} and tipo in ('apertura', 'recepcion_cambio_turno') order by creado_en desc limit 1), c.fondo)::float fondo,
           (select total from conteos_caja where turno_id = ${turno} and tipo = 'cierre' order by creado_en desc limit 1)::float contado
    from cajas c where c.id = ${turno}`;
  const ef = await efectivoVentasEnCaja(turno, tx);
  const esperado = Math.round((base.fondo + ef.ventas - ef.retiros) * 100) / 100;
  const terminales = await tx<Conciliacion["terminales"]>`
    with t as (
      select tr.id, tr.nombre from terminales tr
      where tr.id in (select terminal_id from caja_terminales where registradora_id = (select registradora_id from cajas where id = ${turno}))
         or tr.id in (select terminal_id from pagos where caja_id = ${turno} and terminal_id is not null)
    )
    select t.id terminal_id, t.nombre,
           coalesce((select sum(monto) from pagos where caja_id = ${turno} and terminal_id = t.id and estado = 'confirmado'), 0)::float ventas,
           (select count(*)::int from pagos where caja_id = ${turno} and terminal_id = t.id and estado = 'confirmado') transacciones,
           ct.total::float lote, ct.transacciones lote_transacciones,
           case when ct.id is null then null else (ct.total - coalesce((select sum(monto) from pagos where caja_id = ${turno} and terminal_id = t.id and estado = 'confirmado'), 0))::float end diferencia,
           ct.foto_id
    from t left join lateral (select * from cierres_terminal where turno_id = ${turno} and terminal_id = t.id order by creado_en desc limit 1) ct on true
    order by t.nombre`;
  const [tr] = await tx<Conciliacion["transferencias"][]>`
    select count(*) filter (where estado = 'confirmado')::int confirmadas, count(*) filter (where estado = 'pendiente')::int pendientes,
           coalesce(sum(monto) filter (where estado = 'confirmado'), 0)::float monto_confirmado,
           coalesce(sum(monto) filter (where estado = 'pendiente'), 0)::float monto_pendiente
    from pagos where caja_id = ${turno} and forma = 'transferencia'`;
  return {
    fondo_apertura: base.fondo, ventas_efectivo: ef.ventas, retiros: ef.retiros, esperado, contado: base.contado,
    diferencia: base.contado == null ? null : Math.round((base.contado - esperado) * 100) / 100,
    terminales, transferencias: tr,
  };
}

/** Al confirmar el cierre: calcula diferencias, decide conciliado / con_incidente y crea incidentes. */
export async function conciliarYCerrar(tx: Tx, turno: string, usuario: string) {
  const p = await parametros(tx);
  const c = await conciliacion(turno, tx);
  const fueraEf = c.diferencia != null && Math.abs(c.diferencia) > p.tolerancia_efectivo;
  const fueraTerm = c.terminales.filter((t) => t.diferencia != null && (Math.abs(t.diferencia) > p.tolerancia_terminal || t.lote_transacciones !== t.transacciones));
  // Patrón: sobrante en efectivo + faltante en terminal (o al revés) → posible método mal registrado.
  const cruzado = c.diferencia != null && fueraTerm.some((t) => (t.diferencia ?? 0) * (c.diferencia ?? 0) < 0);
  if (!fueraEf && c.diferencia) {
    await tx`insert into incidentes_caja (turno_id, tipo, monto, detalle, responsable_id, dentro_tolerancia)
             values (${turno}, 'diferencia_efectivo', ${c.diferencia}, ${`Dentro de tolerancia. Esperado ${c.esperado}, contado ${c.contado}`}, ${usuario}, true)`;
  }
  if (fueraEf) {
    await tx`insert into incidentes_caja (turno_id, tipo, monto, detalle, posible_metodo_mal_registrado, responsable_id)
             values (${turno}, 'diferencia_efectivo', ${c.diferencia}, ${`Esperado ${c.esperado}, contado ${c.contado}`}, ${cruzado}, ${usuario})`;
  }
  for (const t of fueraTerm) {
    await tx`insert into incidentes_caja (turno_id, tipo, monto, detalle, posible_metodo_mal_registrado, responsable_id)
             values (${turno}, 'diferencia_terminal', ${t.diferencia}, ${`${t.nombre}: ventas ${t.ventas} en ${t.transacciones} cobros; lote ${t.lote} en ${t.lote_transacciones}`}, ${cruzado}, ${usuario})`;
  }
  const estado = fueraEf || fueraTerm.length ? "con_incidente" : "conciliado";
  await tx`update cajas set estado = ${estado}, cerrada_en = now(), cerrada_por = ${usuario}, efectivo_contado = ${c.contado} where id = ${turno}`;
  return estado;
}
