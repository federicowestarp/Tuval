"use client";

import { ElegirArchivo } from "@/components/ElegirArchivo";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConteoDenominaciones, conteoVacio } from "@/components/interno/ConteoDenominaciones";
import { campo, clasesBoton, etiqueta } from "@/components/ui";
import { separarFondo, type LineaConteo } from "@/lib/denominaciones";
import { abrirTurno, cerrarTurno, retiroParcial } from "./caja-acciones";
import { cambiarUsuario } from "./usuario-acciones";

export type CajaParaAbrir = { id: string; nombre: string; recibeDe: string | null; ocupadaPor: string | null };

/** Apertura de turno. Al cajero solo se le dice "registrada" o "pendiente de autorización"; nunca cuánto se esperaba. */
export function AperturaTurno({ cajas }: { cajas: CajaParaAbrir[] }) {
  const libres = cajas.filter((c) => !c.ocupadaPor);
  const [caja, setCaja] = useState(libres[0]?.id ?? "");
  const [lineas, setLineas] = useState<LineaConteo[]>(conteoVacio);
  const [clave, setClave] = useState("");
  const [reintento, setReintento] = useState(false);
  const [msg, setMsg] = useState<{ t: string; error?: boolean } | null>(null);
  const [enviando, iniciar] = useTransition();
  const router = useRouter();
  const c = cajas.find((x) => x.id === caja);

  const abrir = () => iniciar(async () => {
    setMsg(null);
    const r = await abrirTurno({ registradora: caja, lineas, confirmaSaliente: clave, reintento });
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
      {c?.recibeDe && (
        <div className="space-y-2 rounded-2xl bg-niebla p-4">
          <p className="font-semibold">Recibes el fondo de {c.recibeDe}</p>
          <p className="text-[14px] text-secundario">Cuenten los dos por separado. {c.recibeDe} confirma la entrega con su PIN.</p>
          <input type="password" inputMode="numeric" value={clave} onChange={(e) => setClave(e.target.value)} placeholder={`PIN de ${c.recibeDe}`} className={campo} autoComplete="off" />
        </div>
      )}
      <ConteoDenominaciones valor={lineas} onCambio={setLineas} titulo={reintento ? "Recuento del fondo" : "Cuenta el fondo"} />
      {msg && <p role="alert" className={`font-semibold ${msg.error ? "text-red-700" : "text-azul"}`}>{msg.t}</p>}
      <button type="button" disabled={enviando || !caja} onClick={abrir} className={clasesBoton("principal", "grande", true)}>{enviando ? "Registrando…" : "Registrar apertura"}</button>
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

/** Cierre ciego: conteo por denominación, qué dejar de fondo en la caja y cierre de lote de las terminales no conectadas. */
export function CierreTurno({ terminales, fondoFijo }: { terminales: TerminalCaja[]; fondoFijo: number }) {
  const [lineas, setLineas] = useState<LineaConteo[]>(conteoVacio);
  const [lotes, setLotes] = useState<Record<string, { total: string; transacciones: string; foto: File | null }>>({});
  const [msg, setMsg] = useState<{ t: string; error?: boolean } | null>(null);
  const [listo, setListo] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const sep = separarFondo(lineas, fondoFijo);
  const mx = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
  const deposito = sep.deposito.reduce((a, l) => a + l.d * l.piezas, 0);

  const cerrar = () => iniciar(async () => {
    setMsg(null);
    const fd = new FormData();
    fd.set("datos", JSON.stringify({ lineas, terminales: terminales.map((t) => ({ terminal_id: t.id, total: Number(lotes[t.id]?.total), transacciones: Number(lotes[t.id]?.transacciones) })) }));
    for (const t of terminales) { const f = lotes[t.id]?.foto; if (f) fd.set(`foto_${t.id}`, f); }
    const r = await cerrarTurno(fd);
    if (r.error) setMsg({ t: r.error, error: true }); else { setListo(r.id ?? ""); setMsg({ t: r.mensaje! }); }
  });

  if (listo !== null) return (
    <section className="mx-auto max-w-xl space-y-3 rounded-[20px] bg-white p-8 text-center">
      <p className="font-display text-3xl font-semibold">Cierre registrado</p>
      {listo && <a href={`/interno/mostrador/corte/${listo}`} target="_blank" className={clasesBoton("principal", "grande", true)}>Imprimir ticket de corte para firmar</a>}
      <Link href="/interno/mostrador" className="inline-block text-azul">Volver al mostrador</Link>
    </section>
  );

  return (
    <section className="mx-auto max-w-3xl space-y-5 rounded-[20px] bg-white p-6">
      <h1 className="font-display text-2xl font-semibold">Cerrar turno</h1>
      <ConteoDenominaciones valor={lineas} onCambio={setLineas} titulo="1 · Cuenta TODO el efectivo de la caja" />
      <div className="rounded-2xl bg-niebla p-4 text-[14px]">
        <p className="font-semibold">2 · Deja en la caja el fondo de cambio ({mx(fondoFijo)})</p>
        <p className="mt-1">Se queda: {sep.fondo.filter((l) => l.piezas).map((l) => `${l.piezas} × $${l.d}`).join(" · ") || "—"}</p>
        {sep.faltante > 0 && <p className="mt-1 font-semibold text-red-700">No alcanza el cambio para el fondo completo: faltan {mx(sep.faltante)}.</p>}
        <p className="mt-1">Se retira con el ticket de corte: <strong>{mx(deposito)}</strong> ({sep.deposito.filter((l) => l.piezas).map((l) => `${l.piezas} × $${l.d}`).join(" · ") || "nada"})</p>
      </div>
      {terminales.length > 0 && (
        <div className="space-y-3">
          <p className="font-semibold">3 · Cierre de lote de las terminales no conectadas a la app (obligatorio aunque sea $0)</p>
          {terminales.map((t) => (
            <div key={t.id} className="grid gap-2 rounded-2xl bg-niebla p-3 sm:grid-cols-3">
              <p className="font-semibold sm:col-span-3">{t.nombre}</p>
              <input inputMode="decimal" placeholder="Total del lote" value={lotes[t.id]?.total ?? ""} onChange={(e) => setLotes({ ...lotes, [t.id]: { ...lotes[t.id], total: e.target.value } })} className={campo} />
              <input inputMode="numeric" placeholder="Núm. de transacciones" value={lotes[t.id]?.transacciones ?? ""} onChange={(e) => setLotes({ ...lotes, [t.id]: { ...lotes[t.id], transacciones: e.target.value } })} className={campo} />
              <ElegirArchivo accept="image/*" capture="environment" texto="Foto del ticket del lote" onArchivo={(f) => setLotes({ ...lotes, [t.id]: { ...lotes[t.id], foto: f } })} />
            </div>
          ))}
        </div>
      )}
      {msg && <p role="alert" className={`font-semibold ${msg.error ? "text-red-700" : "text-azul"}`}>{msg.t}</p>}
      <button type="button" disabled={enviando} onClick={cerrar} className={clasesBoton("principal", "grande", true)}>{enviando ? "Registrando…" : "Confirmar cierre"}</button>
    </section>
  );
}

/** Cambio rápido de usuario en la caja con PIN (sin cerrar el navegador ni escribir correo). */
export function CambiarUsuario({ usuarios }: { usuarios: { id: string; nombre: string }[] }) {
  const [abierto, setAbierto] = useState(false);
  const [quien, setQuien] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const router = useRouter();
  if (!abierto) return <button type="button" onClick={() => setAbierto(true)} className={clasesBoton("secundario", "chico")}>Cambiar usuario</button>;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm space-y-3 rounded-[20px] bg-white p-6">
        <p className="font-display text-xl font-semibold">¿Quién va a usar la caja?</p>
        <div className="grid grid-cols-2 gap-2">
          {usuarios.map((u) => <button key={u.id} type="button" onClick={() => setQuien(u.id)} className={`rounded-xl px-3 py-3 text-[15px] font-semibold ${quien === u.id ? "bg-azul text-white" : "bg-niebla"}`}>{u.nombre}</button>)}
        </div>
        <input autoFocus type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="PIN" className={`${campo} text-center text-2xl tracking-[0.5em]`} />
        {error && <p role="alert" className="font-semibold text-red-700">{error}</p>}
        <div className="flex gap-2">
          <button type="button" disabled={enviando || !quien || pin.length < 4} onClick={() => iniciar(async () => { const r = await cambiarUsuario(quien, pin); if (r.error) { setError(r.error); setPin(""); } else { setAbierto(false); router.refresh(); } })} className={clasesBoton("principal", "normal")}>{enviando ? "Entrando…" : "Entrar"}</button>
          <button type="button" onClick={() => { setAbierto(false); setPin(""); setError(null); }} className="text-secundario">Cancelar</button>
        </div>
        <p className="text-[12px] text-secundario">Si tienes turno abierto, ciérralo antes de entregar la caja.</p>
      </div>
    </div>
  );
}
