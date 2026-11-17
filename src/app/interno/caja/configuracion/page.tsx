import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { fechaHora } from "@/lib/cortes";
import { Esqueleto } from "@/components/interno/Esqueleto";
import { campo } from "@/components/ui";
import { NavegacionInterna } from "../../Navegacion";
import { asignarTerminal, crearCaja, crearTerminal, guardarParametro } from "../acciones";

export default function Configuracion() {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="supervision" />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-4 py-6">
        <Link href="/interno/caja" className="text-[14px] text-azul">‹ Supervisión de caja</Link>
        <h1 className="font-display text-2xl font-semibold">Cajas, terminales y parámetros</h1>
        <Suspense fallback={<Esqueleto />}><Contenido /></Suspense>
      </main>
    </div>
  );
}

async function Contenido() {
  await connection();
  await requerirInterno("admin");
  const [parametros, cajas, terminales, asignadas, bitacora] = await Promise.all([
    sql<{ clave: string; valor: number; descripcion: string; actualizado_en: Date; quien: string | null }[]>`
      select p.clave, p.valor::float valor, p.descripcion, p.actualizado_en, u.nombre quien from parametros_caja p left join usuarios_internos u on u.id = p.actualizado_por order by p.clave`,
    sql<{ id: string; nombre: string }[]>`select id, nombre from cajas_registradoras where activa order by nombre`,
    sql<{ id: string; nombre: string; proveedor: string | null }[]>`select id, nombre, proveedor from terminales where activa order by nombre`,
    sql<{ registradora_id: string; terminal_id: string }[]>`select registradora_id, terminal_id from caja_terminales`,
    sql<{ id: number; creado_en: Date; quien: string | null; accion: string; detalle: Record<string, unknown> | null; dispositivo: string | null }[]>`
      select b.id, b.creado_en, u.nombre quien, b.accion, b.detalle, b.dispositivo from bitacora_caja b left join usuarios_internos u on u.id = b.usuario_id
      order by b.creado_en desc limit 60`,
  ]);
  return (
    <>
      <section className="rounded-[20px] bg-white p-5">
        <h2 className="mb-2 font-semibold">Parámetros</h2>
        <ul className="divide-y divide-linea text-[14px]">
          {parametros.map((p) => (
            <li key={p.clave} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>{p.descripcion}<span className="block text-[12px] text-secundario">{p.quien ? `Cambió ${p.quien} · ${fechaHora(p.actualizado_en)}` : "Valor inicial"}</span></span>
              <form action={guardarParametro} className="flex gap-1">
                <input type="hidden" name="clave" value={p.clave} />
                <input name="valor" defaultValue={p.valor} inputMode="decimal" className="h-9 w-28 rounded-lg border border-linea px-2 text-right" />
                <button className="text-[13px] text-azul">Guardar</button>
              </form>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-secundario">Cada cambio queda en la bitácora.</p>
      </section>

      <section className="space-y-3 rounded-[20px] bg-white p-5">
        <h2 className="font-semibold">Cajas y terminales</h2>
        {cajas.map((c) => (
          <div key={c.id} className="rounded-xl bg-niebla p-3 text-[14px]">
            <p className="font-semibold">{c.nombre}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {terminales.map((t) => {
                const on = asignadas.some((a) => a.registradora_id === c.id && a.terminal_id === t.id);
                return (
                  <form key={t.id} action={asignarTerminal}>
                    <input type="hidden" name="caja" value={c.id} /><input type="hidden" name="terminal" value={t.id} />
                    {on && <input type="hidden" name="quitar" value="1" />}
                    <button className={`rounded-full px-3 py-1 ${on ? "bg-azul text-white" : "bg-white text-secundario"}`}>{on ? "✓ " : "+ "}{t.nombre}</button>
                  </form>
                );
              })}
              {terminales.length === 0 && <span className="text-secundario">Sin terminales: no se puede cobrar con tarjeta.</span>}
            </div>
          </div>
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          <form action={crearCaja} className="flex gap-2"><input name="nombre" placeholder="Nueva caja (p. ej. Caja 2)" className={campo} /><button className="rounded-full bg-azul px-4 font-semibold text-white">Agregar</button></form>
          <form action={crearTerminal} className="grid gap-2">
            <input name="nombre" placeholder="Nueva terminal (p. ej. Mercado Pago 1)" className={campo} />
            <div className="flex gap-2">
              <input name="proveedor" placeholder="Proveedor" className={campo} />
              <select name="caja" className="h-12 rounded-xl border border-linea px-3"><option value="">Sin asignar</option>{cajas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
              <button className="rounded-full bg-azul px-4 font-semibold text-white">Agregar</button>
            </div>
          </form>
        </div>
      </section>

      <section className="rounded-[20px] bg-white p-5">
        <h2 className="mb-2 font-semibold">Bitácora de caja</h2>
        <ul className="divide-y divide-linea text-[13px]">
          {bitacora.map((b) => (
            <li key={b.id} className="py-1.5"><strong>{b.accion.replace(/_/g, " ")}</strong> · {b.quien ?? "—"} · {fechaHora(b.creado_en)}<span className="block truncate text-secundario">{b.dispositivo ?? "dispositivo no registrado"}{b.detalle && ` · ${JSON.stringify(b.detalle)}`}</span></li>
          ))}
        </ul>
      </section>
    </>
  );
}
