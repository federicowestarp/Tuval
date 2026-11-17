import { revalidatePath, updateTag } from "next/cache";

/** Para Server Actions: refresca la ruta y además el tablero en caché (lee lo recién escrito). */
export function refrescar(ruta: string, tipo?: "page" | "layout") {
  revalidatePath(ruta, tipo);
  updateTag("tablero");
}
