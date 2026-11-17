"use server";

import { refrescar } from "@/lib/refrescar";
import { requerirInterno } from "@/lib/equipo";
import { borrarDemo, cargarDemo } from "@/lib/demo";

export async function cargarDatosPrueba() {
  await requerirInterno("admin");
  await cargarDemo();
  refrescar("/interno", "layout");
}

export async function borrarDatosPrueba() {
  await requerirInterno("admin");
  await borrarDemo();
  refrescar("/interno", "layout");
}
