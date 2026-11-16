"use client";

import { useCarrito } from "@/components/carrito/CarritoProvider";
import { IconoCategoria } from "@/components/IconoCategoria";
import { IconoMas, IconoMenos } from "@/components/Iconos";
import { formatoMoneda } from "@/lib/catalogo-formato";
import { esCategoria } from "@/lib/categorias";

type Props = {
  id: string; sku: string; nombre: string; unidad: string; categoria: string;
  atributos: Record<string, string>; precio: number | null;
};

/** Producto: ícono de categoría, nombre, medida, precio y un solo control para agregar/quitar. */
export function TarjetaProducto(p: Props) {
  const { lineas, agregar, cambiar } = useCarrito();
  const enCarrito = lineas.find((l) => l.id === p.id)?.cantidad ?? 0;
  const detalle = Object.values(p.atributos).filter(Boolean).join(" · ");

  return (
    <article className="group flex flex-col rounded-3xl bg-white p-4 ring-1 ring-linea transition hover:shadow-[0_8px_30px_rgba(7,30,61,.06)]">
      <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-niebla text-azul/80">
        {esCategoria(p.categoria) ? <IconoCategoria categoria={p.categoria} className="h-12 w-12" /> : <span className="text-xs text-acero">Sin foto</span>}
      </div>
      <h2 className="mt-4 text-[15px] font-semibold leading-snug">{p.nombre}</h2>
      <p className="mt-0.5 text-[13px] text-acero">{detalle || p.sku}</p>
      <p className="mt-3 font-display text-lg font-bold text-azul">
        {p.precio != null ? formatoMoneda(p.precio) : <span className="text-[13px] font-medium text-acero">Precio a confirmar</span>}
      </p>
      <div className="mt-auto pt-3">
        {enCarrito === 0 ? (
          <button
            onClick={() => agregar({ id: p.id, sku: p.sku, nombre: p.nombre, unidad: p.unidad })}
            aria-label={`Agregar ${p.nombre}`}
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-azul text-[14px] font-semibold text-white transition active:scale-[.98]"
          >
            <IconoMas className="h-4 w-4" /> Agregar
          </button>
        ) : (
          <div className="aparecer flex h-10 items-center justify-between rounded-full bg-niebla">
            <button onClick={() => cambiar(p.id, enCarrito - 1)} aria-label="Quitar uno" className="flex h-10 w-10 items-center justify-center text-azul"><IconoMenos className="h-4 w-4" /></button>
            <span className="text-[15px] font-semibold">{enCarrito}</span>
            <button onClick={() => cambiar(p.id, enCarrito + 1)} aria-label="Agregar uno" className="flex h-10 w-10 items-center justify-center text-azul"><IconoMas className="h-4 w-4" /></button>
          </div>
        )}
      </div>
    </article>
  );
}
