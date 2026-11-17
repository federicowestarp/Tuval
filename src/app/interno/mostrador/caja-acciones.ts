"use server";

import { sql } from "@/lib/db";
import { contrasenaValida, requerirInterno } from "@/lib/equipo";
import { guardarArchivo, TIPOS_IMAGEN } from "@/lib/archivos";
import { bitacora, conciliarYCerrar, guardarConteo, parametros } from "@/lib/caja";
import { normalizarConteo, separarFondo, totalDeLineas } from "@/lib/denominaciones";
import { refrescar } from "@/lib/refrescar";

/*
 * Acciones del CAJERO. Principio de cierre ciego: ninguna de estas funciones devuelve montos esperados,
 * ventas del turno ni diferencias; solo mensajes de estado.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type Respuesta = { error?: string; mensaje?: string; recontar?: boolean; id?: string };

export type DatosApertura = { registradora: string; lineas: unknown; confirmaSaliente?: string; reintento?: boolean };

/** El cajero saliente confirma la entrega del fondo con su PIN o su contraseña. */
async function confirmaUsuario(usuario: string, valor: string | undefined) {
  if (!valor) return false;
  const [u] = await sql<{ pin_hash: string | null; hash_contrasena: string }[]>`select pin_hash, hash_contrasena from usuarios_internos where id = ${usuario}`;
  if (!u) return false;
  return (!!u.pin_hash && (await contrasenaValida(valor, u.pin_hash))) || contrasenaValida(valor, u.hash_contrasena);
}

/**
 * Apertura. El fondo se queda en la caja (sin sobres): se compara contra lo que dejó el último cierre de esa caja
 * (o el fondo fijo si es la primera vez). Si el cierre fue hace menos de 3 h y lo hizo otra persona es un cambio de turno
 * en persona: cuentan los dos, deben coincidir exacto y el saliente confirma con su PIN.
 */
export async function abrirTurno(d: DatosApertura): Promise<Respuesta> {
  const yo = await requerirInterno("mostrador");
  if (!UUID.test(d.registradora)) return { error: "Elige la caja." };
  let lineas;
  try { lineas = normalizarConteo(d.lineas); } catch (e) { return { error: (e as Error).message }; }
  const total = totalDeLineas(lineas);
  try {
    return await sql.begin(async (tx) => {
      const [reg] = await tx<{ id: string; almacen_id: string }[]>`select id, almacen_id from cajas_registradoras where id = ${d.registradora} and activa for update`;
      if (!reg) return { error: "Caja no encontrada." };
      const [abierto] = await tx`select 1 from cajas where registradora_id = ${reg.id} and cerrada_en is null`;
      if (abierto) return { error: "Esta caja ya tiene un turno abierto." };
      const p = await parametros(tx);
      const [anterior] = await tx<{ id: string; cajero: string; fondo: number; en_persona: boolean }[]>`
        select c.id, c.cerrada_por cajero, cc.total::float fondo,
               (c.cerrada_en > now() - interval '3 hours' and c.cerrada_por <> ${yo.id}) en_persona
        from cajas c join conteos_caja cc on cc.turno_id = c.id and cc.tipo = 'fondo_siguiente'
        where c.registradora_id = ${reg.id} and c.cerrada_en is not null and not exists (select 1 from cajas n where n.recibido_de = c.id)
        order by c.cerrada_en desc limit 1`;
      const enPersona = !!anterior?.en_persona;
      if (enPersona && !(await confirmaUsuario(anterior!.cajero, d.confirmaSaliente))) {
        return { error: "El cajero que entrega debe confirmar con su PIN." };
      }
      const esperado = anterior ? anterior.fondo : p.fondo_fijo;
      const dif = Math.round((total - esperado) * 100) / 100;
      const dentro = Math.abs(dif) <= p.tolerancia_efectivo;
      if (enPersona && dif !== 0 && !d.reintento) return { recontar: true, mensaje: "Los conteos no coinciden. Vuelvan a contar juntos." };
      const bloquea = enPersona ? dif !== 0 : !dentro;
      const [turno] = await tx<{ id: string }[]>`
        insert into cajas (almacen_id, abierta_por, fondo, registradora_id, estado, recibido_de)
        values (${reg.almacen_id}, ${yo.id}, ${total}, ${reg.id}, ${bloquea ? "pendiente_autorizacion" : "abierto"}, ${anterior?.id ?? null})
        returning id`;
      const conteo = await guardarConteo(tx, turno.id, anterior ? "recepcion_cambio_turno" : "apertura", yo.id, lineas);
      if (dif !== 0) {
        // Aunque esté dentro de tolerancia se avisa al supervisor; solo bloquea si la rebasa.
        await tx`insert into incidentes_caja (turno_id, tipo, monto, detalle, responsable_id, dentro_tolerancia)
                 values (${turno.id}, ${enPersona ? "diferencia_cambio_turno" : "diferencia_apertura"}, ${dif},
                         ${`Fondo que dejó el cierre anterior ${esperado}, contado al abrir ${total}`}, ${anterior?.cajero ?? yo.id}, ${!bloquea})`;
      }
      await bitacora(tx, yo.id, "apertura", turno.id, { conteo: conteo.id, recibe_de: anterior?.id ?? null, en_persona: enPersona });
      return bloquea
        ? { mensaje: "Apertura pendiente de autorización del supervisor", id: turno.id }
        : { mensaje: "Apertura registrada", id: turno.id };
    });
  } catch (e) {
    return { error: (e as Error).message };
  } finally {
    refrescar("/interno/mostrador");
    refrescar("/interno/caja");
  }
}

/** ¿Se requiere retiro parcial? Al cajero solo se le dice sí/no, nunca el monto. */
export async function retiroParcial(lineasEntrada: unknown): Promise<Respuesta> {
  const yo = await requerirInterno("mostrador");
  let lineas;
  try { lineas = normalizarConteo(lineasEntrada); } catch (e) { return { error: (e as Error).message }; }
  if (totalDeLineas(lineas) <= 0) return { error: "Cuenta el efectivo que retiras." };
  try {
    return await sql.begin(async (tx) => {
      const [t] = await tx<{ id: string }[]>`select id from cajas where abierta_por = ${yo.id} and cerrada_en is null and estado = 'abierto' order by abierta_en desc limit 1 for update`;
      if (!t) return { error: "No tienes un turno abierto." };
      const conteo = await guardarConteo(tx, t.id, "retiro", yo.id, lineas);
      const [r] = await tx<{ id: string }[]>`
        insert into retiros_caja (folio, turno_id, conteo_id, cajero_id)
        values ('RT-' || lpad(nextval('folio_retiro_seq')::text, 6, '0'), ${t.id}, ${conteo.id}, ${yo.id}) returning id`;
      await bitacora(tx, yo.id, "retiro_parcial", t.id, { retiro: r.id, conteo: conteo.id });
      return { mensaje: "Retiro registrado. Imprime el recibo y mételo al sobre con el efectivo.", id: r.id };
    });
  } catch (e) {
    return { error: (e as Error).message };
  } finally {
    refrescar("/interno/mostrador");
    refrescar("/interno/caja");
  }
}

/**
 * Cierre ciego. El fondo de cambio se queda en la caja; lo demás se retira con el ticket de corte firmado.
 * FormData: datos (JSON con lineas y terminales[{terminal_id,total,transacciones}]) y foto por terminal NO conectada
 * en `foto_<terminal_id>`. Al cajero solo se le responde "Cierre registrado".
 */
export async function cerrarTurno(fd: FormData): Promise<Respuesta> {
  const yo = await requerirInterno("mostrador");
  let datos: { lineas: unknown; terminales: { terminal_id: string; total: number; transacciones: number }[] };
  try { datos = JSON.parse(String(fd.get("datos"))); } catch { return { error: "Datos de cierre inválidos." }; }
  let lineas;
  try { lineas = normalizarConteo(datos.lineas); } catch (e) { return { error: (e as Error).message }; }

  const [t] = await sql<{ id: string; registradora_id: string }[]>`
    select id, registradora_id from cajas where abierta_por = ${yo.id} and cerrada_en is null order by abierta_en desc limit 1`;
  if (!t) return { error: "No tienes un turno abierto." };
  // Las terminales conectadas a la app no piden cierre de lote: sus cobros ya llegan solos.
  const asignadas = await sql<{ id: string; nombre: string }[]>`
    select tr.id, tr.nombre from caja_terminales ct join terminales tr on tr.id = ct.terminal_id
    where ct.registradora_id = ${t.registradora_id} and tr.activa and not tr.integrada`;
  const capturas: { terminal_id: string; total: number; transacciones: number; foto: string }[] = [];
  for (const term of asignadas) {
    const c = (datos.terminales ?? []).find((x) => x.terminal_id === term.id);
    const total = Number(c?.total), trans = Number(c?.transacciones);
    if (!c || !(total >= 0) || !Number.isInteger(trans) || trans < 0) return { error: `Captura el cierre de lote de ${term.nombre} (total y número de transacciones).` };
    let foto: string | null;
    try { foto = await guardarArchivo(fd.get(`foto_${term.id}`), TIPOS_IMAGEN); } catch (e) { return { error: (e as Error).message }; }
    if (!foto) return { error: `Falta la foto del ticket de cierre de ${term.nombre}.` };
    capturas.push({ terminal_id: term.id, total, transacciones: trans, foto });
  }

  try {
    return await sql.begin(async (tx) => {
      const p = await parametros(tx);
      const cierre = await guardarConteo(tx, t.id, "cierre", yo.id, lineas);
      const { fondo } = separarFondo(lineas, p.fondo_fijo);
      const fondoConteo = await guardarConteo(tx, t.id, "fondo_siguiente", yo.id, fondo);
      for (const c of capturas) {
        await tx`insert into cierres_terminal (turno_id, terminal_id, total, transacciones, foto_id, usuario_id)
                 values (${t.id}, ${c.terminal_id}, ${c.total}, ${c.transacciones}, ${c.foto}, ${yo.id})`;
      }
      await conciliarYCerrar(tx, t.id, yo.id);
      await bitacora(tx, yo.id, "cierre", t.id, { conteo: cierre.id, fondo: fondoConteo.id, terminales: capturas.length });
      return { mensaje: "Cierre registrado", id: t.id };
    });
  } catch (e) {
    return { error: (e as Error).message };
  } finally {
    refrescar("/interno/mostrador");
    refrescar("/interno/caja");
  }
}
