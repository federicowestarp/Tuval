"use client";

import { useEffect, useRef, useState } from "react";

type Reconocedor = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };
type ConstructorReconocedor = new () => Reconocedor;

/** Buscador del quiosco: escribir o tocar el micrófono y decir la pieza ("un codo de media"). */
export function BuscarConVoz({ inicial }: { inicial: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [texto, setTexto] = useState(inicial);
  const [escuchando, setEscuchando] = useState(false);
  const [soportado, setSoportado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const rec = useRef<Reconocedor | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: ConstructorReconocedor; webkitSpeechRecognition?: ConstructorReconocedor };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- solo existe en el navegador
    setSoportado(!!(w.SpeechRecognition ?? w.webkitSpeechRecognition));
  }, []);

  const dictar = () => {
    if (escuchando) { rec.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: ConstructorReconocedor; webkitSpeechRecognition?: ConstructorReconocedor };
    const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!C) return;
    const r = new C();
    r.lang = "es-MX"; r.continuous = false; r.interimResults = true;
    let final = "";
    r.onresult = (e) => {
      const partes = Array.from(e.results);
      final = partes.map((x) => x[0].transcript).join(" ").trim();
      setTexto(final);
    };
    r.onerror = (e) => setAviso(e.error === "not-allowed" ? "Permite el micrófono para dictar." : "No te escuché bien, intenta de nuevo.");
    r.onend = () => {
      setEscuchando(false);
      if (final) { setTexto(final); setTimeout(() => form.current?.requestSubmit(), 50); }
    };
    rec.current = r; setAviso(null); setEscuchando(true); r.start();
  };

  return (
    <form ref={form} className="space-y-2">
      <div className="flex gap-2">
        <input name="q" value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus placeholder="Ej. codo de media, válvula de bola, teflón"
          className="h-14 min-w-0 flex-1 rounded-full border-2 border-linea px-5 text-[18px]" />
        {soportado && (
          <button type="button" onClick={dictar} aria-label={escuchando ? "Dejar de escuchar" : "Dictar"}
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white ${escuchando ? "animate-pulse bg-[#E8590C]" : "bg-[#0B3D91]"}`}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
          </button>
        )}
        <button className="h-14 rounded-full bg-azul px-6 text-[17px] font-semibold text-white">Buscar</button>
      </div>
      {escuchando && <p className="text-[16px] font-semibold text-[#E8590C]">Te escucho… di la pieza que buscas.</p>}
      {aviso && <p className="text-[15px] text-amber-800">{aviso}</p>}
      {soportado && !escuchando && !aviso && <p className="text-[14px] text-secundario">Toca el micrófono y dila como la pides en la tienda: “un codo de media”.</p>}
    </form>
  );
}
