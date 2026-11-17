import { Esqueleto } from "@/components/interno/Esqueleto";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { requerirInterno } from "@/lib/equipo";
import { datosTablero, PERIODOS, type Periodo } from "@/lib/tablero";
import { Barras, Indicador, horas, pesos } from "@/components/interno/Indicadores";
import { DatosPrueba } from "./DatosPrueba";
import { NavegacionInterna } from "../Navegacion";

const CATEGORIA: Record<string, string> = {
  combustible: "Combustible", mantenimiento: "Mantenimiento", seguro: "Seguro", casetas: "Casetas", nomina: "Nómina",
  renta: "Renta", servicios: "Servicios", marketing: "Marketing", compras: "Compras", otros: "Otros",
};

export default function Tablero(props: PageProps<"/interno/tablero">) {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="tablero" />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6">
        <Suspense fallback={<Esqueleto />}>
          <Contenido searchParams={props.searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

const Seccion = ({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-display text-xl font-semibold">{titulo}</h2>
      {nota && <p className="text-[13px] text-secundario">{nota}</p>}
    </div>
    {children}
  </section>
);
const Caja = ({ children }: { children: React.ReactNode }) => <div className="rounded-[20px] bg-white p-5">{children}</div>;

/** Km de un vehículo: rastreador > odómetro > teléfono. */
const km = (v: { km_rastreador: number | null; km_odometro: number | null; km: number }) => v.km_rastreador || v.km_odometro || v.km || null;

async function Contenido({ searchParams }: { searchParams: PageProps<"/interno/tablero">["searchParams"] }) {
  await connection();
  await requerirInterno("admin");
  const sp = await searchParams;
  const periodo = (PERIODOS.find((x) => x.id === sp.p)?.id ?? "7d") as Periodo;
  const t = await datosTablero(periodo);
  const f = t.finanzas, margen = f.ventas - f.costo, resultado = margen - f.gastos;
  const total = t.etapas.find((e) => e.etapa.startsWith("Total"));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">Tablero</h1>
        <nav className="flex gap-1 rounded-full bg-white p-1 text-[14px]">
          {PERIODOS.map((x) => (
            <Link key={x.id} href={`/interno/tablero?p=${x.id}`} className={`rounded-full px-3.5 py-1.5 ${x.id === periodo ? "bg-azul text-white" : "text-secundario hover:text-azul"}`}>{x.nombre}</Link>
          ))}
        </nav>
      </div>

      <DatosPrueba hay={t.hayPrueba} />

      <Seccion titulo="Pedidos">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          <Indicador etiqueta="Recibidos en línea" valor={String(t.flujo.recibidos)} />
          <Indicador etiqueta="Cotizaciones de proveedor" valor={String(t.flujo.cotizaciones)} />
          <Indicador etiqueta="Confirmados" valor={String(t.flujo.confirmados)} />
          <Indicador etiqueta="Entregados" valor={String(t.flujo.entregados)} nota={t.flujo.con_faltantes ? `${t.flujo.con_faltantes} con faltantes` : undefined} />
          <Indicador etiqueta="Cancelados" valor={String(t.flujo.cancelados)} />
          <Indicador etiqueta="Piezas por buscar" valor={String(t.flujo.demanda)} />
          <Indicador etiqueta="Contactos web" valor={String(t.flujo.contactos)} />
        </div>
        {t.canales.length > 0 && (
          <Caja>
            <p className="mb-3 font-semibold">Ventas por canal</p>
            <Barras filas={t.canales.map((c) => ({ etiqueta: c.canal, valor: c.ventas, texto: pesos(c.ventas), detalle: `${c.pedidos} pedidos` }))} />
          </Caja>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <Caja>
            <p className="mb-3 font-semibold">Abiertos ahora, por etapa</p>
            <Barras filas={t.estados.map((e) => ({ etiqueta: e.etapa, valor: e.n, texto: String(e.n) }))} vacio="No hay pedidos abiertos." />
          </Caja>
          <Caja>
            <p className="mb-3 font-semibold">Cancelados o rechazados, por motivo</p>
            <Barras filas={t.cancelados.map((c) => ({ etiqueta: c.motivo, valor: c.n, texto: String(c.n) }))} vacio="Ningún pedido cancelado en este periodo." />
          </Caja>
        </div>
      </Seccion>

      <Seccion titulo="Tiempos" nota={`Mediana por etapa${periodo === "hoy" ? " · últimos 30 días" : ""}`}>
        <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
          <Indicador etiqueta="Del pedido a la entrega" valor={horas(total?.horas ?? null)} nota={total ? `${total.pedidos} pedido${total.pedidos === 1 ? "" : "s"} entregado${total.pedidos === 1 ? "" : "s"}` : "Sin entregas aún"} />
          <Caja>
            <Barras
              filas={t.etapas.filter((e) => !e.etapa.startsWith("Total")).map((e) => ({ etiqueta: e.etapa, valor: e.horas ?? 0, texto: horas(e.horas), detalle: `${e.pedidos} pedidos` }))}
              vacio="Aún no hay pedidos con estas etapas."
            />
          </Caja>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Indicador etiqueta="Traslado al cliente (mediana)" valor={t.traslados.min_mediana != null ? `${t.traslados.min_mediana} min` : "—"} nota={`${t.traslados.tramos} tramos`} />
          <Indicador etiqueta="Distancia por tramo (mediana)" valor={t.traslados.km_mediana != null ? `${t.traslados.km_mediana} km` : "—"} nota="GPS del teléfono" />
          {t.recolecciones.slice(0, 2).map((r) => (
            <Indicador key={r.lugar} etiqueta={`Espera en ${r.lugar.replace("Emmsa · ", "Emmsa ")}`} valor={r.espera_min != null ? `${r.espera_min} min` : "—"} nota={`${r.visitas} visitas`} />
          ))}
        </div>
        {t.pendientes.length > 0 && (
          <Caja>
            <p className="mb-2 font-semibold">Por recoger con el proveedor</p>
            <ul className="divide-y divide-linea text-[14px]">
              {t.pendientes.map((x) => (
                <li key={x.id} className="flex justify-between py-2"><Link href={`/interno/pedidos/${x.id}`} className="text-azul">{x.folio}</Link><span className="tabular-nums text-secundario">comprado hace {horas(x.horas)}</span></li>
              ))}
            </ul>
          </Caja>
        )}
      </Seccion>

      <Seccion titulo="Rutas y traslados" nota="Km GPS = teléfono del chofer · Km odómetro = captura al iniciar y terminar">
        <Caja>
          {t.rutas.length === 0 ? <p className="text-[14px] text-secundario">Sin rutas en este periodo.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[14px]">
                <thead className="text-[12px] text-secundario"><tr><th className="pb-2">Fecha</th><th>Chofer</th><th>Vehículo</th><th className="text-right">Entregas</th><th className="text-right">En ruta</th><th className="text-right">Km GPS</th><th className="text-right">Km odómetro</th><th className="text-right">Horas</th></tr></thead>
                <tbody className="divide-y divide-linea tabular-nums">
                  {t.rutas.slice(0, 15).map((r) => (
                    <tr key={r.id}><td className="py-2">{r.fecha}</td><td>{r.chofer}</td><td>{r.vehiculo ?? "—"}</td><td className="text-right">{r.entregas}</td><td className="text-right">{r.pendientes}</td><td className="text-right">{r.km}</td><td className="text-right">{r.km_odometro ?? "—"}</td><td className="text-right">{horas(r.horas)}</td></tr>
                  ))}
                </tbody>
              </table>
              {t.rutas.length > 15 && <p className="mt-2 text-[12px] text-secundario">Mostrando las 15 rutas más recientes de {t.rutas.length}.</p>}
            </div>
          )}
        </Caja>
      </Seccion>

      <Seccion titulo="Ingresos y gastos" nota="Ventas = pedidos confirmados del periodo, con IVA">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Indicador etiqueta="Ventas confirmadas" valor={pesos(f.ventas)} />
          <Indicador etiqueta="Costo de proveedor" valor={pesos(f.costo)} nota="Según cotizaciones cargadas" />
          <Indicador etiqueta="Margen bruto" valor={pesos(margen)} nota={f.ventas ? `${Math.round((margen / f.ventas) * 100)}% de las ventas` : undefined} />
          <Indicador etiqueta="Gastos" valor={pesos(f.gastos)} />
          <Indicador etiqueta="Resultado estimado" valor={pesos(resultado)} nota="Margen menos gastos" />
          <Indicador etiqueta="Cobrado" valor={pesos(f.cobrado)} />
        </div>
        <Caja>
          <p className="mb-3 font-semibold">Gastos por categoría</p>
          <Barras filas={t.gastos.map((g) => ({ etiqueta: CATEGORIA[g.categoria] ?? g.categoria, valor: g.total, texto: pesos(g.total) }))} vacio="Sin gastos registrados en este periodo." />
          <Link href="/interno/gastos" className="mt-4 inline-block text-[14px] font-semibold text-azul">Registrar un gasto ›</Link>
        </Caja>
      </Seccion>

      <div className="grid gap-6 lg:grid-cols-2">
        <Seccion titulo="Mostrador">
          <div className="grid grid-cols-2 gap-3">
            <Indicador etiqueta="Ventas de mostrador" valor={pesos(t.mostrador.ventas)} nota={`${t.mostrador.tickets} tickets`} />
            <Indicador etiqueta="Ticket promedio" valor={t.mostrador.tickets ? pesos(t.mostrador.ventas / t.mostrador.tickets) : "—"} nota={t.mostrador.ventas ? `Margen ${Math.round(((t.mostrador.ventas / 1.16 - t.mostrador.costo) / (t.mostrador.ventas / 1.16)) * 100)}% sin IVA` : undefined} />
          </div>
          <Caja>
            <p className="mb-3 font-semibold">Cobrado por forma de pago</p>
            <Barras filas={t.formas.map((x) => ({ etiqueta: x.forma, valor: x.total, texto: pesos(x.total) }))} vacio="Sin ventas de mostrador." />
            {t.cortes.length > 0 && (
              <>
                <p className="mb-2 mt-5 flex justify-between font-semibold">Cortes de caja <Link href="/interno/mostrador/cortes" className="text-[14px] text-azul">Ver reporte ›</Link></p>
                <ul className="divide-y divide-linea text-[14px]">
                  {t.cortes.map((c) => {
                    const dif = c.contado - c.esperado;
                    return <li key={c.id} className="flex justify-between py-1.5"><span>{c.fecha} · {c.quien}</span><span className={`tabular-nums ${Math.abs(dif) >= 1 ? "font-semibold text-red-700" : "text-secundario"}`}>{Math.abs(dif) < 1 ? "Cuadró" : `${dif > 0 ? "Sobran" : "Faltan"} ${pesos(Math.abs(dif))}`}</span></li>;
                  })}
                </ul>
              </>
            )}
          </Caja>
        </Seccion>
        <Seccion titulo="Inventario">
          <div className="grid grid-cols-2 gap-3">
            <Indicador etiqueta="Valor a costo" valor={pesos(t.inventario.valor)} />
            <Indicador etiqueta="Bajo mínimo" valor={String(t.inventario.bajo)} nota={t.inventario.negativos ? `${t.inventario.negativos} en negativo` : undefined} />
            <Indicador etiqueta="Ajustes por conteo" valor={String(t.inventario.ajustes)} nota="en el periodo" />
            <Indicador etiqueta="Faltante por conteo" valor={pesos(t.inventario.perdida)} nota="A costo promedio" />
          </div>
          <Link href="/interno/inventario" className="inline-block text-[14px] font-semibold text-azul">Ver inventario ›</Link>
        </Seccion>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Seccion titulo="Flotilla">
          <Caja>
            {t.flotilla.length === 0 ? <p className="text-[14px] text-secundario">Da de alta tus vehículos en <Link href="/interno/flotilla" className="text-azul">Flotilla</Link>.</p> : (
              <table className="w-full text-left text-[14px]">
                <thead className="text-[12px] text-secundario"><tr><th className="pb-2">Vehículo</th><th className="text-right">Entregas</th><th className="text-right">Km</th><th className="text-right">Km/L</th><th className="text-right">Gasto</th><th className="text-right">$/km</th><th className="text-right">$/entrega</th></tr></thead>
                <tbody className="divide-y divide-linea tabular-nums">
                  {t.flotilla.map((v) => (
                    <tr key={v.id}><td className="py-2">{v.nombre}<span className="block text-[12px] text-secundario">{v.tipo}</span></td><td className="text-right">{v.entregas}</td><td className="text-right">{km(v) ?? "—"}</td><td className="text-right">{v.litros && km(v) ? (km(v)! / v.litros).toFixed(1) : "—"}</td><td className="text-right">{pesos(v.gasto)}</td><td className="text-right">{km(v) ? `$${(v.gasto / km(v)!).toFixed(1)}` : "—"}</td><td className="text-right">{v.entregas ? pesos(v.gasto / v.entregas) : "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            {t.flotilla.length > 0 && <p className="mt-2 text-[12px] text-secundario">Km: rastreador GPS si lo tiene; si no, odómetro; si no, GPS del teléfono.</p>}
          </Caja>
        </Seccion>
        <Seccion titulo="Nómina">
          <Caja>
            {t.nomina.length === 0 ? <p className="text-[14px] text-secundario">Da de alta a tu personal en <Link href="/interno/flotilla" className="text-azul">Flotilla y personal</Link>.</p> : (
              <table className="w-full text-left text-[14px]">
                <thead className="text-[12px] text-secundario"><tr><th className="pb-2">Persona</th><th>Puesto</th><th className="text-right">Pagado en el periodo</th></tr></thead>
                <tbody className="divide-y divide-linea tabular-nums">
                  {t.nomina.map((n) => <tr key={n.nombre}><td className="py-2">{n.nombre}</td><td>{n.puesto ?? "—"}</td><td className="text-right">{pesos(n.pagado)}</td></tr>)}
                </tbody>
              </table>
            )}
          </Caja>
        </Seccion>
      </div>
    </>
  );
}
