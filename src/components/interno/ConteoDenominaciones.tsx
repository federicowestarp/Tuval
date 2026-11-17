"use client";

import { DENOMINACIONES, etiquetaDenominacion, totalDeLineas, type LineaConteo } from "@/lib/denominaciones";

export const conteoVacio = (): LineaConteo[] => DENOMINACIONES.map((d) => ({ d, piezas: 0 }));
const mx = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

/** Conteo por denominación: solo se capturan piezas; el total lo calcula el sistema. */
export function ConteoDenominaciones({ valor, onCambio, titulo = "Cuenta por denominación" }: { valor: LineaConteo[]; onCambio: (v: LineaConteo[]) => void; titulo?: string }) {
  const poner = (d: number, piezas: number) => onCambio(valor.map((l) => (l.d === d ? { ...l, piezas: Math.max(0, Math.floor(piezas) || 0) } : l)));
  return (
    <div className="space-y-2">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-secundario">{titulo}</p>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {valor.map((l) => (
          <li key={l.d} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-xl bg-niebla px-3 py-1.5">
            <span className="text-[14px]">{etiquetaDenominacion(l.d)}</span>
            <span className="flex items-center gap-1">
              <button type="button" aria-label={`Menos ${l.d}`} onClick={() => poner(l.d, l.piezas - 1)} className="h-8 w-8 rounded-full bg-white">−</button>
              <input aria-label={`Piezas de ${l.d}`} inputMode="numeric" value={l.piezas || ""} placeholder="0" onChange={(e) => poner(l.d, Number(e.target.value.replace(/\D/g, "")))} className="h-8 w-14 rounded-lg border border-linea bg-white text-center tabular-nums" />
              <button type="button" aria-label={`Más ${l.d}`} onClick={() => poner(l.d, l.piezas + 1)} className="h-8 w-8 rounded-full bg-white">+</button>
            </span>
            <span className="w-20 text-right text-[13px] tabular-nums text-secundario">{mx(l.d * l.piezas)}</span>
          </li>
        ))}
      </ul>
      <p className="flex justify-between border-t border-linea pt-2 font-semibold"><span>Total contado</span><span className="tabular-nums">{mx(totalDeLineas(valor))}</span></p>
    </div>
  );
}
