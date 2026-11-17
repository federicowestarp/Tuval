"use client";

import { useMemo, useState } from "react";
import type { ProductoMostrador } from "@/lib/inventario";

export type ProductoInventario = ProductoMostrador & { categoria_id: string; minimo: number | null };
type Foco = "verde" | "amarillo" | "rojo";

/** Verde: hay de sobra · Amarillo: en o bajo el mínimo (5 si no hay mínimo) · Rojo: sin existencia. */
export const focoDe = (p: { existencia: number; minimo: number | null }): Foco =>
  p.existencia <= 0 ? "rojo" : p.existencia <= (p.minimo ?? 5) ? "amarillo" : "verde";

const COLOR: Record<Foco, string> = { verde: "bg-emerald-500", amarillo: "bg-amber-400", rojo: "bg-red-500" };
const NOMBRE: Record<Foco, string> = { verde: "Hay", amarillo: "Poco", rojo: "Sin existencia" };
const POR_PAGINA = 40;

export function InventarioFocos({ productos, categorias, onAgregar }: {
  productos: ProductoInventario[];
  categorias: { id: string; nombre: string }[];
  onAgregar: (p: ProductoMostrador) => void;
}) {
  const [q, setQ] = useState("");
  const [foco, setFoco] = useState<Foco | "todos">("todos");
  const [cat, setCat] = useState("");
  const [ver, setVer] = useState(POR_PAGINA);

  const conteo = useMemo(() => {
    const c = { verde: 0, amarillo: 0, rojo: 0 };
    for (const p of productos) c[focoDe(p)]++;
    return c;
  }, [productos]);

  const filtrados = useMemo(() => {
    const palabras = q.toLowerCase().split(/\s+/).filter(Boolean);
    return productos.filter((p) =>
      (foco === "todos" || focoDe(p) === foco) &&
      (!cat || p.categoria_id === cat) &&
      palabras.every((w) => p.nombre.toLowerCase().includes(w) || p.sku.toLowerCase().includes(w)));
  }, [productos, q, foco, cat]);

  return (
    <div className="space-y-3 border-t border-linea pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Inventario de la sucursal</h2>
        <div className="flex flex-wrap gap-1 text-[13px] font-semibold" role="radiogroup" aria-label="Filtrar por existencia">
          {(["todos", "verde", "amarillo", "rojo"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={foco === f}
              onClick={() => { setFoco(f); setVer(POR_PAGINA); }}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${foco === f ? "bg-azul text-white" : "bg-niebla text-secundario hover:text-azul"}`}
            >
              {f !== "todos" && <span className={`h-2.5 w-2.5 rounded-full ${COLOR[f]}`} />}
              {f === "todos" ? `Todos ${productos.length}` : `${NOMBRE[f]} ${conteo[f]}`}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input value={q} onChange={(e) => { setQ(e.target.value); setVer(POR_PAGINA); }} placeholder="Filtrar por nombre o SKU" aria-label="Filtrar inventario" className="h-10 rounded-full border border-linea bg-white px-4 text-[15px]" />
        <select value={cat} onChange={(e) => { setCat(e.target.value); setVer(POR_PAGINA); }} aria-label="Categoría" className="h-10 rounded-full border border-linea bg-white px-3 text-[15px]">
          <option value="">Todas las categorías</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      {filtrados.length === 0 ? <p className="py-6 text-center text-[14px] text-secundario">Nada con este filtro.</p> : (
        <ul className="divide-y divide-linea">
          {filtrados.slice(0, ver).map((p) => {
            const f = focoDe(p);
            return (
              <li key={p.id}>
                <button type="button" onClick={() => onAgregar(p)} title={`${NOMBRE[f]} · clic para agregar a la venta`} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-niebla">
                  <span className={`h-3 w-3 rounded-full ${COLOR[f]}`} aria-label={NOMBRE[f]} />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px]">{p.nombre}</span>
                    <span className="text-[12px] text-secundario">{p.sku}{p.minimo != null && ` · mínimo ${p.minimo}`}</span>
                  </span>
                  <span className="text-right text-[13px]">
                    <span className="block font-semibold tabular-nums">{p.existencia} {p.unidad === "pieza" ? "pzas" : p.unidad}</span>
                    <span className="text-secundario">{p.precio != null ? `$${(p.precio * 1.16).toFixed(2)}` : "sin precio"}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {filtrados.length > ver && (
        <button type="button" onClick={() => setVer((v) => v + POR_PAGINA)} className="w-full rounded-full bg-niebla py-2.5 text-[14px] font-semibold text-azul">
          Ver más ({filtrados.length - ver})
        </button>
      )}
    </div>
  );
}
