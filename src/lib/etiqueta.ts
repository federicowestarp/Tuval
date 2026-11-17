import { URL_SITIO } from "./sitio";

/**
 * A dónde lleva el QR de la etiqueta de anaquel: la ficha pública del producto.
 * El cliente ve precio y puede pedirlo; el equipo ve además "Contar / existencias" (por el ?e=1).
 */
export const urlEtiqueta = (sku: string) => `${URL_SITIO}/producto/${encodeURIComponent(sku)}?e=1`;

/** El panel interno vive en admin.tuval.mx; en local o en otro dominio, en el mismo sitio. */
export const urlPanel = (ruta: string) =>
  `${/\/\/www\./.test(URL_SITIO) ? URL_SITIO.replace("//www.", "//admin.") : URL_SITIO}${ruta}`;
