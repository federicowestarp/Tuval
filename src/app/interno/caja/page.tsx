import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { puede, requerirInterno } from "@/lib/equipo";
import { conciliacion, parametros } from "@/lib/caja";
import { fechaHora } from "@/lib/cortes";
import { Esqueleto } from "@/components/interno/Esqueleto";
import { pesos } from "@/components/interno/Indicadores";
import { VentaDelDia } from "@/components/interno/VentaDelDia";
import { campo } from "@/components/ui";
import { NavegacionInterna } from "../Navegacion";
import { autorizarApertura, confirmarTransferencia, expirarTransferencias, resolverIncidente } from "./acciones";
import { RecontarRetiro } from "./Recuento";

const TIPO_INCIDENTE: Record<string, string> = {
  diferencia_efectivo: "Diferencia en efectivo", diferencia_terminal: "Diferencia en terminal", diferencia_apertura: "Diferencia en apertura",
  diferencia_retiro: "Diferencia en retiro", sello_roto: "Sello roto", transferencia_manual: "Transferencia manual", diferencia_cambio_turno: "Diferencia en cambio de turno",
};
const caja = "rounded-[20px] bg-white p-5";

export default function Supervision() {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="supervision" />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-display text-2xl font-semibold">Supervisión de caja</h1>
          <Suspense fallback={null}><EnlaceConfig /></Suspense>
        </div>
        <Suspense fallback={<Esqueleto />}><Contenido /></Suspense>
      </main>
    </div>
  );
}

async function EnlaceConfig() {
  const yo = await requerirInterno("supervisor");
  return puede(yo.rol, "admin") ? <Link href="/interno/caja/configuracion" className="text-[14px] text-azul">Cajas, terminales y parámetros ›</Link> : null;
}

async function Contenido() {
  await connection();
  await requerirInterno("supervisor");
  await expirarTransferencias();
  const p = await parametros();
  const [pendientes, incidentes, retiros, transferencias, abiertos, recientes, reincidencia, usuarios] = await Promise.all([
    sql<{ id: string; caja: string; cajero: string; abierta_en: Date }[]>`
      select c.id, r.nombre caja, u.nombre cajero, c.abierta_en from cajas c join cajas_registradoras r on r.id = c.registradora_id
      join usuarios_internos u on u.id = c.abierta_por where c.estado = 'pendiente_autorizacion' order by c.abierta_en`,
    sql<{ id: string; tipo: string; monto: number | null; detalle: string | null; posible: boolean; aviso: boolean; responsable: string | null; creado_en: Date; turno_id: string | null }[]>`
      select i.id, i.tipo, i.monto::float monto, i.detalle, i.posible_metodo_mal_registrado posible, i.dentro_tolerancia aviso, u.nombre responsable, i.creado_en, i.turno_id
      from incidentes_caja i left join usuarios_internos u on u.id = i.responsable_id where i.estado = 'abierto' order by i.creado_en`,
    sql<{ id: string; folio: string; cajero: string; creado_en: Date }[]>`
      select rc.id, rc.folio, u.nombre cajero, rc.creado_en from retiros_caja rc join usuarios_internos u on u.id = rc.cajero_id
      where not exists (select 1 from conteos_caja x where x.corrige_a = rc.conteo_id and x.tipo = 'recuento_retiro') order by rc.creado_en`,
    sql<{ id: string; folio: string; monto: number; vence_en: Date | null; pagado_en: Date }[]>`
      select g.id, p.folio, g.monto::float monto, g.vence_en, g.pagado_en from pagos g join pedidos p on p.id = g.pedido_id
      where g.estado = 'pendiente' order by g.pagado_en`,
    sql<{ id: string; caja: string; cajero: string; abierta_en: Date; horas: number }[]>`
      select c.id, r.nombre caja, u.nombre cajero, c.abierta_en, extract(epoch from now() - c.abierta_en) / 3600 horas
      from cajas c join cajas_registradoras r on r.id = c.registradora_id join usuarios_internos u on u.id = c.abierta_por
      where c.cerrada_en is null and c.estado = 'abierto' order by c.abierta_en`,
    sql<{ id: string; caja: string; cajero: string; cerrada_en: Date; estado: string }[]>`
      select c.id, coalesce(r.nombre, 'Caja') caja, u.nombre cajero, c.cerrada_en, c.estado
      from cajas c left join cajas_registradoras r on r.id = c.registradora_id join usuarios_internos u on u.id = c.abierta_por
      where c.cerrada_en is not null order by c.cerrada_en desc limit 12`,
    sql<{ cajero: string; incidentes: number; monto: number }[]>`
      select u.nombre cajero, count(*)::int incidentes, coalesce(sum(abs(i.monto)), 0)::float monto
      from incidentes_caja i join usuarios_internos u on u.id = i.responsable_id
      where i.creado_en > now() - interval '30 days' and i.tipo <> 'transferencia_manual' group by u.nombre order by incidentes desc, monto desc`,
    sql<{ id: string; nombre: string }[]>`select id, nombre from usuarios_internos where activo order by nombre`,
  ]);
  // Conciliación en vivo de los turnos abiertos (solo supervisor la ve).
  const vivos = await Promise.all(abiertos.map(async (a) => ({ ...a, c: await conciliacion(a.id) })));
  const alertas = [
    ...vivos.filter((v) => v.horas > p.horas_maximas_turno).map((v) => `${v.caja}: turno de ${v.cajero} abierto hace ${Math.floor(v.horas)} h (máximo ${p.horas_maximas_turno} h).`),
    ...vivos.filter((v) => v.c.ventas_efectivo - v.c.retiros > p.umbral_retiro).map((v) => `${v.caja}: ${pesos(v.c.ventas_efectivo - v.c.retiros)} de venta en efectivo en caja; se pidió retiro parcial a ${v.cajero}.`),
  ];

  return (
    <>
      <VentaDelDia />

      {alertas.length > 0 && (
        <section className="space-y-1 rounded-[20px] bg-amber-100 p-4 text-[14px] text-amber-900">
          {alertas.map((a, i) => <p key={i}>⚠ {a}</p>)}
        </section>
      )}

      {pendientes.length > 0 && (
        <section className={caja}>
          <h2 className="mb-2 font-semibold">Aperturas por autorizar</h2>
          {pendientes.map((x) => (
            <form key={x.id} action={autorizarApertura} className="flex flex-wrap items-center justify-between gap-2 border-b border-linea py-2 text-[14px]">
              <span>{x.caja} · {x.cajero} · {fechaHora(x.abierta_en)} (ver incidente abajo)</span>
              <input type="hidden" name="turno" value={x.id} />
              <span className="flex gap-2"><input name="nota" placeholder="Nota (completé / retiré fondo…)" className="h-9 rounded-full border border-linea px-3" /><button className="rounded-full bg-azul px-4 py-1.5 font-semibold text-white">Autorizar apertura</button></span>
            </form>
          ))}
        </section>
      )}

      <section className={caja}>
        <h2 className="mb-2 font-semibold">Incidentes abiertos <span className="text-[13px] font-normal text-secundario">· resolver el mismo día</span></h2>
        {incidentes.length === 0 ? <p className="text-[14px] text-secundario">Sin incidentes abiertos.</p> : incidentes.map((i) => (
          <form key={i.id} action={resolverIncidente} className="space-y-2 border-b border-linea py-3 text-[14px]">
            <p>{i.aviso && <span className="mr-2 rounded-full bg-amber-100 px-2 text-[12px] text-amber-900">aviso · dentro de tolerancia</span>}<strong>{TIPO_INCIDENTE[i.tipo] ?? i.tipo}</strong>{i.monto != null && ` · ${i.monto > 0 ? "sobra" : "falta"} ${pesos(Math.abs(i.monto))}`} · {i.responsable ?? "sin responsable"} · {fechaHora(i.creado_en)}
              {i.turno_id && <> · <Link href={`/interno/mostrador/cortes/${i.turno_id}`} className="text-azul">ver turno</Link></>}</p>
            {i.detalle && <p className="text-secundario">{i.detalle}</p>}
            {i.posible && <p className="font-semibold text-amber-800">Posible método de pago mal registrado (sobrante en un método y faltante en otro).</p>}
            <input type="hidden" name="id" value={i.id} />
            <div className="grid gap-2 sm:grid-cols-[auto_auto_1fr_auto]">
              <select name="resolucion" required className="h-9 rounded-full border border-linea px-3">
                <option value="">Resolución…</option>
                <option value="error_captura">Error de captura (con ajuste)</option>
                <option value="faltante_responsable">Faltante asignado a responsable</option>
                <option value="sobrante_cuenta">Sobrante a cuenta de sobrantes</option>
                <option value="sello_roto_custodia">Sello roto (custodia)</option>
                <option value="autorizado">Autorizado / sin diferencia real</option>
              </select>
              <select name="responsable" className="h-9 rounded-full border border-linea px-3"><option value="">Responsable (igual)</option>{usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
              <input name="nota" required minLength={3} placeholder="Qué pasó y qué se hizo" className="h-9 rounded-full border border-linea px-3" />
              <button className="rounded-full bg-azul px-4 py-1.5 font-semibold text-white">Resolver</button>
            </div>
          </form>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={caja}>
          <h2 className="mb-2 font-semibold">Sobres de retiro por recontar</h2>
          {retiros.length === 0 ? <p className="text-[14px] text-secundario">Nada pendiente.</p> : (
            <div className="flex flex-wrap gap-2">{retiros.map((r) => <RecontarRetiro key={r.id} id={r.id} folio={`${r.folio} · ${r.cajero}`} />)}</div>
          )}
        </section>
        <section className={caja}>
          <h2 className="mb-2 font-semibold">Transferencias pendientes</h2>
          {transferencias.length === 0 ? <p className="text-[14px] text-secundario">Ninguna.</p> : transferencias.map((x) => (
            <details key={x.id} className="border-b border-linea py-2 text-[14px]">
              <summary className="cursor-pointer">{x.folio} · {pesos(x.monto)} · vence {fechaHora(x.vence_en)}</summary>
              <form action={confirmarTransferencia} className="mt-2 grid gap-2">
                <p className="text-[13px] text-secundario">Solo si el cliente transfirió directo a la cuenta. Valida la clave de rastreo en el CEP de Banxico. Nunca por foto o captura del cliente.</p>
                <input type="hidden" name="pago" value={x.id} />
                <input name="clave" required placeholder="Clave de rastreo" className={campo} />
                <input name="banco" required placeholder="Banco emisor" className={campo} />
                <input name="monto" required inputMode="decimal" placeholder="Monto recibido" className={campo} />
                <label className="flex items-center gap-2"><input type="checkbox" name="cep" required /> Validé el comprobante en el CEP de Banxico</label>
                <button className="rounded-full bg-azul px-4 py-2 font-semibold text-white">Confirmar transferencia</button>
              </form>
            </details>
          ))}
        </section>
      </div>

      <section className={caja}>
        <h2 className="mb-2 font-semibold">Turnos abiertos</h2>
        {vivos.length === 0 ? <p className="text-[14px] text-secundario">Ninguno.</p> : (
          <ul className="divide-y divide-linea text-[14px]">
            {vivos.map((v) => (
              <li key={v.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{v.caja} · {v.cajero} · desde {fechaHora(v.abierta_en)}</span>
                <span className="tabular-nums text-secundario">fondo {pesos(v.c.fondo_apertura)} · efectivo vendido {pesos(v.c.ventas_efectivo)} · retirado {pesos(v.c.retiros)} · <strong className="text-tinta">esperado {pesos(v.c.esperado)}</strong></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={caja}>
          <h2 className="mb-2 flex justify-between font-semibold">Últimos cierres <Link href="/interno/mostrador/cortes" className="text-[14px] font-normal text-azul">Todos ›</Link></h2>
          <ul className="divide-y divide-linea text-[14px]">
            {recientes.map((r) => (
              <li key={r.id} className="flex justify-between py-2">
                <Link href={`/interno/mostrador/cortes/${r.id}`} className="text-azul">{r.caja} · {r.cajero} · {fechaHora(r.cerrada_en)}</Link>
                <span className={r.estado === "con_incidente" ? "font-semibold text-red-700" : "text-emerald-700"}>{r.estado === "con_incidente" ? "Con incidente" : r.estado === "conciliado" ? "Conciliado" : r.estado}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className={caja}>
          <h2 className="mb-2 font-semibold">Reincidencia por cajero · 30 días</h2>
          {reincidencia.length === 0 ? <p className="text-[14px] text-secundario">Sin incidentes.</p> : (
            <ul className="divide-y divide-linea text-[14px]">{reincidencia.map((r) => <li key={r.cajero} className="flex justify-between py-2"><span>{r.cajero}</span><span className="tabular-nums">{r.incidentes} incidente(s) · {pesos(r.monto)}</span></li>)}</ul>
          )}
        </section>
      </div>
    </>
  );
}
