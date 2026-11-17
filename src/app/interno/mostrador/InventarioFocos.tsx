"use client";

import { useMemo, useState } from "react";
import type { ProductoMostrador } from "@/lib/inventario";
import { IconoCategoria } from "@/components/IconoCategoria";
import { IconoCaja } from "@/components/Iconos";
import { CATEGORIAS } from "@/lib/categorias";
import { COLOR_FOCO, NOMBRE_FOCO, focoDe, type Foco } from "@/lib/focos";

export type ProductoInventario = ProductoMostrador & { categoria_id: string; minimo: number | null; imagen_url: string | null };
const POR_PAGINA = 60;
const CON_ICONO = new Set<string>(CATEGORIAS.map((c) => c.id));
const ORDEN: Record<Foco, number> = { verde: 0, amarillo: 1, rojo: 2 };

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
      palabras.every((w) => p.nombre.toLowerCase().includes(w) || p.sku.toLowerCase().includes(w)))
      // Primero lo que sí hay, luego lo que se agota y al final lo agotado.
      .sort((a, b) => ORDEN[focoDe(a)] - ORDEN[focoDe(b)] || a.nombre.localeCompare(b.nombre, "es"));
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
              {f !== "todos" && <span className={`h-2.5 w-2.5 rounded-full ${COLOR_FOCO[f]}`} />}
              {f === "todos" ? `Todos ${productos.length}` : `${NOMBRE_FOCO[f]} ${conteo[f]}`}
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

      {/* Caja de altura fija con scroll propio: la venta y el cobro siguen a la vista. */}
      <div className="h-[28rem] overflow-y-auto rounded-2xl bg-niebla p-2 sm:h-[32rem]">
        {filtrados.length === 0 ? <p className="py-10 text-center text-[14px] text-secundario">Nada con este filtro.</p> : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {filtrados.slice(0, ver).map((p) => {
              const f = focoDe(p);
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => onAgregar(p)} title={`${p.nombre} · ${NOMBRE_FOCO[f]} · clic para agregar`} className="flex h-full w-full flex-col overflow-hidden rounded-xl bg-white text-left ring-1 ring-linea transition hover:ring-azul active:scale-[.98]">
                    <span className="relative flex aspect-[4/3] w-full items-center justify-center bg-piedra">
                      {p.imagen_url
                        // eslint-disable-next-line @next/next/no-img-element -- foto del catálogo
                        ? <img src={p.imagen_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                        : CON_ICONO.has(p.categoria_id)
                          ? <IconoCategoria categoria={p.categoria_id as Parameters<typeof IconoCategoria>[0]["categoria"]} className="h-10 w-10 text-azul/50" />
                          : <IconoCaja className="h-10 w-10 text-azul/40" />}
                      <span className={`absolute left-2 top-2 h-3.5 w-3.5 rounded-full ring-2 ring-white ${COLOR_FOCO[f]}`} aria-label={NOMBRE_FOCO[f]} />
                    </span>
                    <span className="flex flex-1 flex-col p-2.5">
                      <span className="line-clamp-2 text-[13px] font-medium leading-snug">{p.nombre}</span>
                      <span className="mt-auto flex items-baseline justify-between gap-1 pt-1.5 text-[12px]">
                        <span className={`font-semibold tabular-nums ${f === "rojo" ? "text-red-700" : f === "amarillo" ? "text-amber-700" : ""}`}>{p.existencia} {p.unidad === "pieza" ? "pzas" : p.unidad}</span>
                        <span className="text-secundario">{p.precio != null ? `$${(p.precio * 1.16).toFixed(0)}` : "s/precio"}</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {filtrados.length > ver && (
          <button type="button" onClick={() => setVer((v) => v + POR_PAGINA)} className="mt-2 w-full rounded-full bg-white py-2.5 text-[14px] font-semibold text-azul">
            Ver más ({filtrados.length - ver})
          </button>
        )}
      </div>
    </div>
  );
}
