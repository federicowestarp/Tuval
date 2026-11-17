"use server";

import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { bitacora, guardarConteo } from "@/lib/caja";
import { mover } from "@/lib/inventario";
import { normalizarConteo } from "@/lib/denominaciones";
import { refrescar } from "@/lib/refrescar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const t = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const listo = () => { refrescar("/interno/caja"); refrescar("/interno/mostrador"); };

export async function autorizarApertura(fd: FormData) {
  const yo = await requerirInterno("supervisor");
  const id = t(fd, "turno");
  if (!UUID.test(id)) return;
  await sql.begin(async (tx) => {
    const [r] = await tx`update cajas set estado = 'abierto', autorizada_por = ${yo.id}, autorizada_en = now()
                         where id = ${id} and estado = 'pendiente_autorizacion' returning id`;
    if (r) await bitacora(tx, yo.id, "autoriza_apertura", id, { nota: t(fd, "nota") || null });
  });
  listo();
}

const RESOLUCIONES = ["error_captura", "faltante_responsable", "sobrante_cuenta", "sello_roto_custodia", "autorizado"];

export async function resolverIncidente(fd: FormData) {
  const yo = await requerirInterno("supervisor");
  const id = t(fd, "id"), res = t(fd, "resolucion"), nota = t(fd, "nota");
  if (!UUID.test(id) || !RESOLUCIONES.includes(res) || nota.length < 3) return;
  const responsable = t(fd, "responsable");
  await sql.begin(async (tx) => {
    const [i] = await tx<{ turno_id: string | null }[]>`
      update incidentes_caja set estado = 'resuelto', resolucion = ${res}, nota_resolucion = ${nota.slice(0, 500)}, resuelto_por = ${yo.id}, resuelto_en = now(),
        responsable_id = coalesce(${UUID.test(responsable) ? responsable : null}::uuid, responsable_id)
      where id = ${id} and estado = 'abierto' returning turno_id`;
    if (!i) return;
    // Turno con todos sus incidentes resueltos → conciliado.
    if (i.turno_id) await tx`update cajas set estado = 'conciliado' where id = ${i.turno_id} and estado = 'con_incidente'
                              and not exists (select 1 from incidentes_caja where turno_id = ${i.turno_id} and estado = 'abierto')`;
    await bitacora(tx, yo.id, "resuelve_incidente", i.turno_id, { incidente: id, resolucion: res });
  });
  listo();
}

/** Quien abre la caja fuerte recuenta cada sobre de retiro contra su recibo. */
export async function recontarRetiro(retiro: string, lineasEntrada: unknown): Promise<{ error?: string; mensaje?: string }> {
  const yo = await requerirInterno("supervisor");
  if (!UUID.test(retiro)) return { error: "Retiro no válido." };
  let lineas;
  try { lineas = normalizarConteo(lineasEntrada); } catch (e) { return { error: (e as Error).message }; }
  try {
    return await sql.begin(async (tx) => {
      const [r] = await tx<{ turno_id: string; conteo_id: string; total: number; cajero_id: string; folio: string }[]>`
        select rc.turno_id, rc.conteo_id, cc.total::float total, rc.cajero_id, rc.folio from retiros_caja rc join conteos_caja cc on cc.id = rc.conteo_id
        where rc.id = ${retiro} and not exists (select 1 from conteos_caja x where x.corrige_a = rc.conteo_id and x.tipo = 'recuento_retiro')`;
      if (!r) return { error: "Ese retiro ya fue recontado." };
      const rec = await guardarConteo(tx, r.turno_id, "recuento_retiro", yo.id, lineas, r.conteo_id);
      const dif = Math.round((rec.total - r.total) * 100) / 100;
      if (dif !== 0) await tx`insert into incidentes_caja (turno_id, tipo, monto, detalle, responsable_id)
                              values (${r.turno_id}, 'diferencia_retiro', ${dif}, ${`${r.folio}: recibo ${r.total}, recontado ${rec.total}`}, ${r.cajero_id})`;
      await bitacora(tx, yo.id, "recuenta_retiro", r.turno_id, { retiro, diferencia: dif });
      return { mensaje: dif === 0 ? `${r.folio} cuadra.` : `${r.folio}: diferencia de ${dif}. Se creó incidente.` };
    });
  } catch (e) {
    return { error: (e as Error).message };
  } finally { listo(); }
}

/**
 * Excepción: el cliente transfirió directo a la cuenta (sin referencia del proveedor). Solo supervisor, con clave de rastreo,
 * banco emisor y monto validados en el CEP de Banxico. Queda como incidente "transferencia_manual" para auditoría.
 */
export async function confirmarTransferencia(fd: FormData): Promise<void> {
  const yo = await requerirInterno("supervisor");
  const pago = t(fd, "pago"), clave = t(fd, "clave"), banco = t(fd, "banco");
  const monto = Number(t(fd, "monto").replace(/[$,\s]/g, ""));
  if (!UUID.test(pago) || clave.length < 6 || banco.length < 2 || !(monto > 0) || fd.get("cep") !== "on") return;
  await sql.begin(async (tx) => {
    const [g] = await tx<{ pedido_id: string; monto: number; caja_id: string | null }[]>`
      select pedido_id, monto::float monto, caja_id from pagos where id = ${pago} and estado = 'pendiente' for update`;
    if (!g) return;
    if (Math.abs(g.monto - monto) >= 0.01) {
      // Monto distinto: no se libera; queda para revisión.
      await tx`insert into incidentes_caja (turno_id, tipo, monto, detalle, responsable_id)
               values (${g.caja_id}, 'transferencia_manual', ${monto - g.monto}, ${`Monto distinto: esperado ${g.monto}, recibido ${monto}. Clave ${clave}, ${banco}`}, ${yo.id})`;
      await bitacora(tx, yo.id, "transferencia_monto_distinto", g.caja_id, { pago, monto });
      return;
    }
    await tx`update pagos set estado = 'confirmado', clave_rastreo = ${clave.slice(0, 40)}, banco_emisor = ${banco.slice(0, 60)},
             confirmado_por = ${yo.id}, confirmado_en = now() where id = ${pago}`;
    await tx`insert into incidentes_caja (turno_id, tipo, monto, detalle, estado, resolucion, nota_resolucion, resuelto_por, resuelto_en, responsable_id)
             values (${g.caja_id}, 'transferencia_manual', ${monto}, ${`Clave de rastreo ${clave} · ${banco}`}, 'resuelto', 'autorizado', 'Validada en CEP Banxico', ${yo.id}, now(), ${yo.id})`;
    // Ya pagada: se entrega y se descuenta inventario.
    const [p] = await tx<{ folio: string; almacen: string }[]>`update pedidos set estado = 'entregado' where id = ${g.pedido_id} and estado = 'recibido' returning folio, almacen_surtido almacen`;
    if (p) {
      const partidas = await tx<{ producto_id: string; cantidad: number; costo: number | null }[]>`
        select producto_id, cantidad::float cantidad, costo_unitario::float costo from pedido_partidas where pedido_id = ${g.pedido_id}`;
      for (const x of partidas) await mover(tx, { producto: x.producto_id, cantidad: x.cantidad, tipo: "salida_venta", origen: p.almacen, costo: x.costo, referencia: p.folio, pedido: g.pedido_id, usuario: yo.id });
      await tx`update pedido_partidas set cantidad_surtida = cantidad where pedido_id = ${g.pedido_id}`;
      await tx`insert into pedido_eventos (pedido_id, estado, nota, usuario_id) values (${g.pedido_id}, 'entregado', 'Transferencia confirmada por supervisor (CEP)', ${yo.id})`;
    }
    await bitacora(tx, yo.id, "confirma_transferencia_manual", g.caja_id, { pago, clave });
  });
  listo();
}

/** Transferencias vencidas sin pago → expiradas y la venta se cancela. */
export async function expirarTransferencias() {
  await sql`
    with v as (update pagos set estado = 'expirado' where estado = 'pendiente' and vence_en < now() returning pedido_id)
    update pedidos set estado = 'cancelado', motivo_cancelacion = 'Transferencia no recibida'
    where id in (select pedido_id from v) and estado = 'recibido'`;
}

// ───────── Configuración (solo Admin) ─────────

export async function guardarParametro(fd: FormData) {
  const yo = await requerirInterno("admin");
  const clave = t(fd, "clave"), valor = Number(t(fd, "valor"));
  if (!/^[a-z_]{3,40}$/.test(clave) || !(valor >= 0)) return;
  await sql.begin(async (tx) => {
    const [antes] = await tx<{ valor: number }[]>`select valor::float valor from parametros_caja where clave = ${clave}`;
    if (!antes) return;
    await tx`update parametros_caja set valor = ${valor}, actualizado_por = ${yo.id}, actualizado_en = now() where clave = ${clave}`;
    await bitacora(tx, yo.id, "cambia_parametro", null, { clave, antes: antes.valor, despues: valor });
  });
  refrescar("/interno/caja/configuracion");
}

export async function crearCaja(fd: FormData) {
  const yo = await requerirInterno("admin");
  const nombre = t(fd, "nombre");
  if (nombre.length < 2) return;
  await sql.begin(async (tx) => {
    await tx`insert into cajas_registradoras (almacen_id, nombre) select id, ${nombre.slice(0, 60)} from almacenes where tipo = 'sucursal' and activo order by creado_en limit 1`;
    await bitacora(tx, yo.id, "crea_caja", null, { nombre });
  });
  refrescar("/interno/caja/configuracion");
}

export async function crearTerminal(fd: FormData) {
  const yo = await requerirInterno("admin");
  const nombre = t(fd, "nombre"), caja = t(fd, "caja");
  if (nombre.length < 2) return;
  await sql.begin(async (tx) => {
    const [term] = await tx<{ id: string }[]>`insert into terminales (nombre, proveedor) values (${nombre.slice(0, 60)}, ${t(fd, "proveedor") || null}) returning id`;
    if (UUID.test(caja)) await tx`insert into caja_terminales (registradora_id, terminal_id) values (${caja}, ${term.id}) on conflict do nothing`;
    await bitacora(tx, yo.id, "crea_terminal", null, { nombre, caja: caja || null });
  });
  refrescar("/interno/caja/configuracion");
}

export async function asignarTerminal(fd: FormData) {
  const yo = await requerirInterno("admin");
  const caja = t(fd, "caja"), term = t(fd, "terminal"), quitar = fd.get("quitar") === "1";
  if (!UUID.test(caja) || !UUID.test(term)) return;
  await sql.begin(async (tx) => {
    if (quitar) await tx`delete from caja_terminales where registradora_id = ${caja} and terminal_id = ${term}`;
    else await tx`insert into caja_terminales (registradora_id, terminal_id) values (${caja}, ${term}) on conflict do nothing`;
    await bitacora(tx, yo.id, quitar ? "quita_terminal" : "asigna_terminal", null, { caja, terminal: term });
  });
  refrescar("/interno/caja/configuracion");
}
