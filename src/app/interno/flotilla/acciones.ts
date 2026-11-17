"use server";

import { refrescar } from "@/lib/refrescar";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const t = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function agregarVehiculo(fd: FormData) {
  await requerirInterno("admin");
  const tipo = t(fd, "tipo");
  if (t(fd, "nombre").length < 2 || !["camioneta", "moto", "camion", "auto"].includes(tipo)) return;
  const r = t(fd, "rastreador_id").replace(/\s/g, "");
  await sql`insert into vehiculos (nombre, tipo, placas, rastreador_id) values (${t(fd, "nombre")}, ${tipo}, ${t(fd, "placas") || null}, ${r || null})
            on conflict (rastreador_id) do nothing`;
  refrescar("/interno/flotilla");
}

export async function agregarEmpleado(fd: FormData) {
  await requerirInterno("admin");
  if (t(fd, "nombre").length < 2) return;
  const sueldo = Number(t(fd, "sueldo").replace(/[$,\s]/g, ""));
  const per = t(fd, "periodicidad");
  await sql`
    insert into empleados (nombre, puesto, sueldo, periodicidad, usuario_id)
    values (${t(fd, "nombre")}, ${t(fd, "puesto") || null}, ${sueldo > 0 ? sueldo : null}, ${["semanal", "quincenal", "mensual"].includes(per) ? per : "quincenal"},
            ${UUID.test(t(fd, "usuario_id")) ? t(fd, "usuario_id") : null})`;
  refrescar("/interno/flotilla");
}

export async function darDeBaja(fd: FormData) {
  await requerirInterno("admin");
  const id = t(fd, "id"), tabla = t(fd, "tabla");
  if (!UUID.test(id)) return;
  if (tabla === "vehiculos") await sql`update vehiculos set activo = false where id = ${id}`;
  if (tabla === "empleados") await sql`update empleados set activo = false where id = ${id}`;
  refrescar("/interno/flotilla");
}

export async function ligarRastreador(fd: FormData) {
  await requerirInterno("admin");
  const id = t(fd, "id"), r = t(fd, "rastreador_id").replace(/\s/g, "");
  if (!UUID.test(id)) return;
  await sql`update vehiculos set rastreador_id = ${r || null} where id = ${id} and not exists (select 1 from vehiculos where rastreador_id = ${r} and id <> ${id})`;
  refrescar("/interno/flotilla");
}

/** Liga a la persona de nómina con su acceso al panel (así su sueldo cuenta en el costo de sus rutas). */
export async function ligarUsuario(fd: FormData) {
  await requerirInterno("admin");
  const id = t(fd, "id"), u = t(fd, "usuario_id");
  if (!UUID.test(id)) return;
  await sql`update empleados set usuario_id = ${UUID.test(u) ? u : null} where id = ${id}`;
  refrescar("/interno/flotilla");
}
