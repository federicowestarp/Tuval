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

export type DatosApertura = { registradora: string; lineas: unknown; selloIntegro?: boolean; folioSello?: string; contrasenaSaliente?: string; reintento?: boolean };

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

      // ¿Qué se esperaba recibir? 1) sobre sellado del cierre de día, 2) fondo del turno anterior (cambio de turno), 3) fondo fijo.
      const [sobre] = await tx<{ id: string; folio_sello: string; monto: number }[]>`
        select id, folio_sello, monto::float monto from sobres_fondo where registradora_id = ${reg.id} and turno_apertura_id is null order by creado_en desc limit 1`;
      const [anterior] = sobre ? [] : await tx<{ id: string; cajero: string; hash: string; fondo: number }[]>`
        select c.id, c.cerrada_por cajero, u.hash_contrasena hash, cc.total::float fondo
        from cajas c join conteos_caja cc on cc.turno_id = c.id and cc.tipo = 'fondo_siguiente' join usuarios_internos u on u.id = c.cerrada_por
        where c.registradora_id = ${reg.id} and c.cerrada_en is not null and not c.cierre_de_dia
          and not exists (select 1 from cajas n where n.recibido_de = c.id)
          and c.cerrada_en > now() - interval '18 hours'
        order by c.cerrada_en desc limit 1`;

      if (anterior) {
        if (!d.contrasenaSaliente || !(await contrasenaValida(d.contrasenaSaliente, anterior.hash))) {
          return { error: "El cajero saliente debe confirmar con su contraseña la entrega del fondo." };
        }
      }
      const esperado = sobre ? sobre.monto : anterior ? anterior.fondo : p.fondo_fijo;
      // Cambio de turno: los dos conteos deben coincidir; si no, recuento obligatorio una vez.
      const exacto = anterior ? Math.abs(total - esperado) < 0.005 : Math.abs(total - esperado) <= p.tolerancia_efectivo;
      if (anterior && !exacto && !d.reintento) return { recontar: true, mensaje: "Los conteos no coinciden. Vuelvan a contar juntos." };

      const [turno] = await tx<{ id: string }[]>`
        insert into cajas (almacen_id, abierta_por, fondo, registradora_id, estado, recibido_de)
        values (${reg.almacen_id}, ${yo.id}, ${total}, ${reg.id}, ${exacto ? "abierto" : "pendiente_autorizacion"}, ${anterior?.id ?? null})
        returning id`;
      const conteo = await guardarConteo(tx, turno.id, anterior ? "recepcion_cambio_turno" : "apertura", yo.id, lineas);
      let selloRoto = false;
      if (sobre) {
        selloRoto = !d.selloIntegro || (d.folioSello ?? "").trim() !== sobre.folio_sello;
        await tx`update sobres_fondo set turno_apertura_id = ${turno.id}, sello_integro = ${!selloRoto} where id = ${sobre.id}`;
        if (selloRoto) await tx`insert into incidentes_caja (turno_id, tipo, detalle, responsable_id) values (${turno.id}, 'sello_roto', ${`Folio esperado ${sobre.folio_sello}, capturado ${d.folioSello ?? "—"}; sello íntegro: ${d.selloIntegro ? "sí" : "no"}`}, ${yo.id})`;
      }
      if (!exacto) {
        await tx`insert into incidentes_caja (turno_id, tipo, monto, detalle, responsable_id)
                 values (${turno.id}, ${anterior ? "diferencia_cambio_turno" : "diferencia_apertura"}, ${Math.round((total - esperado) * 100) / 100},
                         ${`Esperado ${esperado}, contado ${total}`}, ${anterior ? anterior.cajero : yo.id})`;
      }
      // Sello roto también bloquea hasta que el supervisor autorice.
      if (selloRoto && exacto) await tx`update cajas set estado = 'pendiente_autorizacion' where id = ${turno.id}`;
      await bitacora(tx, yo.id, "apertura", turno.id, { conteo: conteo.id, sobre: sobre?.id ?? null, recibe_de: anterior?.id ?? null });
      return exacto && !selloRoto
        ? { mensaje: "Apertura registrada", id: turno.id }
        : { mensaje: "Apertura pendiente de autorización del supervisor", id: turno.id };
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
 * Cierre ciego. FormData: datos (JSON con lineas, cierreDia, folioSello, terminales[{terminal_id,total,transacciones}])
 * y una foto por terminal en `foto_<terminal_id>`. Al cajero solo se le responde "Cierre registrado".
 */
export async function cerrarTurno(fd: FormData): Promise<Respuesta> {
  const yo = await requerirInterno("mostrador");
  let datos: { lineas: unknown; cierreDia: boolean; folioSello?: string; terminales: { terminal_id: string; total: number; transacciones: number }[] };
  try { datos = JSON.parse(String(fd.get("datos"))); } catch { return { error: "Datos de cierre inválidos." }; }
  let lineas;
  try { lineas = normalizarConteo(datos.lineas); } catch (e) { return { error: (e as Error).message }; }
  if (datos.cierreDia && !(datos.folioSello ?? "").trim()) return { error: "Captura el folio del sello del sobre de fondo." };

  const [t] = await sql<{ id: string; registradora_id: string }[]>`
    select id, registradora_id from cajas where abierta_por = ${yo.id} and cerrada_en is null order by abierta_en desc limit 1`;
  if (!t) return { error: "No tienes un turno abierto." };
  const asignadas = await sql<{ id: string; nombre: string }[]>`
    select tr.id, tr.nombre from caja_terminales ct join terminales tr on tr.id = ct.terminal_id where ct.registradora_id = ${t.registradora_id} and tr.activa`;
  // Obligatorio para TODAS las terminales asignadas, aunque tengan $0.
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
      if (datos.cierreDia) {
        await tx`insert into sobres_fondo (folio_sello, registradora_id, turno_cierre_id, conteo_id, monto, usuario_id)
                 values (${datos.folioSello!.trim()}, ${t.registradora_id}, ${t.id}, ${fondoConteo.id}, ${fondoConteo.total}, ${yo.id})`;
      }
      for (const c of capturas) {
        await tx`insert into cierres_terminal (turno_id, terminal_id, total, transacciones, foto_id, usuario_id)
                 values (${t.id}, ${c.terminal_id}, ${c.total}, ${c.transacciones}, ${c.foto}, ${yo.id})`;
      }
      await tx`update cajas set cierre_de_dia = ${!!datos.cierreDia} where id = ${t.id}`;
      await conciliarYCerrar(tx, t.id, yo.id);
      await bitacora(tx, yo.id, "cierre", t.id, { conteo: cierre.id, fondo: fondoConteo.id, cierre_de_dia: !!datos.cierreDia, terminales: capturas.length });
      return { mensaje: "Cierre registrado", id: t.id };
    });
  } catch (e) {
    return { error: (e as Error).message };
  } finally {
    refrescar("/interno/mostrador");
    refrescar("/interno/caja");
  }
}
