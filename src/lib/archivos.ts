import { sql } from "@/lib/db";

export const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp"];
export const TIPOS_LISTA = [...TIPOS_IMAGEN, "application/pdf"];
const MAX_BYTES = 8 * 1024 * 1024;

/** Guarda un archivo subido. Devuelve null si no hay archivo; lanza error si no es válido. */
export async function guardarArchivo(f: FormDataEntryValue | null, permitidos: string[], cuentaId?: string): Promise<string | null> {
  if (!f || typeof f === "string" || f.size === 0) return null;
  if (!permitidos.includes(f.type)) throw new Error("Tipo de archivo no permitido. Usa foto (JPG, PNG) o PDF.");
  if (f.size > MAX_BYTES) throw new Error("El archivo pesa más de 8 MB.");
  const datos = Buffer.from(await f.arrayBuffer());
  const [a] = await sql<{ id: string }[]>`
    insert into archivos (mime, nombre, bytes, datos, cuenta_id)
    values (${f.type}, ${f.name.slice(0, 200)}, ${f.size}, ${datos}, ${cuentaId ?? null})
    returning id`;
  return a.id;
}

