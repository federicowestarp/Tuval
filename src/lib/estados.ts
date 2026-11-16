/** Estados internos del pedido y lo que ve el cliente. "Comprado a proveedor" es solo interno. */
export const ESTADOS_INTERNOS = [
  "recibido", "comprado_proveedor", "surtido", "en_ruta", "entregado", "entregado_con_faltantes", "cancelado",
] as const;
export type EstadoPedido = (typeof ESTADOS_INTERNOS)[number];

export const NOMBRE_INTERNO: Record<EstadoPedido, string> = {
  recibido: "Recibido",
  comprado_proveedor: "Comprado a proveedor",
  surtido: "Surtido",
  en_ruta: "En ruta",
  entregado: "Entregado",
  entregado_con_faltantes: "Entregado con faltantes",
  cancelado: "Cancelado",
};

/** Siguiente paso normal del flujo interno. */
export const SIGUIENTE: Partial<Record<EstadoPedido, EstadoPedido>> = {
  recibido: "comprado_proveedor",
  comprado_proveedor: "surtido",
  surtido: "en_ruta",
  en_ruta: "entregado",
};

export const ETAPAS_CLIENTE = ["Pedido recibido", "Preparando pedido", "En ruta", "Entregado"] as const;

export function etapaCliente(e: EstadoPedido): number {
  switch (e) {
    case "recibido": return 0;
    case "comprado_proveedor":
    case "surtido": return 1;
    case "en_ruta": return 2;
    case "entregado":
    case "entregado_con_faltantes": return 3;
    case "cancelado": return -1;
  }
}
