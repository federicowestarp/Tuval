/**
 * Planeación de ruta (sin servicios de pago): ordena las entregas respetando primero la hora límite
 * de cada una y, dentro de eso, la cercanía (vecino más cercano + mejora 2-opt). Tiempos estimados con
 * distancia en línea recta × factor de calles y velocidad promedio configurables.
 */
export type Punto = { lat: number; lng: number };
export type Parada = { id: string; punto: Punto | null; limite: Date | null };
export type Config = { velocidadKmh: number; factorCalle: number; minutosParada: number };
export type Planeada = { id: string; orden: number; eta: Date | null; kmTramo: number | null; tarde: boolean; sinUbicacion: boolean };

const R = 6371;
export function kmEntre(a: Punto, b: Punto) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function largo(origen: Punto | null, orden: Parada[]) {
  let km = 0, prev = origen;
  for (const p of orden) { if (p.punto && prev) km += kmEntre(prev, p.punto); if (p.punto) prev = p.punto; }
  return km;
}

/** Vecino más cercano y luego 2-opt para quitar cruces, dentro de un mismo grupo de hora límite. */
function ordenarGrupo(inicio: Punto | null, grupo: Parada[]) {
  const pendientes = [...grupo];
  const orden: Parada[] = [];
  let actual = inicio;
  while (pendientes.length) {
    let mejor = 0;
    if (actual) {
      let d = Infinity;
      pendientes.forEach((p, i) => { const k = kmEntre(actual!, p.punto!); if (k < d) { d = k; mejor = i; } });
    }
    const [p] = pendientes.splice(mejor, 1);
    orden.push(p);
    actual = p.punto;
  }
  for (let mejoro = true, vueltas = 0; mejoro && vueltas < 50; vueltas++) {
    mejoro = false;
    for (let i = 0; i < orden.length - 1; i++) for (let j = i + 1; j < orden.length; j++) {
      const prueba = [...orden.slice(0, i), ...orden.slice(i, j + 1).reverse(), ...orden.slice(j + 1)];
      if (largo(inicio, prueba) + 1e-9 < largo(inicio, orden)) { orden.splice(0, orden.length, ...prueba); mejoro = true; }
    }
  }
  return orden;
}

export function planearRuta(origen: Punto | null, salida: Date, paradas: Parada[], c: Config): { paradas: Planeada[]; km: number; minutos: number } {
  // Grupos por hora límite (la más temprana primero); sin ubicación al final de su grupo.
  const claves = [...new Set(paradas.map((p) => p.limite?.getTime() ?? Infinity))].sort((a, b) => a - b);
  const orden: Parada[] = [];
  let pos = origen;
  for (const k of claves) {
    const grupo = paradas.filter((p) => (p.limite?.getTime() ?? Infinity) === k);
    const conPunto = ordenarGrupo(pos, grupo.filter((p) => p.punto));
    orden.push(...conPunto, ...grupo.filter((p) => !p.punto));
    if (conPunto.length) pos = conPunto[conPunto.length - 1].punto;
  }
  // Tiempos estimados.
  let t = salida.getTime(), km = 0, prev = origen;
  const res: Planeada[] = orden.map((p, i) => {
    let kmTramo: number | null = null;
    if (p.punto && prev) {
      kmTramo = Math.round(kmEntre(prev, p.punto) * c.factorCalle * 10) / 10;
      km += kmTramo;
      t += (kmTramo / c.velocidadKmh) * 3600_000;
    }
    const eta = p.punto && (prev || i > 0) ? new Date(t) : null;
    if (p.punto) prev = p.punto;
    t += c.minutosParada * 60_000;
    return { id: p.id, orden: i + 1, eta, kmTramo, tarde: !!(eta && p.limite && eta > p.limite), sinUbicacion: !p.punto };
  });
  return { paradas: res, km: Math.round(km * 10) / 10, minutos: Math.round((t - salida.getTime()) / 60_000) };
}

/**
 * Ligas de Google Maps con la ruta hecha. Google permite pocas paradas intermedias por liga,
 * así que se parte en tramos de hasta 9 intermedias, encadenados (el final de uno es el inicio del siguiente).
 */
export function ligasGoogleMaps(origen: Punto | null, puntos: Punto[], maxIntermedias = 9): string[] {
  const todos = [...(origen ? [origen] : []), ...puntos];
  if (todos.length < 2) return puntos.length === 1 ? [`https://www.google.com/maps/dir/?api=1&destination=${puntos[0].lat},${puntos[0].lng}&travelmode=driving`] : [];
  const f = (p: Punto) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
  const ligas: string[] = [];
  for (let i = 0; i < todos.length - 1; i += maxIntermedias + 1) {
    const tramo = todos.slice(i, i + maxIntermedias + 2);
    if (tramo.length < 2) break;
    const [o, ...resto] = tramo;
    const d = resto.pop()!;
    ligas.push(`https://www.google.com/maps/dir/?api=1&origin=${f(o)}&destination=${f(d)}${resto.length ? `&waypoints=${encodeURIComponent(resto.map(f).join("|"))}` : ""}&travelmode=driving`);
  }
  return ligas;
}

/** Acepta "19.04, -98.20" o una liga de Google Maps (…@19.04,-98.20,… o ?q=19.04,-98.20). */
export function leerCoordenadas(texto: string): Punto | null {
  const m = texto.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  return lat > 14 && lat < 33 && lng > -118 && lng < -86 ? { lat, lng } : null;
}
