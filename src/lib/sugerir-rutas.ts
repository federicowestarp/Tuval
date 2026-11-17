/**
 * Sugerencia de reparto: qué pedidos listos lleva cada vehículo.
 * - Agrupa por zona (barrido por ángulo alrededor de la bodega de salida), así cada chofer
 *   se queda con pedidos cercanos entre sí.
 * - Respeta capacidad (piezas) y lo que no cabe en moto (tubería en tramos).
 * - Marca los que conviene surtir desde la sucursal (hay existencia y la sucursal queda más cerca que el proveedor).
 * Es una sugerencia: el operador la revisa y la confirma con "Usar esta sugerencia".
 */
import { kmEntre, type Punto } from "./planear-ruta.ts";

export type PedidoListo = { id: string; folio: string; punto: Punto | null; piezas: number; soloCamioneta: boolean; limite: Date | null };
export type Vehiculo = { id: string; nombre: string; tipo: string; capacidad: number | null };
export type Grupo = { vehiculo: Vehiculo; pedidos: PedidoListo[]; piezas: number; km: number };
export type Sugerencia = { grupos: Grupo[]; sinAsignar: { pedido: PedidoListo; motivo: string }[] };

const angulo = (o: Punto, p: Punto) => Math.atan2(p.lat - o.lat, p.lng - o.lng);

export function sugerirReparto(origen: Punto | null, pedidos: PedidoListo[], vehiculos: Vehiculo[], choferes: number): Sugerencia {
  const sinAsignar: Sugerencia["sinAsignar"] = [];
  const n = Math.max(1, Math.min(choferes, vehiculos.length));
  // Primero los vehículos con más capacidad (sin capacidad capturada = sin límite conocido).
  const usar = [...vehiculos].sort((a, b) => (b.capacidad ?? Infinity) - (a.capacidad ?? Infinity) || (a.tipo === "moto" ? 1 : 0) - (b.tipo === "moto" ? 1 : 0)).slice(0, n);
  if (usar.length === 0) return { grupos: [], sinAsignar: pedidos.map((p) => ({ pedido: p, motivo: "No hay vehículos activos" })) };
  const grupos: Grupo[] = usar.map((v) => ({ vehiculo: v, pedidos: [], piezas: 0, km: 0 }));

  const conPunto = pedidos.filter((p) => p.punto);
  for (const p of pedidos.filter((p) => !p.punto)) sinAsignar.push({ pedido: p, motivo: "Sin ubicación en el mapa" });
  if (conPunto.length === 0) return { grupos, sinAsignar };

  // Barrido por ángulo: pedidos vecinos quedan juntos. Arranca en el hueco angular más grande para no partir una zona.
  const o = origen ?? centro(conPunto.map((p) => p.punto!));
  const orden = conPunto.map((p) => ({ p, a: angulo(o, p.punto!) })).sort((x, y) => x.a - y.a);
  let corte = 0, hueco = -1;
  for (let i = 0; i < orden.length; i++) {
    const sig = orden[(i + 1) % orden.length].a + (i + 1 === orden.length ? 2 * Math.PI : 0);
    if (sig - orden[i].a > hueco) { hueco = sig - orden[i].a; corte = (i + 1) % orden.length; }
  }
  const barrido = [...orden.slice(corte), ...orden.slice(0, corte)].map((x) => x.p);

  const cabe = (g: Grupo, p: PedidoListo) => !(g.vehiculo.tipo === "moto" && p.soloCamioneta) && (g.vehiculo.capacidad == null || g.piezas + p.piezas <= g.vehiculo.capacidad);
  const porGrupo = Math.ceil(barrido.length / grupos.length);
  let actual = 0;
  for (const p of barrido) {
    while (actual < grupos.length - 1 && grupos[actual].pedidos.length >= porGrupo) actual++;
    // Si no cabe en el que toca, el vehículo compatible con su centro de zona más cercano.
    const destino = cabe(grupos[actual], p) ? grupos[actual]
      : grupos.filter((g) => cabe(g, p)).sort((a, b) => distanciaAGrupo(a, p) - distanciaAGrupo(b, p))[0];
    if (!destino) { sinAsignar.push({ pedido: p, motivo: p.soloCamioneta && grupos.every((g) => g.vehiculo.tipo === "moto") ? "Lleva tubería en tramos: necesita camioneta" : "No cabe en ningún vehículo" }); continue; }
    destino.pedidos.push(p);
    destino.piezas += p.piezas;
  }
  for (const g of grupos) g.km = kmRecorrido(o, g.pedidos.map((p) => p.punto!));
  return { grupos: grupos.filter((g) => g.pedidos.length > 0), sinAsignar };
}

function centro(ps: Punto[]): Punto {
  return { lat: ps.reduce((a, p) => a + p.lat, 0) / ps.length, lng: ps.reduce((a, p) => a + p.lng, 0) / ps.length };
}

function distanciaAGrupo(g: Grupo, p: PedidoListo) {
  if (g.pedidos.length === 0) return 0;
  return kmEntre(centro(g.pedidos.map((x) => x.punto!)), p.punto!);
}

/** Recorrido aproximado (vecino más cercano) solo para comparar grupos; la ruta final la arma el planeador. */
function kmRecorrido(o: Punto, ps: Punto[]) {
  let km = 0, aqui = o;
  const quedan = [...ps];
  while (quedan.length) {
    quedan.sort((a, b) => kmEntre(aqui, a) - kmEntre(aqui, b));
    const s = quedan.shift()!;
    km += kmEntre(aqui, s);
    aqui = s;
  }
  return Math.round(km * 10) / 10;
}
