"use client";

import { useRef, useState, useTransition } from "react";
import type { ProductoMostrador } from "@/lib/inventario";
import { clasesBoton } from "@/components/ui";
import { interpretarDictado, registrarFaltante, type RenglonInterpretado } from "./dictado-acciones";

type Reconocedor = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };
type ConstructorReconocedor = new () => Reconocedor;

/**
 * Lista por voz o pegada: el cajero dicta lo que pide el cliente ("tres coples de media, una pichancha de una pulgada…"),
 * la IA lo pasa a nombres de catálogo y se agregan los productos con un toque. Lo que no tenemos se registra como demanda.
 */
export function Dictado({ onAgregar }: { onAgregar: (p: ProductoMostrador, cantidad: number) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [escuchando, setEscuchando] = useState(false);
  const [renglones, setRenglones] = useState<RenglonInterpretado[]>([]);
  const [hechos, setHechos] = useState<Record<number, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, iniciar] = useTransition();
  const rec = useRef<Reconocedor | null>(null);

  const dictar = () => {
    const w = window as unknown as { SpeechRecognition?: ConstructorReconocedor; webkitSpeechRecognition?: ConstructorReconocedor };
    const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!C) { setAviso("Este navegador no permite dictar. Usa el micrófono del teclado del celular o escribe la lista."); return; }
    if (escuchando) { rec.current?.stop(); return; }
    const r = new C();
    r.lang = "es-MX"; r.continuous = true; r.interimResults = false;
    r.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript + ", ";
      if (t) setTexto((x) => (x ? `${x.replace(/,?\s*$/, "")}, ` : "") + t.replace(/,\s*$/, ""));
    };
    r.onend = () => setEscuchando(false);
    r.onerror = (e) => { setEscuchando(false); setAviso(e.error === "not-allowed" ? "Permite el micrófono para dictar." : "No se pudo dictar; intenta de nuevo."); };
    rec.current = r; r.start(); setEscuchando(true); setAviso(null);
  };

  const interpretar = () => iniciar(async () => {
    const r = await interpretarDictado(texto);
    setAviso(r.error ?? (r.conIA ? null : "Interpretado sin IA (falta configurar la clave de Claude): revisa los renglones."));
    setRenglones(r.renglones); setHechos({});
  });

  const faltante = (i: number, r: RenglonInterpretado, producto?: ProductoMostrador) => iniciar(async () => {
    const res = await registrarFaltante({ descripcion: producto ? producto.nombre : r.descripcion, cantidad: r.cantidad, productoId: producto?.id });
    setHechos((h) => ({ ...h, [i]: res.error ?? "Registrado en Demanda" }));
  });

  if (!abierto) return <button type="button" onClick={() => setAbierto(true)} className={clasesBoton("secundario", "chico")}>🎙 Dictar o pegar lista</button>;

  return (
    <div className="space-y-3 rounded-2xl bg-niebla p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Lista del cliente</p>
        <button type="button" onClick={() => { setAbierto(false); setRenglones([]); setTexto(""); }} className="text-[13px] text-secundario">Cerrar</button>
      </div>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} placeholder="Ej.: tres coples de media, dos codos de 90 de tres cuartos, un rollo de cable del 12, una pichancha de una pulgada" className="w-full rounded-xl border border-linea bg-white p-3 text-[15px]" />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={dictar} className={`${clasesBoton(escuchando ? "principal" : "secundario", "chico")} ${escuchando ? "animate-pulse" : ""}`}>{escuchando ? "● Escuchando… (toca para parar)" : "🎙 Dictar"}</button>
        <button type="button" disabled={cargando || texto.trim().length < 2} onClick={interpretar} className={clasesBoton("principal", "chico")}>{cargando ? "Interpretando…" : "Buscar en catálogo"}</button>
      </div>
      {aviso && <p className="text-[13px] text-amber-800">{aviso}</p>}
      {renglones.length > 0 && (
        <ul className="divide-y divide-linea rounded-xl bg-white">
          {renglones.map((r, i) => {
            const mejor = r.candidatos[0];
            return (
              <li key={i} className="space-y-1.5 p-3 text-[14px]">
                <p><strong>{r.cantidad}</strong> × {r.descripcion} <span className="text-[12px] text-secundario">· “{r.dicho}”</span></p>
                {hechos[i] ? <p className="text-[13px] font-semibold text-azul">{hechos[i]}</p> : r.candidatos.length === 0 ? (
                  <div className="flex flex-wrap items-center gap-2"><span className="text-red-700">No está en el catálogo.</span>
                    <button type="button" onClick={() => faltante(i, r)} className="rounded-full border border-azul px-3 py-1 text-[13px] font-semibold text-azul">Registrar que no lo tenemos</button></div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {r.candidatos.map((c, k) => (
                      <button key={c.id} type="button"
                        onClick={() => { onAgregar(c, r.cantidad); setHechos((h) => ({ ...h, [i]: `Agregado: ${c.nombre}` })); }}
                        className={`rounded-full px-3 py-1 text-[13px] ${k === 0 ? "bg-azul text-white" : "bg-niebla"}`}>
                        {c.nombre} <span className={c.existencia > 0 ? "opacity-70" : "font-semibold text-red-300"}>· {c.existencia > 0 ? `${c.existencia} disp.` : "agotado"}</span>
                      </button>
                    ))}
                    {mejor && mejor.existencia <= 0 && <button type="button" onClick={() => faltante(i, r, mejor)} className="rounded-full border border-azul px-3 py-1 text-[13px] font-semibold text-azul">Agotado: registrar demanda</button>}
                    <button type="button" onClick={() => faltante(i, r)} className="text-[12px] text-secundario underline">No es ninguno: registrar que no lo tenemos</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
