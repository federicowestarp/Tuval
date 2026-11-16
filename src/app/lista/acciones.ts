"use server";

import { sugerirProductos, type Producto } from "@/lib/catalogo";
import { interpretarLinea } from "@/lib/lista";
import { obtenerOCrearCuenta } from "@/lib/sesion";
import { guardarArchivo, TIPOS_LISTA } from "@/lib/archivos";

export type LineaInterpretada = { cantidad: number; descripcion: string; sugerencias: Producto[] };

export async function interpretarLista(texto: string): Promise<LineaInterpretada[]> {
  const lineas = texto.split(/\r?\n/).slice(0, 80).map(interpretarLinea).filter((l) => l !== null);
  return Promise.all(lineas.map(async (l) => ({ ...l, sugerencias: await sugerirProductos(l.descripcion) })));
}

export async function subirLista(fd: FormData): Promise<{ id?: string; nombre?: string; error?: string }> {
  const archivo = fd.get("archivo");
  if (!archivo || typeof archivo === "string" || archivo.size === 0) return { error: "Elige una foto o PDF." };
  const cuenta = await obtenerOCrearCuenta();
  try {
    const id = await guardarArchivo(archivo, TIPOS_LISTA, cuenta.id);
    return { id: id!, nombre: archivo.name };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
