/**
 * Totales de venta sin centavos fantasma. Regla: lo que el cliente ve es el precio CON IVA,
 * así que el total se suma con IVA por renglón y de ahí se desglosa subtotal e IVA.
 * (Antes: precio sin IVA redondeado a 2 decimales → $500 se volvía $499.99.)
 */
export const TASA_IVA = 0.16;
const r2 = (n: number) => Math.round(n * 100) / 100;
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Precio capturado con IVA → precio sin IVA con 6 decimales (al volver a sumar IVA da exacto). */
export const sinIva = (conIva: number) => r6(conIva / (1 + TASA_IVA));

export function totalesVenta(lineas: { precio: number; cantidad: number }[]) {
  const total = r2(lineas.reduce((a, l) => a + r2(l.precio * (1 + TASA_IVA) * l.cantidad), 0));
  const subtotal = r2(total / (1 + TASA_IVA));
  return { subtotal, iva: r2(total - subtotal), total };
}
