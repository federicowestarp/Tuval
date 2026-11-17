"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EscanerQR, skuDeQr } from "@/components/interno/EscanerQR";
import { tomarPieza } from "../acciones";

/** Escanear la etiqueta de la pieza para confirmar que es la correcta; al confirmar se descuenta del inventario. */
export function SurtirPartida({ partidaId, sku, nombre, falta, unidad }: { partidaId: string; sku: string; nombre: string; falta: number; unidad: string }) {
  const [escaneando, setEscaneando] = useState(false);
  const [leido, setLeido] = useState<string | null>(null);
  const [escrito, setEscrito] = useState(false);
  const [cantidad, setCantidad] = useState(String(falta));
  const [mensaje, setMensaje] = useState<{ ok: boolean; t: string } | null>(null);
  const [enviando, iniciar] = useTransition();
  const router = useRouter();

  const leer = (texto: string, aMano = false) => {
    setEscrito(aMano);
    setEscaneando(false);
    const s = skuDeQr(texto) ?? texto.trim();
    if (s.toUpperCase() !== sku.toUpperCase()) { setLeido(null); setMensaje({ ok: false, t: `No es esta pieza (leíste ${s}). Busca ${nombre}.` }); navigator.vibrate?.([80, 60, 80]); return; }
    setLeido(s); setMensaje({ ok: true, t: "Pieza correcta ✓ Confirma cuántas tomas." });
  };
  const confirmar = () => iniciar(async () => {
    const r = await tomarPieza(partidaId, leido!, Number(cantidad), !escrito);
    if (r.error) { setMensaje({ ok: false, t: r.error }); return; }
    setMensaje({ ok: true, t: r.completo ? "Pedido completo ✓" : `Tomado ✓${r.restante ? ` · faltan ${r.restante}` : ""}` });
    setLeido(null);
    router.refresh();
  });

  return (
    <div className="space-y-2">
      {!leido && <button type="button" onClick={() => { setMensaje(null); setEscaneando(true); }} className="w-full rounded-full bg-azul py-3 font-semibold text-white">Escanear etiqueta para tomar</button>}
      {escaneando && <EscanerQR titulo={`Escanea la etiqueta de ${nombre}`} onLeer={leer} onCerrar={() => setEscaneando(false)} />}
      {leido && (
        <form onSubmit={(e) => { e.preventDefault(); confirmar(); }} className="flex gap-2">
          <input value={cantidad} onChange={(e) => setCantidad(e.target.value)} inputMode="decimal" aria-label="Cantidad que tomas" className="h-12 w-24 rounded-2xl border border-linea text-center text-[20px] font-semibold" />
          <span className="self-center text-[14px] text-secundario">{unidad}</span>
          <button disabled={enviando} className="flex-1 rounded-2xl bg-emerald-600 font-semibold text-white">{enviando ? "Descontando…" : "Tomé, descontar"}</button>
        </form>
      )}
      {mensaje && <p className={`text-[14px] font-semibold ${mensaje.ok ? "text-emerald-700" : "text-red-700"}`}>{mensaje.t}</p>}
    </div>
  );
}
