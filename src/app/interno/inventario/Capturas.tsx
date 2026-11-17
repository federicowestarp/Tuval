"use client";

import { useState, useTransition } from "react";
import type { ProductoMostrador } from "@/lib/inventario";
import { BuscadorProducto } from "@/components/interno/BuscadorProducto";
import { campo, clasesBoton, etiqueta } from "@/components/ui";
import { guardarConteo, recibirMercancia } from "./acciones";

type LineaR = ProductoMostrador & { cantidad: string; costoTxt: string };

export function Recibir({ proveedores }: { proveedores: { id: string; nombre: string }[] }) {
  const [lineas, setLineas] = useState<LineaR[]>([]);
  const [proveedor, setProveedor] = useState(proveedores[0]?.id ?? "");
  const [referencia, setReferencia] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const agregar = (p: ProductoMostrador) =>
    setLineas((ls) => {
      const i = ls.findIndex((l) => l.id === p.id);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, cantidad: String((Number(l.cantidad) || 0) + 1) } : l));
      return [...ls, { ...p, cantidad: "1", costoTxt: p.costo != null ? String(p.costo) : "" }];
    });
  const set = (i: number, k: "cantidad" | "costoTxt", v: string) => setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const guardar = () =>
    iniciar(async () => {
      const r = await recibirMercancia({ proveedor: proveedor || null, referencia, lineas: lineas.map((l) => ({ id: l.id, cantidad: Number(l.cantidad), costo: Number(l.costoTxt) || null })) });
      if (r.error) setMsg(r.error);
      else { setMsg(`Entrada guardada: ${r.ok} producto(s).`); setLineas([]); setReferencia(""); }
    });
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className={etiqueta} htmlFor="proveedor">Proveedor</label>
          <select id="proveedor" value={proveedor} onChange={(e) => setProveedor(e.target.value)} className={campo}>
            <option value="">Sin proveedor</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div><label className={etiqueta} htmlFor="ref">Factura o remisión</label><input id="ref" value={referencia} onChange={(e) => setReferencia(e.target.value)} className={campo} /></div>
      </div>
      <BuscadorProducto onElegir={agregar} placeholder="Escanea o busca lo que llegó…" />
      {lineas.length > 0 && (
        <ul className="divide-y divide-linea">
          {lineas.map((l, i) => (
            <li key={l.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 py-2 text-[14px]">
              <span className="min-w-0 truncate">{l.nombre}<span className="block text-[12px] text-secundario">Hay {l.existencia}</span></span>
              <input aria-label="Cantidad" inputMode="decimal" value={l.cantidad} onChange={(e) => set(i, "cantidad", e.target.value)} className="h-9 w-16 rounded-lg border border-linea text-center" />
              <input aria-label="Costo unitario sin IVA" placeholder="Costo s/IVA" inputMode="decimal" value={l.costoTxt} onChange={(e) => set(i, "costoTxt", e.target.value)} className="h-9 w-24 rounded-lg border border-linea px-2 text-right" />
              <button type="button" onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))} className="text-[12px] text-secundario">Quitar</button>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="text-[14px] font-semibold text-azul">{msg}</p>}
      <button type="button" disabled={enviando || lineas.length === 0} onClick={guardar} className={clasesBoton("principal", "normal")}>{enviando ? "Guardando…" : "Guardar entrada"}</button>
    </div>
  );
}

type LineaC = ProductoMostrador & { contado: string };

export function Contar() {
  const [lineas, setLineas] = useState<LineaC[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const agregar = (p: ProductoMostrador) =>
    setLineas((ls) => {
      const i = ls.findIndex((l) => l.id === p.id);
      // Escanear pieza por pieza suma 1 al contado.
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, contado: String((Number(l.contado) || 0) + 1) } : l));
      return [...ls, { ...p, contado: "1" }];
    });
  const guardar = () =>
    iniciar(async () => {
      const r = await guardarConteo({ lineas: lineas.map((l) => ({ id: l.id, contado: Number(l.contado) })) });
      if (r.error) setMsg(r.error);
      else { setMsg(`Conteo guardado. ${r.ajustes} ajuste(s) de existencia.`); setLineas([]); }
    });
  return (
    <div className="space-y-3">
      <p className="text-[14px] text-secundario">Escanea cada pieza (suma 1) o escribe el total contado. Al guardar se ajusta la diferencia contra el sistema.</p>
      <BuscadorProducto onElegir={agregar} placeholder="Escanea o busca lo que vas a contar…" />
      {lineas.length > 0 && (
        <ul className="divide-y divide-linea">
          {lineas.map((l, i) => {
            const dif = (Number(l.contado) || 0) - l.existencia;
            return (
              <li key={l.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2 text-[14px]">
                <span className="min-w-0 truncate">{l.nombre}<span className="block text-[12px] text-secundario">Sistema: {l.existencia}</span></span>
                <input aria-label="Contado" inputMode="decimal" value={l.contado} onChange={(e) => setLineas((ls) => ls.map((x, j) => (j === i ? { ...x, contado: e.target.value } : x)))} className="h-9 w-20 rounded-lg border border-linea text-center" />
                <span className={`w-14 text-right tabular-nums font-semibold ${dif === 0 ? "text-secundario" : "text-red-700"}`}>{dif > 0 ? `+${dif}` : dif}</span>
              </li>
            );
          })}
        </ul>
      )}
      {msg && <p className="text-[14px] font-semibold text-azul">{msg}</p>}
      <button type="button" disabled={enviando || lineas.length === 0} onClick={guardar} className={clasesBoton("principal", "normal")}>{enviando ? "Guardando…" : "Guardar conteo"}</button>
    </div>
  );
}
