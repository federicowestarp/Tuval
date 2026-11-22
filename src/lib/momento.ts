/**
 * Hora en que de verdad pasó algo. Si el cambio se hizo sin señal, el teléfono manda `_ocurrido` y se envía después;
 * así los tiempos de ruta, llegadas y entregas no quedan con la hora en que volvió la señal.
 * Solo se acepta si es de las últimas 72 h y no del futuro.
 */
export function momento(fd: FormData | null | undefined): Date {
  const t = Date.parse(String(fd?.get("_ocurrido") ?? ""));
  const ahora = Date.now();
  return Number.isFinite(t) && t <= ahora + 60_000 && t >= ahora - 72 * 3600_000 ? new Date(Math.min(t, ahora)) : new Date(ahora);
}
