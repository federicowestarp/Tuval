import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { fechaHora, listarCortes } from "@/lib/cortes";
import { conciliacion } from "@/lib/caja";
import { urlArchivo } from "@/lib/url-archivo";
import { Esqueleto } from "@/components/interno/Esqueleto";
import { pesos } from "@/components/interno/Indicadores";
import { NavegacionInterna } from "../../../Navegacion";
import { BotonImprimir } from "./BotonImprimir";

/** Reporte de cierre de un turno de caja (se puede imprimir o guardar en PDF). */
export default function Corte(props: PageProps<"/interno/mostrador/cortes/[id]">) {
  return (
    <div className="flex flex-1 flex-col bg-niebla print:bg-white">
      <div className="print:hidden"><NavegacionInterna actual="cortes" /></div>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">
        <Suspense fallback={<Esqueleto />}><Contenido params={props.params} /></Suspense>
      </main>
    </div>
  );
}

async function Contenido({ params }: { params: PageProps<"/interno/mostrador/cortes/[id]">["params"] }) {
  await connection();
  await requerirInterno("supervisor");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [c] = await listarCortes({ id, limite: 1 });
  if (!c) notFound();
  const [ventas, productos, conc, conteos] = await Promise.all([
    sql<{ id: string; folio: string; hora: string; total: number; forma: string; comprobante: string; referencia_pasarela: string | null }[]>`
      select p.id, p.folio, to_char(p.creado_en at time zone 'America/Mexico_City', 'HH24:MI') hora, g.monto::float total, g.forma, p.comprobante, g.referencia_pasarela
      from pagos g join pedidos p on p.id = g.pedido_id where g.caja_id = ${id} order by p.creado_en`,
    sql<{ nombre: string; cantidad: number; importe: number }[]>`
      select pr.nombre, sum(pp.cantidad)::float cantidad, sum(pp.cantidad * pp.precio_unitario * 1.16)::float importe
      from pagos g join pedido_partidas pp on pp.pedido_id = g.pedido_id join productos pr on pr.id = pp.producto_id
      where g.caja_id = ${id} group by pr.nombre order by importe desc limit 30`,
    conciliacion(id),
    sql<{ id: string; tipo: string; quien: string; creado_en: Date; total: number }[]>`
      select cc.id, cc.tipo, u.nombre quien, cc.creado_en, cc.total::float total from conteos_caja cc join usuarios_internos u on u.id = cc.usuario_id
      where cc.turno_id = ${id} order by cc.creado_en`,
  ]);
  const dif = c.contado != null ? c.contado - c.esperado : null;
  const fila = (t: string, v: string, fuerte = false) => <div className={`flex justify-between py-1.5 ${fuerte ? "font-semibold" : ""}`}><span>{t}</span><span className="tabular-nums">{v}</span></div>;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/interno/mostrador/cortes" className="text-[14px] text-azul">‹ Todos los cortes</Link>
        <BotonImprimir />
      </div>
      <section className="space-y-4 rounded-[20px] bg-white p-6 print:p-0">
        <div>
          <p className="text-[13px] text-secundario">Corte de caja · Sucursal</p>
          <h1 className="font-display text-2xl font-semibold">{fechaHora(c.abierta_en)} → {c.cerrada_en ? fechaHora(c.cerrada_en) : "caja abierta"}</h1>
          <p className="text-[14px] text-secundario">Abrió {c.abrio}{c.cerro && ` · cerró ${c.cerro}`} · {c.tickets} tickets</p>
        </div>
        <div className="grid gap-6 text-[15px] sm:grid-cols-2">
          <div className="divide-y divide-linea">
            {fila("Efectivo", pesos(c.efectivo))}
            {fila("Tarjeta", pesos(c.tarjeta))}
            {fila("Transferencia", pesos(c.transferencia))}
            {c.credito > 0 && fila("Crédito", pesos(c.credito))}
            {fila("Total vendido", pesos(c.ventas), true)}
          </div>
          <div className="divide-y divide-linea">
            {fila("Fondo inicial", pesos(c.fondo))}
            {fila("+ Efectivo cobrado", pesos(c.efectivo))}
            {fila("= Efectivo esperado", pesos(c.esperado), true)}
            {fila("Efectivo contado", c.contado != null ? pesos(c.contado) : "—")}
            <div className={`flex justify-between py-1.5 font-semibold ${dif == null ? "" : dif <= -1 ? "text-red-700" : dif >= 1 ? "text-amber-700" : "text-emerald-700"}`}>
              <span>Diferencia</span><span className="tabular-nums">{dif == null ? "—" : Math.abs(dif) < 1 ? "Cuadró" : `${dif > 0 ? "Sobran" : "Faltan"} ${pesos(Math.abs(dif))}`}</span>
            </div>
          </div>
        </div>
        {c.notas && <p className="rounded-xl bg-niebla p-3 text-[14px]">Notas: {c.notas}</p>}
      </section>

      <section className="rounded-[20px] bg-white p-6 print:p-0">
        <h2 className="mb-2 font-semibold">Conciliación por método</h2>
        <div className="divide-y divide-linea text-[14px]">
          <p className="flex justify-between py-1.5"><span>Efectivo: fondo {pesos(conc.fondo_apertura)} + ventas {pesos(conc.ventas_efectivo)} − retiros {pesos(conc.retiros)}</span><span className="tabular-nums">esperado {pesos(conc.esperado)}</span></p>
          {conc.terminales.map((t) => (
            <p key={t.terminal_id} className="flex flex-wrap justify-between gap-2 py-1.5">
              <span>{t.nombre}: sistema {pesos(t.ventas)} en {t.transacciones} cobros · lote {t.lote != null ? `${pesos(t.lote)} en ${t.lote_transacciones}` : "sin capturar"}
                {t.foto_id && <> · <a href={urlArchivo(t.foto_id)} target="_blank" className="text-azul">foto del ticket</a></>}</span>
              <span className={`tabular-nums font-semibold ${t.diferencia ? "text-red-700" : "text-emerald-700"}`}>{t.diferencia == null ? "—" : t.diferencia === 0 ? "Cuadra" : pesos(t.diferencia)}</span>
            </p>
          ))}
          <p className="flex justify-between py-1.5"><span>Transferencias: {conc.transferencias.confirmadas} confirmadas · {conc.transferencias.pendientes} pendientes</span><span className="tabular-nums">{pesos(conc.transferencias.monto_confirmado)}{conc.transferencias.monto_pendiente > 0 && ` (+${pesos(conc.transferencias.monto_pendiente)} pendiente)`}</span></p>
          {conteos.map((k) => <p key={k.id} className="py-1.5 text-secundario">Conteo de {k.tipo.replace(/_/g, " ")} · {k.quien} · {fechaHora(k.creado_en)} · {pesos(k.total)}</p>)}
        </div>
      </section>

      <section className="rounded-[20px] bg-white p-6 print:p-0">
        <h2 className="mb-2 font-semibold">Ventas del turno</h2>
        {ventas.length === 0 ? <p className="text-[14px] text-secundario">Sin ventas.</p> : (
          <ul className="divide-y divide-linea text-[14px]">
            {ventas.map((v) => (
              <li key={v.id + v.forma} className="flex justify-between gap-3 py-2">
                <span>{v.hora} · <Link href={`/interno/mostrador/ticket/${v.id}`} target="_blank" className="text-azul">{v.folio}</Link> · {v.forma}{v.referencia_pasarela && ` (${v.referencia_pasarela})`} · {v.comprobante}</span>
                <span className="tabular-nums font-semibold">{pesos(v.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[20px] bg-white p-6 print:p-0">
        <h2 className="mb-2 font-semibold">Lo que más se vendió</h2>
        <ul className="divide-y divide-linea text-[14px]">
          {productos.map((p) => <li key={p.nombre} className="flex justify-between gap-3 py-2"><span className="min-w-0 truncate">{p.cantidad} × {p.nombre}</span><span className="tabular-nums">{pesos(p.importe)}</span></li>)}
        </ul>
      </section>
    </>
  );
}
