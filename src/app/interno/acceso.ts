import { notFound } from "next/navigation";

/**
 * Panel interno SIN inicio de sesión todavía. En producción queda oculto salvo que se
 * habilite explícitamente. Antes de operar con clientes reales hay que agregar autenticación.
 */
export function verificarAccesoInterno() {
  if (process.env.NODE_ENV === "production" && process.env.PANEL_INTERNO_HABILITADO !== "1") notFound();
}
