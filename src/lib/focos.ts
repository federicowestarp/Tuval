/** Semáforo de existencias, igual en mostrador, inventario y tablero. */
export type Foco = "verde" | "amarillo" | "rojo";

/** Verde: sí hay · Amarillo: se está agotando (bajo el mínimo) · Rojo: se acabó. Sin mínimo fijado no hay amarillo. */
export const focoDe = (p: { existencia: number; minimo: number | null }): Foco =>
  p.existencia <= 0 ? "rojo" : p.minimo != null && p.existencia < p.minimo ? "amarillo" : "verde";

export const COLOR_FOCO: Record<Foco, string> = { verde: "bg-emerald-500", amarillo: "bg-amber-400", rojo: "bg-red-500" };
export const NOMBRE_FOCO: Record<Foco, string> = { verde: "Hay", amarillo: "Agotándose", rojo: "Agotado" };
