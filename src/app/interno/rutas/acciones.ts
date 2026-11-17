"use server";

import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { leerCoordenadas } from "@/lib/planear-ruta";
import { replanear } from "@/lib/rutas-plan";
import { refrescar } from "@/lib/refrescar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const t = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Asigna los pedidos elegidos a la ruta del chofer en esa fecha y la arma (orden por hora límite y cercanía). */
export async function armarRuta(fd: FormData) {
  const yo = await requerirInterno("operador");
  const fecha = t(fd, "fecha"), chofer = t(fd, "chofer_id"), vehiculo = t(fd, "vehiculo_id"), origen = t(fd, "origen_id"), hora = t(fd, "hora_salida");
  const pedidos = fd.getAll("pedido_id").map(String).filter((x) => UUID.test(x));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !UUID.test(chofer) || pedidos.length === 0) return;
  const salida = /^\d{1,2}:\d{2}$/.test(hora) ? new Date(`${fecha}T${hora.padStart(5, "0")}:00-06:00`) : null;
  let rutaId = "";
  await sql.begin(async (tx) => {
    const [r] = await tx<{ id: string }[]>`
      insert into rutas (chofer_id, fecha, vehiculo_id, origen_almacen_id, salida_planeada, planeada_por)
      values (${chofer}, ${fecha}, ${UUID.test(vehiculo) ? vehiculo : null}, ${UUID.test(origen) ? origen : null}, ${salida}, ${yo.id})
      on conflict (chofer_id, fecha) do update set
        vehiculo_id = coalesce(excluded.vehiculo_id, rutas.vehiculo_id), origen_almacen_id = coalesce(excluded.origen_almacen_id, rutas.origen_almacen_id),
        salida_planeada = coalesce(excluded.salida_planeada, rutas.salida_planeada), planeada_por = excluded.planeada_por
      returning id`;
    rutaId = r.id;
    for (const p of pedidos) {
      // Si ya estaba en otra ruta sin salir, se mueve a esta.
      const [e] = await tx<{ id: string }[]>`select id from entregas where pedido_id = ${p} and estado in ('programada', 'en_ruta') limit 1`;
      if (e) await tx`update entregas set ruta_id = ${r.id} where id = ${e.id} and estado = 'programada'`;
      else await tx`insert into entregas (pedido_id, ruta_id, estado) values (${p}, ${r.id}, 'programada')`;
    }
    await replanear(tx, r.id);
  });
  refrescar("/interno/rutas");
  refrescar("/interno/chofer");
  redirect(`/interno/rutas?fecha=${fecha}#ruta-${rutaId}`);
}

export async function reoptimizar(fd: FormData) {
  await requerirInterno("operador");
  const id = t(fd, "ruta");
  if (!UUID.test(id)) return;
  await sql.begin((tx) => replanear(tx, id));
  refrescar("/interno/rutas");
  refrescar("/interno/chofer");
}

export async function quitarDeRuta(fd: FormData) {
  await requerirInterno("operador");
  const id = t(fd, "entrega");
  if (!UUID.test(id)) return;
  await sql.begin(async (tx) => {
    const [e] = await tx<{ ruta_id: string }[]>`delete from entregas where id = ${id} and estado = 'programada' returning ruta_id`;
    if (e?.ruta_id) await replanear(tx, e.ruta_id);
  });
  refrescar("/interno/rutas");
  refrescar("/interno/chofer");
}

/** Ubicación de una bodega o sucursal: se pega "lat, lng" o la liga de Google Maps. */
export async function guardarUbicacion(fd: FormData) {
  await requerirInterno("operador");
  const id = t(fd, "almacen"), punto = leerCoordenadas(t(fd, "ubicacion"));
  if (!UUID.test(id) || !punto) return;
  await sql`update almacenes set lat = ${punto.lat}, lng = ${punto.lng} where id = ${id}`;
  refrescar("/interno/rutas");
}

export async function guardarParametroRuta(fd: FormData) {
  const yo = await requerirInterno("admin");
  const clave = t(fd, "clave"), valor = Number(t(fd, "valor"));
  if (!/^[a-z_]{3,40}$/.test(clave) || !(valor > 0)) return;
  await sql`update parametros_operacion set valor = ${valor}, supuesto = false, actualizado_por = ${yo.id}, actualizado_en = now() where clave = ${clave}`;
  refrescar("/interno/rutas");
}
