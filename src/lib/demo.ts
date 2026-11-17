import { randomUUID, randomBytes } from "node:crypto";
import type postgres from "postgres";
import { sql } from "@/lib/db";
import { recalcularExistencias, sucursal } from "@/lib/inventario";

/**
 * Datos de prueba INVENTADOS para ver el tablero lleno. Todo lo que se inserta queda anotado
 * en `datos_prueba` y se borra completo con borrarDemo(). Folios "PR-…" para distinguirlos.
 * Ninguna cifra de aquí es real: precios de gasolina, sueldos y tiempos son supuestos de prueba.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- transacción de postgres.js
type Tx = postgres.TransactionSql<any>;
type Fila = Record<string, unknown>;

const azar = (a: number, b: number) => a + Math.random() * (b - a);
const entero = (a: number, b: number) => Math.floor(azar(a, b + 1));
const uno = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
const min = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);
const r2 = (n: number) => Math.round(n * 100) / 100;
const iso = (d: Date) => d.toISOString();
/** Fecha y hora de México (UTC-6) → Date. */
const mx = (diasAtras: number, hora: number, minuto = 0) => {
  const hoy = new Date(Date.now() - 6 * 3600_000);
  const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() - diasAtras, hora + 6, minuto));
  return d;
};
const fechaMx = (d: Date) => new Date(d.getTime() - 6 * 3600_000).toISOString().slice(0, 10);

async function insertar(tx: Tx, tabla: string, tipos: Record<string, string>, filas: Fila[], registrar = true): Promise<string[]> {
  if (filas.length === 0) return [];
  const cols = Object.keys(tipos);
  const defs = cols.map((c) => `${c} ${tipos[c]}`).join(", ");
  const ids: string[] = [];
  for (let i = 0; i < filas.length; i += 2000) {
    const parte = filas.slice(i, i + 2000);
    const r = await tx.unsafe(
      `insert into ${tabla} (${cols.join(", ")}) select ${cols.join(", ")} from json_to_recordset($1::text::json) as x(${defs}) returning id::text id`,
      [JSON.stringify(parte)],
    );
    ids.push(...r.map((x) => String(x.id)));
  }
  if (registrar) await tx`insert into datos_prueba (tabla, id) select ${tabla}, unnest(${ids}::text[]) on conflict do nothing`;
  return ids;
}

const NOMBRES = ["Constructora Prueba Norte", "Obra Prueba Angelópolis", "Residencial Prueba Cholula", "Plomería Prueba Ruiz", "Desarrollos Prueba Sur", "Taller Prueba Hidráulico", "Casa Prueba López", "Hotel Prueba Centro"];
const ESTADOS_MX = ["Puebla", "Puebla", "Puebla", "Puebla", "Puebla", "Puebla", "Tlaxcala", "Tlaxcala", "Veracruz", "Ciudad de México", "Oaxaca", "Hidalgo"];
const MOTIVOS = ["Sin existencia", "Cliente canceló", "Precio no aceptado", "Precio no aceptado", "Fuera de cobertura", "Duplicado"];
// Coordenadas aproximadas de prueba alrededor de la ciudad de Puebla (no son las bodegas reales).
const CENTRO = { lat: 19.0414, lng: -98.2063 };

export async function hayDemo() {
  const [r] = await sql<{ n: number }[]>`select count(*)::int n from datos_prueba`;
  return r.n > 0;
}

export async function cargarDemo(): Promise<string> {
  if (await hayDemo()) return "Ya hay datos de prueba cargados. Bórralos primero.";
  // Si el producto no tiene precio de catálogo, se le inventa uno SOLO para los pedidos de prueba
  // (queda en las partidas de prueba, no en la lista de precios).
  const productos = (await sql<{ id: string; precio: number | null }[]>`
    select p.id, pr.precio::float precio from productos p
    left join precios pr on pr.producto_id = p.id and pr.lista_id = (select id from listas_precio where nombre = 'Público')
    where p.activo order by (pr.precio > 0) desc nulls last, random() limit 60`)
    .map((p) => ({ id: p.id, precio: p.precio && p.precio > 0 ? p.precio : r2(azar(35, 900)) }));
  if (productos.length < 5) return "Se necesitan al menos 5 productos activos en el catálogo.";
  // Pedidos creíbles: casi siempre material barato; equipo caro rara vez y de a uno.
  productos.sort((a, b) => a.precio - b.precio);
  const baratos = productos.filter((p) => p.precio <= 1500).length >= 5 ? productos.filter((p) => p.precio <= 1500) : productos.slice(0, Math.min(10, productos.length));
  const elegir = () => (Math.random() < 0.08 ? uno(productos) : uno(baratos));
  const cant = (precio: number, max = 12) => (precio < 200 ? entero(1, max) : precio < 1500 ? entero(1, Math.min(4, max)) : 1);
  const s = await sucursal();
  const bodegas = await sql<{ id: string }[]>`select id from almacenes where tipo = 'proveedor' and nombre ilike 'Emmsa%' order by nombre`;
  const [prov] = await sql<{ id: string }[]>`select id from proveedores where nombre = 'Emmsa' limit 1`;
  if (!bodegas.length || !prov) return "Falta dar de alta a Emmsa como proveedor.";
  const costoDe = (precio: number) => r2(precio * azar(0.62, 0.74));

  await sql.begin(async (tx) => {
    // Personas y vehículos
    const choferes = await insertar(tx, "usuarios_internos", { id: "uuid", nombre: "text", correo: "text", hash_contrasena: "text", rol: "rol_interno", activo: "boolean" }, [
      { id: randomUUID(), nombre: "Chofer Prueba 1", correo: `chofer1.${randomBytes(3).toString("hex")}@prueba.test`, hash_contrasena: "sin-acceso", rol: "chofer", activo: false },
      { id: randomUUID(), nombre: "Chofer Prueba 2", correo: `chofer2.${randomBytes(3).toString("hex")}@prueba.test`, hash_contrasena: "sin-acceso", rol: "chofer", activo: false },
      { id: randomUUID(), nombre: "Mostrador Prueba", correo: `mostrador.${randomBytes(3).toString("hex")}@prueba.test`, hash_contrasena: "sin-acceso", rol: "mostrador", activo: false },
    ]);
    const vehiculos = await insertar(tx, "vehiculos", { id: "uuid", nombre: "text", tipo: "text", placas: "text" }, [
      { id: randomUUID(), nombre: "Camioneta 1 (prueba)", tipo: "camioneta", placas: "PRB-001" },
      { id: randomUUID(), nombre: "Camioneta 2 (prueba)", tipo: "camioneta", placas: "PRB-002" },
      { id: randomUUID(), nombre: "Moto 1 (prueba)", tipo: "moto", placas: "PRB-M01" },
    ]);
    const empleadosFilas = [
      { id: randomUUID(), nombre: "Chofer Prueba 1", puesto: "chofer", sueldo: 4500, periodicidad: "quincenal", usuario_id: choferes[0] },
      { id: randomUUID(), nombre: "Chofer Prueba 2", puesto: "chofer", sueldo: 4500, periodicidad: "quincenal", usuario_id: choferes[1] },
      { id: randomUUID(), nombre: "Mostrador Prueba", puesto: "mostrador", sueldo: 5000, periodicidad: "quincenal", usuario_id: choferes[2] },
      { id: randomUUID(), nombre: "Operador Prueba", puesto: "operador", sueldo: 6000, periodicidad: "quincenal", usuario_id: null },
    ];
    await insertar(tx, "empleados", { id: "uuid", nombre: "text", puesto: "text", sueldo: "numeric", periodicidad: "text", usuario_id: "uuid" }, empleadosFilas);

    // Pedidos en línea (30 días)
    const pedidos: Fila[] = [], partidas: Fila[] = [], eventos: Fila[] = [], cotis: Fila[] = [], entregas: Fila[] = [], pagos: Fila[] = [];
    const paradas: Fila[] = [], paradaPedidos: Fila[] = [], posiciones: Fila[] = [];
    const rutas = new Map<string, Fila>(); // clave: fecha|chofer
    const odometro = [42_150, 38_900, 12_400];
    let folio = 1;
    for (let dia = 30; dia >= -1; dia--) {
      // dia = -1: unos pedidos de las últimas horas, para que haya trabajo abierto en cada etapa.
      const fechaDia = mx(Math.max(dia, 0), 0);
      if (dia >= 0 && fechaDia.getUTCDay() === 0) continue; // domingo
      const n = dia === -1 ? 6 : entero(1, 4);
      for (let k = 0; k < n; k++) {
        const id = randomUUID();
        const creado = dia === -1 ? new Date(Date.now() - [20, 90, 200, 260, 330, 400][k] * 60_000) : mx(dia, entero(7, 16), entero(0, 59));
        if (creado > new Date()) continue;
        const entidad = uno(ESTADOS_MX);
        const lat = CENTRO.lat + azar(-0.09, 0.09), lng = CENTRO.lng + azar(-0.09, 0.09);
        const lineas = Array.from({ length: entero(2, 5) }, elegir);
        const unicos = [...new Map(lineas.map((p) => [p.id, p])).values()];
        let subtotal = 0;
        for (const p of unicos) {
          const cantidad = cant(p.precio);
          subtotal += p.precio * cantidad;
          partidas.push({ id: randomUUID(), pedido_id: id, producto_id: p.id, cantidad, precio_unitario: p.precio, costo_unitario: costoDe(p.precio), cantidad_surtida: 0 });
        }
        subtotal = r2(subtotal);
        const sol = min(creado, azar(5, 45)), cot = min(sol, azar(20, 110)), conf = min(cot, azar(10, 45));
        const acep = min(conf, azar(15, 300)), comp = min(acep, azar(10, 60)), lleBod = min(comp, azar(25, 70));
        const surt = min(lleBod, azar(10, 40)), ruta = min(surt, azar(10, 50)), lleg = min(ruta, azar(15, 55)), entr = min(lleg, azar(4, 25));
        const ahora = new Date();
        const suerte = Math.random();
        let estado = "entregado";
        if (suerte < 0.09) estado = "cancelado";
        else if (entr > ahora) estado = comp > ahora ? "recibido" : surt > ahora ? "comprado_proveedor" : ruta > ahora ? "surtido" : "en_ruta";
        else if (suerte > 0.95) estado = "entregado_con_faltantes";
        const confirmado = estado !== "cancelado" || Math.random() < 0.5;
        pedidos.push({
          id, folio: `PR-${String(folio++).padStart(5, "0")}`, canal: "web", tipo_entrega: Math.random() < 0.6 ? "obra" : "domicilio", comprobante: Math.random() < 0.55 ? "factura" : "nota",
          estado, creado_en: iso(creado), cotizacion_solicitada_en: iso(sol), confirmado_en: confirmado && conf < ahora ? iso(conf) : null,
          aceptado_en: estado !== "cancelado" && acep < ahora ? iso(acep) : null, zona: entidad === "Puebla" ? "puebla" : entidad === "Tlaxcala" ? "tlaxcala" : "otro",
          entidad, lat, lng, contacto_nombre: uno(NOMBRES), contacto_telefono: "2220000000", recibe_nombre: "Residente de prueba", recibe_telefono: "2220000001",
          direccion_entrega: "Dirección de prueba", subtotal, iva: r2(subtotal * 0.16), total: r2(subtotal * 1.16),
          motivo_cancelacion: estado === "cancelado" ? uno(MOTIVOS) : null, token_receptor: randomBytes(12).toString("base64url"),
        });
        eventos.push({ pedido_id: id, estado: "recibido", nota: "Prueba", creado_en: iso(creado) });
        cotis.push({ id: randomUUID(), proveedor_id: prov.id, pedido_id: id, folio_proveedor: "PRUEBA", cargada_en: iso(cot) });
        if (estado === "cancelado") { eventos.push({ pedido_id: id, estado: "cancelado", nota: "Prueba", creado_en: iso(min(conf, 30)) }); continue; }
        if (comp < ahora) eventos.push({ pedido_id: id, estado: "comprado_proveedor", nota: "Prueba", creado_en: iso(comp) });
        if (surt > ahora) continue;
        eventos.push({ pedido_id: id, estado: "surtido", nota: "Prueba", creado_en: iso(surt) });
        // Ruta del día
        const c = Math.random() < 0.6 ? 0 : 1;
        const v = c === 0 ? (Math.random() < 0.8 ? 0 : 2) : 1;
        const clave = `${fechaMx(creado)}|${c}`;
        if (!rutas.has(clave)) {
          const km = entero(35, 90);
          rutas.set(clave, {
            id: randomUUID(), chofer_id: choferes[c], fecha: fechaMx(creado), vehiculo_id: vehiculos[v],
            iniciada_en: iso(mx(Math.max(dia, 0), 8, 30)), terminada_en: dia <= 0 ? null : iso(mx(dia, 18, entero(0, 40))),
            odometro_inicio: odometro[v], odometro_fin: dia <= 0 ? null : odometro[v] + km,
          });
          odometro[v] += km + entero(0, 5);
        }
        const r = rutas.get(clave)!;
        const pr = randomUUID();
        paradas.push({ id: pr, ruta_id: r.id, tipo: "recoleccion", almacen_id: uno(bodegas).id, pedido_id: null, llegada_en: iso(lleBod), salida_en: iso(surt) });
        paradaPedidos.push({ parada_id: pr, pedido_id: id });
        if (ruta > ahora) continue;
        eventos.push({ pedido_id: id, estado: "en_ruta", nota: "Prueba", creado_en: iso(ruta) });
        // Trayecto simulado (cada ~3 min) del punto de recolección al cliente
        const o = { lat: CENTRO.lat + azar(-0.03, 0.03), lng: CENTRO.lng + azar(-0.03, 0.03) };
        const pasos = Math.max(3, Math.round((lleg.getTime() - ruta.getTime()) / 180_000));
        for (let i = 0; i <= pasos; i++) {
          const f = i / pasos;
          posiciones.push({ ruta_id: r.id, lat: o.lat + (lat - o.lat) * f + azar(-0.002, 0.002), lng: o.lng + (lng - o.lng) * f + azar(-0.002, 0.002), registrada_en: iso(min(ruta, (i * (lleg.getTime() - ruta.getTime())) / pasos / 60_000)) });
        }
        if (entr > ahora) { entregas.push({ id: randomUUID(), pedido_id: id, ruta_id: r.id, estado: "en_ruta", entregada_en: null, recibio_nombre: null }); continue; }
        paradas.push({ id: randomUUID(), ruta_id: r.id, tipo: "entrega", almacen_id: null, pedido_id: id, llegada_en: iso(lleg), salida_en: iso(entr) });
        entregas.push({ id: randomUUID(), pedido_id: id, ruta_id: r.id, estado: "entregada", entregada_en: iso(entr), recibio_nombre: "Residente de prueba" });
        eventos.push({ pedido_id: id, estado, nota: "Prueba", creado_en: iso(entr) });
        pagos.push({ id: randomUUID(), pedido_id: id, monto: r2(subtotal * 1.16), forma: Math.random() < 0.7 ? "transferencia" : "efectivo", pagado_en: iso(min(entr, azar(0, 2880))) });
      }
    }
    await insertar(tx, "rutas", { id: "uuid", chofer_id: "uuid", fecha: "date", vehiculo_id: "uuid", iniciada_en: "timestamptz", terminada_en: "timestamptz", odometro_inicio: "int", odometro_fin: "int" }, [...rutas.values()]);
    await insertar(tx, "pedidos", {
      id: "uuid", folio: "text", canal: "canal_pedido", tipo_entrega: "tipo_entrega", comprobante: "comprobante", estado: "estado_pedido", creado_en: "timestamptz",
      cotizacion_solicitada_en: "timestamptz", confirmado_en: "timestamptz", aceptado_en: "timestamptz", zona: "zona_entrega", entidad: "text", lat: "float8", lng: "float8",
      contacto_nombre: "text", contacto_telefono: "text", recibe_nombre: "text", recibe_telefono: "text", direccion_entrega: "text",
      subtotal: "numeric", iva: "numeric", total: "numeric", motivo_cancelacion: "text", token_receptor: "text",
    }, pedidos);
    await insertar(tx, "pedido_partidas", { id: "uuid", pedido_id: "uuid", producto_id: "uuid", cantidad: "numeric", precio_unitario: "numeric", costo_unitario: "numeric", cantidad_surtida: "numeric" }, partidas, false);
    await insertar(tx, "pedido_eventos", { pedido_id: "uuid", estado: "estado_pedido", nota: "text", creado_en: "timestamptz" }, eventos, false);
    await insertar(tx, "cotizaciones_proveedor", { id: "uuid", proveedor_id: "uuid", pedido_id: "uuid", folio_proveedor: "text", cargada_en: "timestamptz" }, cotis, false);
    await insertar(tx, "entregas", { id: "uuid", pedido_id: "uuid", ruta_id: "uuid", estado: "estado_entrega", entregada_en: "timestamptz", recibio_nombre: "text" }, entregas);
    await insertar(tx, "paradas_ruta", { id: "uuid", ruta_id: "uuid", tipo: "text", almacen_id: "uuid", pedido_id: "uuid", llegada_en: "timestamptz", salida_en: "timestamptz" }, paradas, false);
    await tx`insert into parada_pedidos select * from json_to_recordset(${JSON.stringify(paradaPedidos)}::text::json) as x(parada_id uuid, pedido_id uuid)`;
    await insertar(tx, "posiciones_ruta", { ruta_id: "uuid", lat: "float8", lng: "float8", registrada_en: "timestamptz" }, posiciones, false);
    await insertar(tx, "pagos", { id: "uuid", pedido_id: "uuid", monto: "numeric", forma: "text", pagado_en: "timestamptz" }, pagos.filter((p) => new Date(String(p.pagado_en)) < new Date()));

    // Inventario de sucursal: entrada inicial y costo promedio (solo donde no había costo)
    const inventario = baratos.slice(0, 40);
    const sinCosto = await tx<{ id: string }[]>`select id::text id from productos where id = any(${inventario.map((p) => p.id)}::uuid[]) and costo_promedio is null`;
    const conCosto = new Set(sinCosto.map((x) => x.id));
    for (const p of inventario) if (conCosto.has(p.id)) await tx`update productos set costo_promedio = ${costoDe(p.precio)} where id = ${p.id}`;
    await tx`insert into datos_prueba (tabla, id) select 'costo_promedio', unnest(${[...conCosto]}::text[]) on conflict do nothing`;
    const movs: Fila[] = [];
    for (const p of inventario) movs.push({ producto_id: p.id, almacen_destino: s.id, almacen_origen: null, cantidad: entero(15, 80), tipo: "entrada_compra", costo_unitario: costoDe(p.precio), referencia: "PRUEBA inventario inicial", creado_en: iso(mx(31, 9)) });

    const [registradora] = await tx<{ id: string }[]>`select id from cajas_registradoras where almacen_id = ${s.id} order by creado_en limit 1`;
    // Mostrador: una caja por día, 2–7 ventas
    const cajas: Fila[] = [], ventas: Fila[] = [], vPartidas: Fila[] = [], vPagos: Fila[] = [], vEventos: Fila[] = [];
    for (let dia = 30; dia >= 1; dia--) {
      if (mx(dia, 0).getUTCDay() === 0) continue;
      const caja = randomUUID();
      let efectivo = 0;
      const nv = entero(2, 7);
      for (let k = 0; k < nv; k++) {
        const id = randomUUID();
        const hora = mx(dia, entero(9, 17), entero(0, 59));
        const ls = [...new Map(Array.from({ length: entero(1, 3) }, () => uno(inventario)).map((p) => [p.id, p])).values()];
        let sub = 0;
        for (const p of ls) {
          const cantidad = cant(p.precio, 4);
          sub += p.precio * cantidad;
          vPartidas.push({ id: randomUUID(), pedido_id: id, producto_id: p.id, cantidad, precio_unitario: p.precio, costo_unitario: costoDe(p.precio), cantidad_surtida: cantidad });
          movs.push({ producto_id: p.id, almacen_origen: s.id, almacen_destino: null, cantidad, tipo: "salida_venta", costo_unitario: null, referencia: `PM-${dia}-${k}`, creado_en: iso(hora) });
        }
        sub = r2(sub);
        const total = r2(sub * 1.16);
        const forma = uno(["efectivo", "efectivo", "tarjeta", "tarjeta", "transferencia"]);
        if (forma === "efectivo") efectivo += total;
        ventas.push({ id, folio: `PM-${String(ventas.length + 1).padStart(5, "0")}`, canal: "mostrador", tipo_entrega: "recoger", comprobante: Math.random() < 0.2 ? "factura" : "nota", estado: "entregado", creado_en: iso(hora), confirmado_en: iso(hora), aceptado_en: iso(hora), almacen_surtido: s.id, vendedor_id: choferes[2], contacto_nombre: null, subtotal: sub, iva: r2(sub * 0.16), total });
        vPagos.push({ id: randomUUID(), pedido_id: id, monto: total, forma, pagado_en: iso(hora), caja_id: caja, recibido: forma === "efectivo" ? Math.ceil(total / 100) * 100 : null });
        vEventos.push({ pedido_id: id, estado: "entregado", nota: "Venta de mostrador (prueba)", creado_en: iso(hora) });
      }
      const diferencia = Math.random() < 0.15 ? -entero(20, 150) : 0;
      cajas.push({ id: caja, almacen_id: s.id, abierta_por: choferes[2], abierta_en: iso(mx(dia, 8, 55)), fondo: 1000, cerrada_por: choferes[2], cerrada_en: iso(mx(dia, 18, 5)), efectivo_contado: r2(1000 + efectivo + diferencia), estado: Math.abs(diferencia) > 50 ? "con_incidente" : "conciliado", registradora_id: registradora?.id ?? null });
    }
    await insertar(tx, "cajas", { id: "uuid", almacen_id: "uuid", abierta_por: "uuid", abierta_en: "timestamptz", fondo: "numeric", cerrada_por: "uuid", cerrada_en: "timestamptz", efectivo_contado: "numeric", estado: "text", registradora_id: "uuid" }, cajas);
    await insertar(tx, "pedidos", { id: "uuid", folio: "text", canal: "canal_pedido", tipo_entrega: "tipo_entrega", comprobante: "comprobante", estado: "estado_pedido", creado_en: "timestamptz", confirmado_en: "timestamptz", aceptado_en: "timestamptz", almacen_surtido: "uuid", vendedor_id: "uuid", contacto_nombre: "text", subtotal: "numeric", iva: "numeric", total: "numeric" }, ventas);
    await insertar(tx, "pedido_partidas", { id: "uuid", pedido_id: "uuid", producto_id: "uuid", cantidad: "numeric", precio_unitario: "numeric", costo_unitario: "numeric", cantidad_surtida: "numeric" }, vPartidas, false);
    await insertar(tx, "pagos", { id: "uuid", pedido_id: "uuid", monto: "numeric", forma: "text", pagado_en: "timestamptz", caja_id: "uuid", recibido: "numeric" }, vPagos);
    await insertar(tx, "pedido_eventos", { pedido_id: "uuid", estado: "estado_pedido", nota: "text", creado_en: "timestamptz" }, vEventos, false);

    // Dos conteos con algún faltante
    for (const dia of [20, 6]) {
      for (const p of inventario.slice(0, 12)) {
        if (Math.random() < 0.25) movs.push({ producto_id: p.id, almacen_origen: s.id, almacen_destino: null, cantidad: entero(1, 3), tipo: "ajuste_conteo", costo_unitario: null, referencia: null, nota: "Conteo de prueba: faltante", creado_en: iso(mx(dia, 19)) });
      }
    }
    await insertar(tx, "movimientos_inventario", { producto_id: "uuid", almacen_origen: "uuid", almacen_destino: "uuid", cantidad: "numeric", tipo: "tipo_movimiento", costo_unitario: "numeric", referencia: "text", nota: "text", creado_en: "timestamptz" }, movs);
    const tocados = [...new Set(movs.map((m) => String(m.producto_id)))];
    await tx`insert into existencias (producto_id, almacen_id, cantidad) select unnest(${tocados}::uuid[]), ${s.id}, 0 on conflict do nothing`;
    await recalcularExistencias(tx, tocados);
    for (const p of inventario.slice(0, 8)) await tx`update existencias set minimo = coalesce(minimo, ${entero(10, 30)}) where producto_id = ${p.id} and almacen_id = ${s.id}`;

    // Gastos: gasolina cada 2–3 días por vehículo, mantenimiento, nómina quincenal, renta y servicios
    const gastos: Fila[] = [];
    const odos = [42_150, 38_900, 12_400];
    for (let dia = 30; dia >= 0; dia -= entero(2, 3)) {
      vehiculos.forEach((v, i) => {
        const moto = i === 2;
        const litros = r2(moto ? azar(6, 10) : azar(28, 45));
        odos[i] += Math.round(litros * (moto ? 32 : 9) + azar(-20, 20));
        gastos.push({ id: randomUUID(), fecha: fechaMx(mx(dia, 12)), categoria: "combustible", concepto: `Gasolina ${litros} L (prueba)`, monto: r2(litros * 24.5), vehiculo_id: v, empleado_id: null, forma_pago: "Efectivo", litros, odometro: odos[i] });
      });
    }
    gastos.push({ id: randomUUID(), fecha: fechaMx(mx(18, 12)), categoria: "mantenimiento", concepto: "Servicio y aceite (prueba)", monto: 2850, vehiculo_id: vehiculos[0], empleado_id: null, forma_pago: "Tarjeta", litros: null, odometro: null });
    gastos.push({ id: randomUUID(), fecha: fechaMx(mx(9, 12)), categoria: "mantenimiento", concepto: "Llantas moto (prueba)", monto: 1600, vehiculo_id: vehiculos[2], empleado_id: null, forma_pago: "Efectivo", litros: null, odometro: null });
    gastos.push({ id: randomUUID(), fecha: fechaMx(mx(25, 12)), categoria: "casetas", concepto: "Casetas Tlaxcala (prueba)", monto: 340, vehiculo_id: vehiculos[1], empleado_id: null, forma_pago: "Efectivo", litros: null, odometro: null });
    for (const dia of [30, 15, 0]) for (const e of empleadosFilas) gastos.push({ id: randomUUID(), fecha: fechaMx(mx(dia, 12)), categoria: "nomina", concepto: "Quincena (prueba)", monto: e.sueldo, vehiculo_id: null, empleado_id: e.id, forma_pago: "Transferencia", litros: null, odometro: null });
    gastos.push({ id: randomUUID(), fecha: fechaMx(mx(16, 12)), categoria: "renta", concepto: "Renta sucursal (prueba)", monto: 18000, vehiculo_id: null, empleado_id: null, forma_pago: "Transferencia", litros: null, odometro: null });
    gastos.push({ id: randomUUID(), fecha: fechaMx(mx(12, 12)), categoria: "servicios", concepto: "Luz e internet (prueba)", monto: 2400, vehiculo_id: null, empleado_id: null, forma_pago: "Transferencia", litros: null, odometro: null });
    await insertar(tx, "gastos", { id: "uuid", fecha: "date", categoria: "text", concepto: "text", monto: "numeric", vehiculo_id: "uuid", empleado_id: "uuid", forma_pago: "text", litros: "numeric", odometro: "int" }, gastos);
  });
  return "Datos de prueba cargados.";
}

export async function borrarDemo(): Promise<string> {
  const s = await sucursal();
  await sql.begin(async (tx) => {
    const ids = (t: string) => tx`select id from datos_prueba where tabla = ${t}`;
    const tocados = (await tx<{ producto_id: string }[]>`
      select distinct producto_id::text producto_id from movimientos_inventario where id::text in (${ids("movimientos_inventario")})`).map((x) => x.producto_id);
    const pedidos = tx`select id::uuid from datos_prueba where tabla = 'pedidos'`;
    await tx`delete from movimientos_inventario where id::text in (${ids("movimientos_inventario")})`;
    // También lo que alguien haya registrado a mano sobre pedidos de prueba (cobros, entregas, facturas).
    await tx`delete from pagos where id::text in (${ids("pagos")}) or pedido_id in (${pedidos})`;
    await tx`delete from facturas where pedido_id in (${pedidos})`;
    await tx`delete from entrega_fotos where entrega_id in (select id from entregas where pedido_id in (${pedidos}))`;
    await tx`delete from entregas where id::text in (${ids("entregas")}) or pedido_id in (${pedidos})`;
    await tx`delete from posiciones_ruta where ruta_id::text in (${ids("rutas")})`;
    await tx`delete from paradas_ruta where ruta_id::text in (${ids("rutas")})`;
    await tx`delete from rutas where id::text in (${ids("rutas")})`;
    await tx`delete from pedidos where id::text in (${ids("pedidos")})`;
    await tx`delete from cajas where id::text in (${ids("cajas")})`;
    await tx`delete from gastos where id::text in (${ids("gastos")})`;
    await tx`delete from empleados where id::text in (${ids("empleados")})`;
    await tx`delete from vehiculos where id::text in (${ids("vehiculos")})`;
    await tx`delete from usuarios_internos where id::text in (${ids("usuarios_internos")})`;
    await tx`update productos set costo_promedio = null where id::text in (${ids("costo_promedio")})`;
    await recalcularExistencias(tx, tocados);
    await tx`delete from existencias where almacen_id = ${s.id} and cantidad = 0 and minimo is null and producto_id = any(${tocados}::uuid[])`;
    await tx`delete from datos_prueba`;
  });
  return "Datos de prueba borrados.";
}
