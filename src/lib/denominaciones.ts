/** Denominaciones MXN (el 20 cuenta billete y moneda juntos). Compartido por servidor y pantallas de conteo. */
export const DENOMINACIONES = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5] as const;

export type LineaConteo = { d: number; piezas: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** El usuario solo captura piezas; el total siempre lo calcula el sistema. */
export function totalDeLineas(lineas: LineaConteo[]): number {
  return r2(lineas.reduce((a, l) => a + l.d * l.piezas, 0));
}

/** Valida y normaliza un conteo: solo denominaciones activas y piezas enteras ≥ 0. */
export function normalizarConteo(entrada: unknown): LineaConteo[] {
  if (!Array.isArray(entrada)) throw new Error("Conteo inválido");
  const mapa = new Map<number, number>();
  for (const x of entrada as { d?: unknown; piezas?: unknown }[]) {
    const d = Number(x?.d), p = Number(x?.piezas ?? 0);
    if (!(DENOMINACIONES as readonly number[]).includes(d)) throw new Error("Denominación no válida");
    if (!Number.isInteger(p) || p < 0 || p > 100000) throw new Error("Las piezas deben ser números enteros");
    mapa.set(d, (mapa.get(d) ?? 0) + p);
  }
  return DENOMINACIONES.map((d) => ({ d, piezas: mapa.get(d) ?? 0 }));
}

/**
 * Qué dejar como fondo del día siguiente: se completa el monto empezando por el cambio chico
 * (monedas y billetes bajos), para que el siguiente turno tenga con qué dar cambio. El resto va a depósito.
 */
export function separarFondo(lineas: LineaConteo[], fondo: number) {
  let falta = r2(fondo);
  const queda: LineaConteo[] = [];
  for (const d of [...DENOMINACIONES].sort((a, b) => a - b)) {
    const disponibles = lineas.find((l) => l.d === d)?.piezas ?? 0;
    const usar = Math.min(disponibles, Math.floor(r2(falta / d) + 1e-9));
    queda.push({ d, piezas: usar });
    falta = r2(falta - usar * d);
  }
  const fondoLineas = DENOMINACIONES.map((d) => ({ d, piezas: queda.find((q) => q.d === d)?.piezas ?? 0 }));
  const deposito = DENOMINACIONES.map((d) => ({ d, piezas: (lineas.find((l) => l.d === d)?.piezas ?? 0) - (fondoLineas.find((f) => f.d === d)?.piezas ?? 0) }));
  return { fondo: fondoLineas, deposito, faltante: falta };
}

export const etiquetaDenominacion = (d: number) => (d >= 50 ? `Billete $${d}` : d === 20 ? "$20 (billete y moneda)" : d < 1 ? "Moneda 50¢" : `Moneda $${d}`);
