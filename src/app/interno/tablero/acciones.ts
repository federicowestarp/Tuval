"use server";

import { revalidatePath } from "next/cache";
import { requerirInterno } from "@/lib/equipo";
import { borrarDemo, cargarDemo } from "@/lib/demo";

export async function cargarDatosPrueba() {
  await requerirInterno("admin");
  await cargarDemo();
  revalidatePath("/interno", "layout");
}

export async function borrarDatosPrueba() {
  await requerirInterno("admin");
  await borrarDemo();
  revalidatePath("/interno", "layout");
}
