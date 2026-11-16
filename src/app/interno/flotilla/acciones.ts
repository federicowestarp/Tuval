"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const t = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function agregarVehiculo(fd: FormData) {
  await requerirInterno("admin");
  const tipo = t(fd, "tipo");
  if (t(fd, "nombre").length < 2 || !["camioneta", "moto", "camion", "auto"].includes(tipo)) return;
  await sql`insert into vehiculos (nombre, tipo, placas) values (${t(fd, "nombre")}, ${tipo}, ${t(fd, "placas") || null})`;
  revalidatePath("/interno/flotilla");
}

export async function agregarEmpleado(fd: FormData) {
  await requerirInterno("admin");
  if (t(fd, "nombre").length < 2) return;
  const sueldo = Number(t(fd, "sueldo").replace(/[$,\s]/g, ""));
  const per = t(fd, "periodicidad");
  await sql`
    insert into empleados (nombre, puesto, sueldo, periodicidad)
    values (${t(fd, "nombre")}, ${t(fd, "puesto") || null}, ${sueldo > 0 ? sueldo : null}, ${["semanal", "quincenal", "mensual"].includes(per) ? per : "quincenal"})`;
  revalidatePath("/interno/flotilla");
}

export async function darDeBaja(fd: FormData) {
  await requerirInterno("admin");
  const id = t(fd, "id"), tabla = t(fd, "tabla");
  if (!UUID.test(id)) return;
  if (tabla === "vehiculos") await sql`update vehiculos set activo = false where id = ${id}`;
  if (tabla === "empleados") await sql`update empleados set activo = false where id = ${id}`;
  revalidatePath("/interno/flotilla");
}
