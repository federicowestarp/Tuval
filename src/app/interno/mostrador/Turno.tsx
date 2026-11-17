"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConteoDenominaciones, conteoVacio } from "@/components/interno/ConteoDenominaciones";
import { campo, clasesBoton, etiqueta } from "@/components/ui";
import { separarFondo, type LineaConteo } from "@/lib/denominaciones";
import { abrirTurno, cerrarTurno, retiroParcial } from "./caja-acciones";

export type CajaParaAbrir = { id: string; nombre: string; sobre: boolean; recibeDe: string | null; ocupadaPor: string | null };

/** Apertura de turno. Al cajero solo se le dice "registrada" o "pendiente de autorización"; nunca cuánto se esperaba. */
export function AperturaTurno({ cajas }: { cajas: CajaParaAbrir[] }) {
  const libres = cajas.filter((c) => !c.ocupadaPor);
  const [caja, setCaja] = useState(libres[0]?.id ?? "");
  const [lineas, setLineas] = useState<LineaConteo[]>(conteoVacio);
  const [sello, setSello] = useState<"integro" | "roto" | "">("");
  const [folio, setFolio] = useState("");
  const [clave, setClave] = useState("");
  const [reintento, setReintento] = useState(false);
  const [msg, setMsg] = useState<{ t: string; error?: boolean } | null>(null);
  const [enviando, iniciar] = useTransition();
  const router = useRouter();
  const c = cajas.find((x) => x.id === caja);

  const abrir = () => iniciar(async () => {
    setMsg(null);
    const r = await abrirTurno({ registradora: caja, lineas, selloIntegro: sello === "integro", folioSello: folio, contrasenaSaliente: clave, reintento });
    if (r.error) { setMsg({ t: r.error, error: true }); return; }
    if (r.recontar) { setReintento(true); setLineas(conteoVacio()); setMsg({ t: r.mensaje!, error: true }); return; }
    setMsg({ t: r.mensaje! });
    router.refresh();
  });

  if (libres.length === 0) return <p className="rounded-[20px] bg-white p-6">Todas las cajas tienen un turno abierto{cajas.map((x) => x.ocupadaPor && ` · ${x.nombre}: ${x.ocupadaPor}`)}.</p>;

  return (
    <section className="mx-auto max-w-2xl space-y-4 rounded-[20px] bg-white p-6">
      <h1 className="font-display text-2xl font-semibold">Abrir turno</h1>
      {libres.length > 1 && (
        <div><label className={etiqueta} htmlFor="caja">Caja</label>
          <select id="caja" value={caja} onChange={(e) => setCaja(e.target.value)} className={campo}>{libres.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select>
        </div>
      )}
      {c?.sobre && (
        <div className="space-y-2 rounded-2xl bg-niebla p-4">
          <p className="font-semibold">Sobre de fondo sellado</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSello("integro")} className={`flex-1 rounded-full px-3 py-2 text-[14px] font-semibold ${sello === "integro" ? "bg-azul text-white" : "bg-white"}`}>El sello está íntegro</button>
            <button type="button" onClick={() => setSello("roto")} className={`flex-1 rounded-full px-3 py-2 text-[14px] font-semibold ${sello === "roto" ? "bg-red-700 text-white" : "bg-white"}`}>Sello roto</button>
          </div>
          <input value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="Folio del sello" className={campo} />
        </div>
      )}
      {c?.recibeDe && (
        <div className="space-y-2 rounded-2xl bg-niebla p-4">
          <p className="font-semibold">Recibes el fondo de {c.recibeDe}</p>
          <p className="text-[14px] text-secundario">Cuenten los dos por separado. {c.recibeDe} confirma la entrega con su contraseña.</p>
          <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder={`Contraseña de ${c.recibeDe}`} className={campo} autoComplete="off" />
        </div>
      )}
      <ConteoDenominaciones valor={lineas} onCambio={setLineas} titulo={reintento ? "Recuento del fondo" : "Cuenta el fondo"} />
      {msg && <p role="alert" className={`font-semibold ${msg.error ? "text-red-700" : "text-azul"}`}>{msg.t}</p>}
      <button type="button" disabled={enviando || !caja || (c?.sobre && !sello)} onClick={abrir} className={clasesBoton("principal", "grande", true)}>{enviando ? "Registrando…" : "Registrar apertura"}</button>
    </section>
  );
}

/** Retiro parcial a caja fuerte: el cajero cuenta lo que saca; sale recibo para el sobre. */
export function RetiroParcial() {
  const [abierto, setAbierto] = useState(false);
  const [lineas, setLineas] = useState<LineaConteo[]>(conteoVacio);
  const [msg, setMsg] = useState<{ t: string; id?: string; error?: boolean } | null>(null);
  const [enviando, iniciar] = useTransition();
  if (!abierto) return <button type="button" onClick={() => setAbierto(true)} className={clasesBoton("secundario", "normal")}>Hacer retiro a caja fuerte</button>;
  return (
    <div className="space-y-3 rounded-[20px] bg-white p-5">
      <p className="font-semibold">Retiro parcial · deja solo el fondo de cambio en la caja</p>
      <ConteoDenominaciones valor={lineas} onCambio={setLineas} titulo="Cuenta lo que retiras" />
      {msg && <p className={`font-semibold ${msg.error ? "text-red-700" : "text-azul"}`}>{msg.t} {msg.id && <Link href={`/interno/mostrador/retiro/${msg.id}`} target="_blank" className="underline">Imprimir recibo</Link>}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={enviando} onClick={() => iniciar(async () => { const r = await retiroParcial(lineas); setMsg(r.error ? { t: r.error, error: true } : { t: r.mensaje!, id: r.id }); if (!r.error) setLineas(conteoVacio()); })} className={clasesBoton("principal", "normal")}>{enviando ? "Registrando…" : "Registrar retiro"}</button>
        <button type="button" onClick={() => setAbierto(false)} className="text-[14px] text-secundario">Cerrar</button>
      </div>
    </div>
  );
}

export type TerminalCaja = { id: string; nombre: string };

/** Cierre ciego: conteo por denominación, separación del fondo, sobre (si es cierre del día) y cierre de lote de cada terminal. */
export function CierreTurno({ terminales, fondoFijo }: { terminales: TerminalCaja[]; fondoFijo: number }) {
  const [lineas, setLineas] = useState<LineaConteo[]>(conteoVacio);
  const [dia, setDia] = useState(true);
  const [folio, setFolio] = useState("");
  const [lotes, setLotes] = useState<Record<string, { total: string; transacciones: string; foto: File | null }>>({});
  const [msg, setMsg] = useState<{ t: string; error?: boolean } | null>(null);
  const [listo, setListo] = useState(false);
  const [enviando, iniciar] = useTransition();
  const sep = separarFondo(lineas, fondoFijo);
  const mx = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

  const cerrar = () => iniciar(async () => {
    setMsg(null);
    const fd = new FormData();
    fd.set("datos", JSON.stringify({ lineas, cierreDia: dia, folioSello: folio, terminales: terminales.map((t) => ({ terminal_id: t.id, total: Number(lotes[t.id]?.total), transacciones: Number(lotes[t.id]?.transacciones) })) }));
    for (const t of terminales) { const f = lotes[t.id]?.foto; if (f) fd.set(`foto_${t.id}`, f); }
    const r = await cerrarTurno(fd);
    if (r.error) setMsg({ t: r.error, error: true }); else { setListo(true); setMsg({ t: r.mensaje! }); }
  });

  if (listo) return <section className="mx-auto max-w-xl rounded-[20px] bg-white p-8 text-center"><p className="font-display text-3xl font-semibold">Cierre registrado</p><Link href="/interno/mostrador" className="mt-4 inline-block text-azul">Volver al mostrador</Link></section>;

  return (
    <section className="mx-auto max-w-3xl space-y-5 rounded-[20px] bg-white p-6">
      <h1 className="font-display text-2xl font-semibold">Cerrar turno</h1>
      <ConteoDenominaciones valor={lineas} onCambio={setLineas} titulo="1 · Cuenta TODO el efectivo de la caja" />
      <div className="rounded-2xl bg-niebla p-4 text-[14px]">
        <p className="font-semibold">2 · Separa el fondo para el siguiente turno ({mx(fondoFijo)})</p>
        <p className="mt-1">Deja en la caja: {sep.fondo.filter((l) => l.piezas).map((l) => `${l.piezas} × $${l.d}`).join(" · ") || "—"}</p>
        {sep.faltante > 0 && <p className="mt-1 font-semibold text-red-700">No alcanza el cambio para el fondo completo: faltan {mx(sep.faltante)}.</p>}
        <p className="mt-1 text-secundario">El resto va a depósito.</p>
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={dia} onChange={(e) => setDia(e.target.checked)} className="h-5 w-5" /> Es el cierre del día (el fondo va en sobre sellado a caja fuerte)</label>
        {dia && <input value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="Folio del sello del sobre" className={campo} />}
        {!dia && <p className="text-[13px] text-secundario">Cambio de turno: el fondo se queda en la caja y el siguiente cajero lo recibe contándolo contigo.</p>}
      </div>
      {terminales.length > 0 && (
        <div className="space-y-3">
          <p className="font-semibold">3 · Cierre de lote de cada terminal (obligatorio aunque sea $0)</p>
          {terminales.map((t) => (
            <div key={t.id} className="grid gap-2 rounded-2xl bg-niebla p-3 sm:grid-cols-3">
              <p className="font-semibold sm:col-span-3">{t.nombre}</p>
              <input inputMode="decimal" placeholder="Total del lote" value={lotes[t.id]?.total ?? ""} onChange={(e) => setLotes({ ...lotes, [t.id]: { ...lotes[t.id], total: e.target.value } })} className={campo} />
              <input inputMode="numeric" placeholder="Núm. de transacciones" value={lotes[t.id]?.transacciones ?? ""} onChange={(e) => setLotes({ ...lotes, [t.id]: { ...lotes[t.id], transacciones: e.target.value } })} className={campo} />
              <label className="text-[13px]">Foto del ticket <input type="file" accept="image/*" capture="environment" onChange={(e) => setLotes({ ...lotes, [t.id]: { ...lotes[t.id], foto: e.target.files?.[0] ?? null } })} className="mt-1 block text-sm" /></label>
            </div>
          ))}
        </div>
      )}
      {msg && <p role="alert" className={`font-semibold ${msg.error ? "text-red-700" : "text-azul"}`}>{msg.t}</p>}
      <button type="button" disabled={enviando} onClick={cerrar} className={clasesBoton("principal", "grande", true)}>{enviando ? "Registrando…" : "Confirmar cierre"}</button>
    </section>
  );
}
