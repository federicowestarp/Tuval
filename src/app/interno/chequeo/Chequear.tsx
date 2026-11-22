"use client";

import { useState, useTransition } from "react";
import { EscanerQR, skuDeQr } from "@/components/interno/EscanerQR";
import type { EstadoChequeo } from "./acciones";
import { enviarOGuardar } from "@/lib/cola";

/**
 * Un chequeo: primero escanea la etiqueta del anaquel (confirma que la etiqueta corresponde al producto),
 * luego cuenta a ciegas. Si no hay etiqueta, se puede contar igual y queda marcado.
 */
export function Chequear({ id, sku, nombre, ubicacion }: { id: string; sku: string; nombre: string; ubicacion: string | null }) {
  const [paso, setPaso] = useState<"inicio" | "escaner" | "contar" | "hecho">("inicio");
  const [etiquetaOk, setEtiquetaOk] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  const leer = (texto: string) => {
    const leido = skuDeQr(texto) ?? (texto.includes("/") ? null : texto.trim());
    if (leido && leido.toUpperCase() === sku.toUpperCase()) { setEtiquetaOk(true); setAviso("Etiqueta correcta ✓"); }
    else { setEtiquetaOk(false); setAviso(leido ? `La etiqueta es de otro producto (${leido}). Avisa para corregirla y cuenta lo que hay de ${nombre}.` : "Ese QR no es una etiqueta de Tuval."); }
    setPaso("contar");
  };
  const guardar = () => iniciar(async () => {
    const env = await enviarOGuardar("registrarChequeo", [id, Number(cantidad.replace(",", ".")), etiquetaOk], `Chequeo de anaquel · ${nombre}`);
    if (env.estado === "error") { setAviso(env.error); return; }
    if (env.estado === "guardado") { setResultado("Guardado sin señal ✓ Se envía solo al volver la conexión."); setPaso("hecho"); return; }
    const r = env.respuesta.resultado as EstadoChequeo;
    setResultado(r.diferencia ? "Guardado. No cuadra con el sistema: supervisión lo va a revisar." : "Guardado ✓ Cuadra con el sistema.");
    setPaso("hecho");
  });

  return (
    <li className="space-y-2 rounded-2xl bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold leading-tight">{nombre}</p>
          <p className="text-[13px] text-secundario">SKU {sku}{ubicacion ? ` · ${ubicacion}` : " · sin ubicación capturada"}</p>
        </div>
        {paso === "hecho" && <span className="shrink-0 text-emerald-700">✓</span>}
      </div>
      {paso === "inicio" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setPaso("escaner")} className="rounded-full bg-azul px-4 py-2 text-[14px] font-semibold text-white">Escanear etiqueta</button>
          <button type="button" onClick={() => { setEtiquetaOk(false); setAviso("Sin etiqueta: cuenta igual y se marca para imprimirla."); setPaso("contar"); }} className="rounded-full border border-linea px-4 py-2 text-[14px]">No tiene etiqueta</button>
        </div>
      )}
      {paso === "escaner" && <EscanerQR titulo={`Escanea la etiqueta de ${nombre}`} onLeer={leer} onCerrar={() => setPaso("inicio")} />}
      {aviso && paso !== "hecho" && <p className={`text-[14px] ${etiquetaOk ? "text-emerald-700" : "text-amber-800"}`}>{aviso}</p>}
      {paso === "contar" && (
        <form onSubmit={(e) => { e.preventDefault(); guardar(); }} className="flex gap-2">
          <input value={cantidad} onChange={(e) => setCantidad(e.target.value)} inputMode="decimal" required autoFocus placeholder="¿Cuántas hay?" aria-label={`Piezas de ${nombre}`} className="h-12 min-w-0 flex-1 rounded-2xl border border-linea px-4 text-[20px]" />
          <button disabled={enviando} className="rounded-2xl bg-azul px-5 font-semibold text-white">{enviando ? "…" : "Guardar"}</button>
        </form>
      )}
      {resultado && <p className="text-[14px] font-semibold">{resultado}</p>}
    </li>
  );
}
