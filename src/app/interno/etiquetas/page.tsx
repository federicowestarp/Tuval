import { Suspense } from "react";
import { connection } from "next/server";
import QRCode from "qrcode";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { urlEtiqueta } from "@/lib/etiqueta";
import { TASA_IVA } from "@/lib/totales";
import { CATEGORIAS } from "@/lib/categorias";
import { NavegacionInterna } from "../Navegacion";
import { Imprimir } from "../mostrador/ticket/[id]/Imprimir";

const mx = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

/**
 * Etiquetas de anaquel: nombre, precio al público con IVA y QR (lleva a la ficha del producto;
 * al equipo le sirve para contar en inventario o ver existencias). Tres por renglón en hoja carta.
 */
export default function Etiquetas(props: PageProps<"/interno/etiquetas">) {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <div className="print:hidden"><NavegacionInterna actual="etiquetas" /></div>
      <Suspense fallback={null}><Contenido searchParams={props.searchParams} /></Suspense>
    </div>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/interno/etiquetas">["searchParams"] }) {
  await connection();
  await requerirInterno("mostrador");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const cat = typeof sp.cat === "string" ? sp.cat : "";
  const todos = sp.todos === "1";
  const buscar = sp.ver === "1";
  const productos = buscar ? await sql<{ id: string; sku: string; nombre: string; unidad: string | null; precio: number | null }[]>`
    select p.id, p.sku, p.nombre, p.unidad, pr.precio::float precio
    from productos p
    left join precios pr on pr.producto_id = p.id and pr.lista_id = (select id from listas_precio where nombre = 'Público')
    where p.activo
      and (${q} = '' or p.nombre ilike ${"%" + q + "%"} or p.sku ilike ${"%" + q + "%"})
      and (${cat} = '' or p.categoria_id = ${cat})
      and (${todos} or exists (select 1 from existencias e join almacenes a on a.id = e.almacen_id where e.producto_id = p.id and a.tipo = 'sucursal' and e.cantidad > 0))
    order by p.nombre limit 300` : [];
  const qrs = await Promise.all(productos.map((p) => QRCode.toString(urlEtiqueta(p.sku), { type: "svg", margin: 0, errorCorrectionLevel: "M" })));
  const hoy = new Date().toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", day: "2-digit", month: "2-digit", year: "2-digit" });
  const sinPrecio = productos.filter((p) => p.precio == null).length;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-6 text-black print:max-w-none print:p-0">
      <form className="grid gap-2 rounded-[20px] bg-niebla p-4 print:hidden sm:grid-cols-[1fr_auto_auto]">
        <h1 className="text-[22px] font-semibold sm:col-span-3">Etiquetas de anaquel</h1>
        <input name="q" defaultValue={q} placeholder="Buscar producto o SKU (vacío = todos)" className="h-11 rounded-full border border-linea bg-white px-4" />
        <select name="cat" defaultValue={cat} aria-label="Categoría" className="h-11 rounded-full border border-linea bg-white px-3">
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <button name="ver" value="1" className="h-11 rounded-full bg-azul px-5 font-semibold text-white">Ver etiquetas</button>
        <label className="flex items-center gap-2 text-[14px] text-secundario sm:col-span-3">
          <input type="checkbox" name="todos" value="1" defaultChecked={todos} className="h-4 w-4" /> Incluir productos sin existencia en sucursal
        </label>
      </form>

      {buscar && (
        <div className="space-y-2 print:hidden">
          <p className="text-[14px]">{productos.length} etiqueta{productos.length === 1 ? "" : "s"}{productos.length === 300 ? " (máximo 300 por impresión; filtra por categoría)" : ""}. Tres por renglón en hoja carta; recórtalas por la línea punteada.</p>
          {sinPrecio > 0 && <p className="text-[14px] font-semibold text-amber-800">{sinPrecio} sin precio en la lista Público: salen con “Precio en caja”.</p>}
          {productos.length > 0 && <Imprimir />}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 print:grid-cols-3 print:gap-0" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
        {productos.map((p, i) => (
          <article key={p.id} className="flex flex-col overflow-hidden rounded-xl border-2 border-[#0B3D91] print:rounded-none print:border print:border-dashed print:border-[#999]" style={{ breakInside: "avoid", pageBreakInside: "avoid", minHeight: "36mm" }}>
            <div className="flex items-center justify-between bg-[#0B3D91] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
              <span>Tuval</span><span className="font-mono normal-case">{p.sku}</span>
            </div>
            <div className="grid flex-1 grid-cols-[minmax(0,1fr)_18mm] items-center gap-2 px-2.5 py-2">
              <div className="min-w-0">
                <p className="line-clamp-2 text-[12px] font-semibold leading-tight">{p.nombre}</p>
                {p.precio != null ? (
                  <p className="mt-1 text-[24px] font-bold leading-none tracking-tight text-[#0B3D91] tabular-nums">{mx(p.precio * (1 + TASA_IVA))}</p>
                ) : <p className="mt-1 text-[15px] font-bold text-[#0B3D91]">Precio en caja</p>}
                <p className="mt-0.5 text-[9px] text-[#555]">{p.precio != null ? `IVA incluido · por ${p.unidad ?? "pieza"} · ${hoy}` : `por ${p.unidad ?? "pieza"}`}</p>
              </div>
              <div className="h-[18mm] w-[18mm] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrs[i] }} />
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
