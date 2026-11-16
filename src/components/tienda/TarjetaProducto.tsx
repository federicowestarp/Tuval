"use client";

import { useCarrito } from "@/components/carrito/CarritoProvider";
import { IconoCategoria } from "@/components/IconoCategoria";
import { IconoMas, IconoMenos } from "@/components/Iconos";
import { formatoMoneda } from "@/lib/catalogo-formato";
import { CATEGORIAS, esCategoria } from "@/lib/categorias";

type Props = {
  id: string; sku: string; nombre: string; unidad: string; categoria: string;
  atributos: Record<string, string>; precio: number | null;
};

/** Tarjeta (manual v2): fondo niebla, imagen sobre blanco, categoría 13 px, nombre y precio en Inter Tight 600. */
export function TarjetaProducto(p: Props) {
  const { lineas, agregar, cambiar } = useCarrito();
  const enCarrito = lineas.find((l) => l.id === p.id)?.cantidad ?? 0;
  const detalle = Object.values(p.atributos).filter(Boolean).join(" · ");
  const categoria = CATEGORIAS.find((c) => c.id === p.categoria)?.nombre;

  return (
    <article className="flex flex-col rounded-[20px] bg-niebla p-3">
      <div className="flex aspect-square items-center justify-center rounded-2xl bg-white text-azul">
        {esCategoria(p.categoria) ? <IconoCategoria categoria={p.categoria} className="h-12 w-12" /> : <span className="text-[13px] text-secundario">Sin foto</span>}
      </div>
      <div className="flex flex-1 flex-col px-1 pb-1 pt-3">
        {categoria && <p className="text-[13px] text-secundario">{categoria}</p>}
        <h2 className="font-display text-[16px] font-semibold leading-snug">{p.nombre}</h2>
        {detalle && <p className="mt-0.5 text-[13px] text-secundario">{detalle}</p>}
        <p className="mt-3 font-display text-[22px] font-semibold tracking-[-0.02em]">
          {p.precio != null ? formatoMoneda(p.precio) : <span className="font-sans text-[13px] font-normal tracking-normal text-secundario">Precio a confirmar</span>}
        </p>
        <div className="mt-auto pt-3">
          {enCarrito === 0 ? (
            <button
              onClick={() => agregar({ id: p.id, sku: p.sku, nombre: p.nombre, unidad: p.unidad })}
              aria-label={`Agregar ${p.nombre}`}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-azul text-[14px] font-semibold text-white transition active:scale-[.98]"
            >
              <IconoMas className="h-4 w-4" /> Agregar
            </button>
          ) : (
            <div className="aparecer flex h-11 items-center justify-between rounded-full bg-white ring-1 ring-linea">
              <button onClick={() => cambiar(p.id, enCarrito - 1)} aria-label="Quitar uno" className="flex h-11 w-11 items-center justify-center text-azul"><IconoMenos className="h-4 w-4" /></button>
              <span className="text-[15px] font-semibold">{enCarrito}</span>
              <button onClick={() => cambiar(p.id, enCarrito + 1)} aria-label="Agregar uno" className="flex h-11 w-11 items-center justify-center text-azul"><IconoMas className="h-4 w-4" /></button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
