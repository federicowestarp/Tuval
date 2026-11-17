"use client";

import { useRef, useState, useTransition } from "react";
import type { ProductoMostrador } from "@/lib/inventario";
import { asignarCodigo, buscarEnSucursal } from "@/app/interno/inventario/busqueda";

const pareceCodigo = (t: string) => /^\d{6,14}$/.test(t);

/**
 * Busca por código de barras (el lector USB escribe como teclado y manda Enter), SKU o texto.
 * Si el código escaneado no existe, deja ligarlo a un producto.
 */
export function BuscadorProducto({ onElegir, placeholder = "Escanea o busca producto…" }: { onElegir: (p: ProductoMostrador) => void; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<ProductoMostrador[]>([]);
  const [sinCodigo, setSinCodigo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, iniciar] = useTransition();
  const ref = useRef<HTMLInputElement>(null);

  const elegir = (p: ProductoMostrador) => {
    if (sinCodigo) {
      const codigo = sinCodigo;
      iniciar(async () => {
        const r = await asignarCodigo(p.id, codigo);
        setAviso(r.error ?? `Código ${codigo} ligado a ${p.nombre}.`);
        if (!r.error) onElegir({ ...p, codigo_barras: codigo });
      });
    } else onElegir(p);
    setQ(""); setRes([]); setSinCodigo(null);
    ref.current?.focus();
  };

  const buscar = (texto: string, enter: boolean) =>
    iniciar(async () => {
      const r = await buscarEnSucursal(texto);
      const t = texto.trim();
      if (!enter) { setRes(r); return; }
      setAviso(null);
      if (r.length === 1 && (r[0].codigo_barras === t || r[0].sku.toUpperCase() === t.toUpperCase())) {
        onElegir(r[0]); setQ(""); setRes([]); return;
      }
      if (r.length === 0 && pareceCodigo(t)) { setSinCodigo(t); setQ(""); setRes([]); return; }
      if (r.length === 0) setAviso("Sin resultados.");
      setRes(r);
    });

  return (
    <div className="relative">
      <input
        ref={ref}
        autoFocus
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          const t = e.target.value.trim();
          if (t.length >= 3 && !pareceCodigo(t)) buscar(t, false);
          if (t.length === 0) setRes([]);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); if (q.trim()) buscar(q, true); }
          if (e.key === "Escape") { setRes([]); setSinCodigo(null); }
        }}
        placeholder={sinCodigo ? `Código ${sinCodigo} sin producto: busca a cuál pertenece` : placeholder}
        aria-label="Buscar producto"
        className="h-12 w-full rounded-full border border-linea bg-white px-5 text-[16px] outline-none focus:border-azul"
      />
      {cargando && <span className="absolute right-5 top-3.5 text-[13px] text-secundario">Buscando…</span>}
      {aviso && <p className="mt-1 px-2 text-[13px] text-secundario">{aviso}</p>}
      {res.length > 0 && (
        <ul className="absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-2xl bg-white p-1 shadow-lg ring-1 ring-linea">
          {res.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => elegir(p)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-niebla">
                <span className="min-w-0">
                  <span className="block truncate text-[15px]">{p.nombre}</span>
                  <span className="text-[12px] text-secundario">{p.sku}{p.codigo_barras && ` · ${p.codigo_barras}`}</span>
                </span>
                <span className="shrink-0 text-right text-[13px]">
                  <span className="block font-semibold">{p.precio != null ? `$${(p.precio * 1.16).toFixed(2)}` : "sin precio"}</span>
                  <span className={p.existencia > 0 ? "text-secundario" : "text-red-700"}>{p.existencia} en sucursal</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
