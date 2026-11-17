"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { ProductoMostrador } from "@/lib/inventario";
import { BuscadorProducto } from "@/components/interno/BuscadorProducto";
import { Segmentado } from "@/components/Segmentado";
import { campo, clasesBoton, etiqueta } from "@/components/ui";
import { registrarVenta } from "./acciones";
import { sinIva, totalesVenta } from "@/lib/totales";
import { InventarioFocos, type ProductoInventario } from "./InventarioFocos";

type Linea = ProductoMostrador & { cantidad: number; manual: string };
const IVA = 0.16;
const mx = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export function PuntoDeVenta({ inventario, categorias }: { inventario: ProductoInventario[]; categorias: { id: string; nombre: string }[] }) {
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [forma, setForma] = useState<"efectivo" | "tarjeta" | "transferencia">("efectivo");
  const [comprobante, setComprobante] = useState<"nota" | "factura">("nota");
  const [recibido, setRecibido] = useState("");
  const [referencia, setReferencia] = useState("");
  const [cliente, setCliente] = useState({ nombre: "", telefono: "", rfc: "", razon: "", cp: "", regimen: "", uso: "G03" });
  const [error, setError] = useState<string | null>(null);
  const [hecha, setHecha] = useState<{ id: string; folio: string; cambio: number } | null>(null);
  const [enviando, iniciar] = useTransition();

  const agregar = (p: ProductoMostrador) => {
    setHecha(null);
    setLineas((ls) => {
      const i = ls.findIndex((l) => l.id === p.id);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, cantidad: l.cantidad + 1 } : l));
      return [...ls, { ...p, cantidad: 1, manual: "" }];
    });
  };
  // Mismo cálculo que el servidor (src/lib/totales.ts): total con IVA por renglón, sin centavos fantasma.
  const precioSinIva = (l: Linea) => (l.precio != null ? l.precio : sinIva(Number(l.manual) || 0));
  const precioConIva = (l: Linea) => precioSinIva(l) * (1 + IVA);
  const { total } = totalesVenta(lineas.map((l) => ({ precio: precioSinIva(l), cantidad: l.cantidad })));
  const cambio = forma === "efectivo" ? (Number(recibido) || 0) - total : 0;
  const sinExistencia = lineas.filter((l) => l.cantidad > l.existencia);

  const cobrar = () => {
    setError(null);
    iniciar(async () => {
      const r = await registrarVenta({
        lineas: lineas.map((l) => ({ id: l.id, cantidad: l.cantidad, precio: l.precio == null ? Number(l.manual) || null : null })),
        forma, recibido: Number(recibido) || null, referencia, comprobante, cliente,
      });
      if (r.error) { setError(r.error); return; }
      setHecha({ id: r.id!, folio: r.folio!, cambio });
      setLineas([]); setRecibido(""); setReferencia("");
      setCliente({ nombre: "", telefono: "", rfc: "", razon: "", cp: "", regimen: "", uso: "G03" });
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <section className="space-y-3 rounded-[20px] bg-white p-4">
        <BuscadorProducto onElegir={agregar} />
        {hecha && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-niebla p-4">
            <p className="font-semibold">Venta {hecha.folio} registrada{hecha.cambio > 0 && <> · Cambio: <span className="text-azul">{mx(hecha.cambio)}</span></>}</p>
            <Link href={`/interno/mostrador/ticket/${hecha.id}`} target="_blank" className={clasesBoton("secundario", "chico")}>Imprimir ticket</Link>
          </div>
        )}
        {lineas.length === 0 ? (
          <p className="py-10 text-center text-secundario">Escanea un código o busca un producto.</p>
        ) : (
          <ul className="divide-y divide-linea">
            {lineas.map((l, i) => (
              <li key={l.id} className="grid grid-cols-[1fr_auto] items-center gap-3 py-3 sm:grid-cols-[1fr_auto_auto_auto]">
                <div className="min-w-0">
                  <p className="truncate text-[15px]">{l.nombre}</p>
                  <p className={`text-[12px] ${l.cantidad > l.existencia ? "text-red-700" : "text-secundario"}`}>{l.sku} · {l.existencia} en sucursal</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="Menos" onClick={() => setLineas((ls) => ls.map((x, j) => (j === i ? { ...x, cantidad: Math.max(1, x.cantidad - 1) } : x)))} className="h-9 w-9 rounded-full bg-niebla text-lg">−</button>
                  <input aria-label="Cantidad" inputMode="decimal" value={l.cantidad} onChange={(e) => setLineas((ls) => ls.map((x, j) => (j === i ? { ...x, cantidad: Math.max(0, Number(e.target.value) || 0) } : x)))} className="h-9 w-14 rounded-lg border border-linea text-center tabular-nums" />
                  <button type="button" aria-label="Más" onClick={() => setLineas((ls) => ls.map((x, j) => (j === i ? { ...x, cantidad: x.cantidad + 1 } : x)))} className="h-9 w-9 rounded-full bg-niebla text-lg">+</button>
                </div>
                {l.precio != null ? (
                  <span className="text-right tabular-nums font-semibold sm:w-28">{mx(precioConIva(l) * l.cantidad)}</span>
                ) : (
                  <input aria-label="Precio con IVA" placeholder="Precio c/IVA" inputMode="decimal" value={l.manual} onChange={(e) => setLineas((ls) => ls.map((x, j) => (j === i ? { ...x, manual: e.target.value } : x)))} className="h-9 w-28 rounded-lg border border-red-300 px-2 text-right" />
                )}
                <button type="button" onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))} className="text-[13px] text-secundario hover:text-red-700">Quitar</button>
              </li>
            ))}
          </ul>
        )}
        {sinExistencia.length > 0 && <p className="rounded-xl bg-niebla p-3 text-[13px]">Ojo: {sinExistencia.length} producto(s) con más cantidad que la existencia en sistema. Se puede vender; la existencia quedará negativa y aparecerá en Inventario para revisar.</p>}
        <InventarioFocos productos={inventario} categorias={categorias} onAgregar={agregar} />
      </section>

      <aside className="space-y-4 rounded-[20px] bg-white p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-secundario">Total con IVA</span>
          <span className="font-display text-[34px] font-semibold tabular-nums">{mx(total)}</span>
        </div>
        <div>
          <p className={etiqueta}>Forma de pago</p>
          <Segmentado name="forma" valor={forma} onCambio={(v) => setForma(v as typeof forma)} opciones={[{ id: "efectivo", texto: "Efectivo" }, { id: "tarjeta", texto: "Tarjeta" }, { id: "transferencia", texto: "Transfer." }]} />
        </div>
        {forma === "efectivo" ? (
          <div>
            <label className={etiqueta} htmlFor="recibido">Recibido</label>
            <input id="recibido" inputMode="decimal" value={recibido} onChange={(e) => setRecibido(e.target.value)} className={campo} />
            {Number(recibido) > 0 && <p className="mt-1 text-[15px]">Cambio: <strong className={cambio < 0 ? "text-red-700" : "text-azul"}>{mx(Math.max(0, cambio))}</strong>{cambio < 0 && " · falta dinero"}</p>}
          </div>
        ) : (
          <div>
            <label className={etiqueta} htmlFor="referencia">{forma === "tarjeta" ? "Autorización de la terminal" : "Referencia"}</label>
            <input id="referencia" value={referencia} onChange={(e) => setReferencia(e.target.value)} className={campo} />
          </div>
        )}
        <div>
          <p className={etiqueta}>Comprobante</p>
          <Segmentado name="comprobante" valor={comprobante} onCambio={(v) => setComprobante(v as typeof comprobante)} opciones={[{ id: "nota", texto: "Nota" }, { id: "factura", texto: "Factura" }]} />
        </div>
        <div className="grid gap-2">
          <input placeholder="Cliente (opcional)" value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} className={campo} />
          {comprobante === "factura" && (
            <>
              <input placeholder="RFC" value={cliente.rfc} onChange={(e) => setCliente({ ...cliente, rfc: e.target.value.toUpperCase() })} className={campo} />
              <input placeholder="Razón social" value={cliente.razon} onChange={(e) => setCliente({ ...cliente, razon: e.target.value })} className={campo} />
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="C.P. fiscal" inputMode="numeric" value={cliente.cp} onChange={(e) => setCliente({ ...cliente, cp: e.target.value })} className={campo} />
                <input placeholder="Régimen (ej. 601)" value={cliente.regimen} onChange={(e) => setCliente({ ...cliente, regimen: e.target.value })} className={campo} />
              </div>
              <p className="text-[12px] text-secundario">La factura queda pendiente de timbrar hasta conectar el PAC.</p>
            </>
          )}
        </div>
        {error && <p role="alert" className="font-semibold text-red-700">{error}</p>}
        <button type="button" disabled={enviando || lineas.length === 0} onClick={cobrar} className={clasesBoton("principal", "grande", true)}>
          {enviando ? "Registrando…" : `Cobrar ${mx(total)}`}
        </button>
      </aside>
    </div>
  );
}
