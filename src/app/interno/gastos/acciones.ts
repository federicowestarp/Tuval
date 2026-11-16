"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { guardarArchivo, TIPOS_LISTA } from "@/lib/archivos";

const CATEGORIAS_GASTO = ["combustible", "mantenimiento", "seguro", "casetas", "nomina", "renta", "servicios", "marketing", "compras", "otros"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EstadoGasto = { error?: string; ok?: number };

export async function registrarGasto(prev: EstadoGasto, fd: FormData): Promise<EstadoGasto> {
  const yo = await requerirInterno("admin");
  const t = (k: string) => String(fd.get(k) ?? "").trim();
  const categoria = t("categoria");
  const monto = Number(t("monto").replace(/[$,\s]/g, ""));
  const fecha = t("fecha");
  const vehiculo = t("vehiculo_id"), empleado = t("empleado_id");
  if (!(CATEGORIAS_GASTO as readonly string[]).includes(categoria)) return { error: "Elige la categoría." };
  if (t("concepto").length < 2) return { error: "Escribe el concepto." };
  if (!(monto > 0)) return { error: "Escribe el monto." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Revisa la fecha." };
  if (categoria === "nomina" && !UUID.test(empleado)) return { error: "La nómina va ligada a una persona." };
  let comprobante: string | null = null;
  try {
    comprobante = await guardarArchivo(fd.get("comprobante"), TIPOS_LISTA);
  } catch (e) {
    return { error: (e as Error).message };
  }
  await sql`
    insert into gastos (fecha, categoria, concepto, monto, vehiculo_id, empleado_id, forma_pago, comprobante_id, creado_por)
    values (${fecha}, ${categoria}, ${t("concepto").slice(0, 200)}, ${monto}, ${UUID.test(vehiculo) ? vehiculo : null},
            ${UUID.test(empleado) ? empleado : null}, ${t("forma_pago") || null}, ${comprobante}, ${yo.id})`;
  revalidatePath("/interno/gastos");
  revalidatePath("/interno/tablero");
  return { ok: (prev.ok ?? 0) + 1 };
}

export async function borrarGasto(fd: FormData) {
  await requerirInterno("admin");
  const id = String(fd.get("id"));
  if (UUID.test(id)) await sql`delete from gastos where id = ${id}`;
  revalidatePath("/interno/gastos");
}
