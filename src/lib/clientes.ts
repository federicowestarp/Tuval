import { randomBytes } from "node:crypto";
import type postgres from "postgres";
import { sql } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- sql o transacción
type Tx = postgres.Sql<any> | postgres.TransactionSql<any>;

/** Código para recomendar (TUV-XXXXX), único y fácil de dictar (sin 0/O ni 1/I). */
export function nuevoCodigoRecomendado() {
  const abc = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  return "TUV-" + Array.from(randomBytes(5), (b) => abc[b % abc.length]).join("");
}

export type EstadoCuenta = {
  limite: number | null; dias: number | null; activo: boolean;
  saldo: number; vencido: number; disponible: number | null;
  cargos: { id: string; folio: string; fecha: string; total: number; pagado: number; saldo: number; vence: string | null; vencido: boolean }[];
};

/** Crédito: cargos = pedidos a crédito confirmados (no cancelados); abonos = pagos confirmados de esos pedidos. */
export async function estadoCuenta(clienteId: string, tx: Tx = sql): Promise<EstadoCuenta> {
  const [c] = await tx<{ limite: number | null; dias: number | null; activo: boolean }[]>`
    select limite_credito::float limite, dias_credito dias, credito_activo activo from clientes where id = ${clienteId}`;
  const cargos = await tx<EstadoCuenta["cargos"]>`
    select p.id, p.folio, to_char(coalesce(p.aprobado_en, p.confirmado_en, p.creado_en) at time zone 'America/Mexico_City', 'YYYY-MM-DD') fecha,
           p.total::float total,
           coalesce((select sum(monto) from pagos g where g.pedido_id = p.id and g.estado = 'confirmado'), 0)::float pagado,
           (p.total - coalesce((select sum(monto) from pagos g where g.pedido_id = p.id and g.estado = 'confirmado'), 0))::float saldo,
           to_char((coalesce(p.aprobado_en, p.confirmado_en, p.creado_en) + make_interval(days => coalesce(${c?.dias ?? 0}, 0))) at time zone 'America/Mexico_City', 'YYYY-MM-DD') vence,
           (coalesce(p.aprobado_en, p.confirmado_en, p.creado_en) + make_interval(days => coalesce(${c?.dias ?? 0}, 0)) < now()) vencido
    from pedidos p where p.cliente_id = ${clienteId} and p.a_credito and p.estado <> 'cancelado'
    order by p.creado_en desc`;
  const pendientes = cargos.filter((x) => x.saldo > 0.009);
  const saldo = Math.round(pendientes.reduce((a, x) => a + x.saldo, 0) * 100) / 100;
  const vencido = Math.round(pendientes.filter((x) => x.vencido).reduce((a, x) => a + x.saldo, 0) * 100) / 100;
  return {
    limite: c?.limite ?? null, dias: c?.dias ?? null, activo: !!c?.activo, saldo, vencido,
    disponible: c?.limite != null ? Math.round((c.limite - saldo) * 100) / 100 : null,
    cargos: pendientes,
  };
}

/** ¿Cabe este monto a crédito? Activo, sin saldo vencido y dentro del límite. */
export async function puedeCredito(clienteId: string, monto: number, tx: Tx = sql): Promise<{ ok: boolean; motivo?: string }> {
  const e = await estadoCuenta(clienteId, tx);
  if (!e.activo || e.limite == null) return { ok: false, motivo: "El cliente no tiene crédito autorizado." };
  if (e.vencido > 0) return { ok: false, motivo: `Tiene saldo vencido de $${e.vencido.toFixed(2)}.` };
  if (e.saldo + monto > e.limite + 0.009) return { ok: false, motivo: `Rebasa su límite: disponible $${Math.max(0, e.limite - e.saldo).toFixed(2)}.` };
  return { ok: true };
}

export async function puntosDe(clienteId: string, tx: Tx = sql) {
  const [r] = await tx<{ puntos: number }[]>`select coalesce(sum(puntos), 0)::int puntos from movimientos_puntos where cliente_id = ${clienteId}`;
  return r.puntos;
}

export type ClienteLista = { id: string; nombre: string; razon_social: string | null; rfc: string | null; telefono: string | null; lista: string | null; codigo_recomendado: string | null };

/** Búsqueda por nombre, razón social, teléfono o RFC (para mostrador y panel). */
export async function buscarClientes(q: string, limite = 10): Promise<ClienteLista[]> {
  const t = q.trim();
  if (t.length < 2) return [];
  const tel = t.replace(/\D/g, "");
  return sql<ClienteLista[]>`
    select c.id, c.nombre, c.razon_social, c.rfc, c.telefono, l.nombre lista, c.codigo_recomendado
    from clientes c left join listas_precio l on l.id = c.lista_precio_id
    where c.activo and (unaccent(lower(c.nombre || ' ' || coalesce(c.razon_social, ''))) like unaccent(lower(${"%" + t + "%"}))
      or upper(coalesce(c.rfc, '')) = upper(${t}) ${tel.length >= 7 ? sql`or regexp_replace(coalesce(c.telefono, ''), '\\D', '', 'g') like ${"%" + tel.slice(-10)}` : sql``})
    order by c.nombre limit ${limite}`;
}
