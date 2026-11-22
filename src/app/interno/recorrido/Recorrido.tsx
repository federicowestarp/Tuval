"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PUNTOS_RECORRIDO, type PuntoRegistrado } from "@/lib/recorrido";
import { enviarOGuardar } from "@/lib/cola";

const mmss = (ms: number) => { const s = Math.max(0, Math.floor(Math.abs(ms) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

/** Cuenta regresiva al siguiente recorrido y la lista para hacerlo. */
export function Recorrido({ ultimo, cadaMin }: { ultimo: string | null; cadaMin: number }) {
  const router = useRouter();
  const [ahora, setAhora] = useState<number | null>(null);
  const [inicio, setInicio] = useState<string | null>(null);
  const [puntos, setPuntos] = useState<Record<string, PuntoRegistrado>>({});
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [enviando, iniciar] = useTransition();
  useEffect(() => { const f = () => setAhora(Date.now()); f(); const t = setInterval(f, 1000); return () => clearInterval(t); }, []);

  const toca = ultimo ? new Date(ultimo).getTime() + cadaMin * 60000 : null;
  const falta = toca != null && ahora != null ? toca - ahora : null;
  const atrasado = toca == null || (falta != null && falta <= 0);
  const revisados = Object.keys(puntos).length;

  if (!inicio) return (
    <section className={`space-y-3 rounded-[20px] p-5 text-center ${atrasado ? "bg-[#FFF1E6] ring-2 ring-[#E8590C]" : "bg-white"}`}>
      <p className="text-[14px] font-semibold uppercase tracking-wide text-secundario">{atrasado ? "Toca recorrido" : "Siguiente recorrido en"}</p>
      <p className={`font-mono text-[56px] font-bold leading-none tabular-nums ${atrasado ? "text-[#E8590C]" : "text-azul"}`}>
        {falta == null ? (toca == null ? "Ahora" : "…") : atrasado ? `+${mmss(falta)}` : mmss(falta)}
      </p>
      {listo && <p className="font-semibold text-emerald-700">Recorrido guardado ✓</p>}
      <button type="button" onClick={() => { setInicio(new Date().toISOString()); setPuntos({}); setError(null); setListo(false); }} className="h-14 w-full rounded-full bg-azul text-[17px] font-semibold text-white">Iniciar recorrido</button>
      <p className="text-[13px] text-secundario">Cada {cadaMin} minutos. Recorre la tienda completa y revisa estos {PUNTOS_RECORRIDO.length} puntos.</p>
    </section>
  );

  return (
    <section className="space-y-3 rounded-[20px] bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Recorriendo · {revisados}/{PUNTOS_RECORRIDO.length}</p>
        <button type="button" onClick={() => setInicio(null)} className="text-[14px] text-secundario">Cancelar</button>
      </div>
      <ul className="space-y-2">
        {PUNTOS_RECORRIDO.map((p) => {
          const r = puntos[p.id];
          return (
            <li key={p.id} className={`rounded-2xl border p-3 ${r ? (r.ok ? "border-emerald-200 bg-emerald-50" : "border-amber-300 bg-amber-50") : "border-linea"}`}>
              <p className="font-semibold">{p.titulo}</p>
              <p className="text-[13px] text-secundario">{p.detalle}</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setPuntos({ ...puntos, [p.id]: { id: p.id, ok: true } })} className={`h-10 flex-1 rounded-full text-[14px] font-semibold ${r?.ok ? "bg-emerald-600 text-white" : "border border-linea"}`}>Bien</button>
                <button type="button" onClick={() => setPuntos({ ...puntos, [p.id]: { id: p.id, ok: false, nota: r?.nota ?? "" } })} className={`h-10 flex-1 rounded-full text-[14px] font-semibold ${r && !r.ok ? "bg-amber-500 text-white" : "border border-linea"}`}>Hay algo</button>
              </div>
              {r && !r.ok && (
                <input autoFocus value={r.nota ?? ""} onChange={(e) => setPuntos({ ...puntos, [p.id]: { ...r, nota: e.target.value } })} placeholder="¿Qué estaba mal y qué hiciste?" aria-label={`Nota de ${p.titulo}`} className="mt-2 h-10 w-full rounded-full border border-amber-300 bg-white px-4 text-[14px]" />
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="font-semibold text-red-700">{error}</p>}
      <button type="button" disabled={enviando || revisados < PUNTOS_RECORRIDO.length} onClick={() => iniciar(async () => {
        const r = await enviarOGuardar("guardarRecorrido", { iniciado: inicio, puntos: Object.values(puntos) }, "Recorrido de tienda");
        if (r.estado === "error") { setError(r.error); return; }
        setInicio(null); setListo(true); router.refresh();
      })} className="h-14 w-full rounded-full bg-azul text-[17px] font-semibold text-white disabled:opacity-40">
        {enviando ? "Guardando…" : revisados < PUNTOS_RECORRIDO.length ? `Faltan ${PUNTOS_RECORRIDO.length - revisados} puntos` : "Terminar recorrido"}
      </button>
    </section>
  );
}

/** Aviso en caja y en la tablet del vendedor cuando ya toca recorrido. */
export function AvisoRecorrido({ ultimo, cadaMin }: { ultimo: string | null; cadaMin: number }) {
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => { const f = () => setAhora(Date.now()); f(); const t = setInterval(f, 15000); return () => clearInterval(t); }, []);
  if (ahora == null) return null;
  const toca = ultimo ? new Date(ultimo).getTime() + cadaMin * 60000 : 0;
  if (ahora < toca) return null;
  return (
    <a href="/interno/recorrido" className="flex items-center justify-between gap-2 rounded-[20px] bg-[#FFF1E6] p-3 text-[14px] ring-1 ring-[#E8590C]">
      <span><strong>Toca recorrido de tienda.</strong> {ultimo ? `El último fue hace ${Math.round((ahora - new Date(ultimo).getTime()) / 60000)} min.` : "Hoy no se ha hecho ninguno."}</span>
      <span className="shrink-0 font-semibold text-[#E8590C]">Iniciar ›</span>
    </a>
  );
}
