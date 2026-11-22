"use client";

import { useEnLinea } from "@/components/ModoSinConexion";
import { AnilloBoton } from "@/components/Progreso";
import { useState, useTransition } from "react";
import QRCode from "qrcode";
import type { ProductoMostrador } from "@/lib/inventario";
import { BuscadorProducto } from "@/components/interno/BuscadorProducto";
import { EscanerQR, skuDeQr } from "@/components/interno/EscanerQR";
import { TASA_IVA as IVA } from "@/lib/totales";
import { ClienteVenta } from "../mostrador/ClienteVenta";
import type { InfoCliente } from "../mostrador/cliente-acciones";
import { mandarACaja, productoPorEtiqueta } from "../mostrador/tienda-acciones";

type Linea = ProductoMostrador & { cantidad: number };
const mx = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

/** Tablet del vendedor: arma el pedido con el cliente (busca o escanea etiquetas) y lo manda a caja con un código. */
export function VentaAsistida() {
  const enLinea = useEnLinea();
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [cliente, setCliente] = useState<InfoCliente | null>(null);
  const [escaneando, setEscaneando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [listo, setListo] = useState<{ codigo: string; qr: string } | null>(null);
  const [enviando, iniciar] = useTransition();

  const agregar = (p: ProductoMostrador) => {
    setListo(null);
    setLineas((ls) => (ls.some((l) => l.id === p.id) ? ls.map((l) => (l.id === p.id ? { ...l, cantidad: l.cantidad + 1 } : l)) : [...ls, { ...p, cantidad: 1 }]));
  };
  const leer = async (texto: string) => {
    setEscaneando(false);
    const sku = skuDeQr(texto) ?? (/^[A-Za-z0-9-]{2,60}$/.test(texto.trim()) ? texto.trim() : null);
    if (!sku) { setAviso("Ese QR no es una etiqueta de Tuval."); return; }
    const p = await productoPorEtiqueta(sku);
    if (p) { agregar(p); setAviso(`Agregado: ${p.nombre}`); } else setAviso(`No encontré ${sku}.`);
  };
  const total = lineas.reduce((a, l) => a + (l.precio ?? 0) * (1 + IVA) * l.cantidad, 0);
  const sinPrecio = lineas.some((l) => l.precio == null);
  const enviar = () => iniciar(async () => {
    const r = await mandarACaja(lineas.map((l) => ({ id: l.id, cantidad: l.cantidad })), cliente?.id ?? null);
    if (r.error || !r.codigo) { setAviso(r.error ?? "Intenta de nuevo."); return; }
    setListo({ codigo: r.codigo, qr: await QRCode.toString(r.codigo, { type: "svg", margin: 1 }) });
    setLineas([]); setCliente(null); setAviso(null);
  });

  if (listo) return (
    <section className="flex flex-col items-center gap-3 rounded-[20px] bg-white p-6 text-center">
      <p className="text-[18px] font-semibold">Listo: pasa a caja con este código</p>
      <div className="h-48 w-48 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: listo.qr }} />
      <p className="font-mono text-[34px] font-bold tracking-[0.25em] text-azul">{listo.codigo}</p>
      <p className="text-[14px] text-secundario">Enséñalo en caja (o díctalo). La venta queda a tu nombre.</p>
      <button type="button" onClick={() => setListo(null)} className="rounded-full bg-azul px-6 py-3 font-semibold text-white">Atender a otro cliente</button>
    </section>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <section className="space-y-3 rounded-[20px] bg-white p-4">
        <BuscadorProducto onElegir={agregar} placeholder="Busca la pieza…" />
        <button type="button" onClick={() => setEscaneando(true)} className="rounded-full bg-azul px-4 py-2 text-[14px] font-semibold text-white">Escanear etiqueta</button>
        {escaneando && <EscanerQR titulo="Escanea la etiqueta" onLeer={leer} onCerrar={() => setEscaneando(false)} />}
        {aviso && <p className="rounded-xl bg-niebla px-3 py-2 text-[14px]">{aviso}</p>}
        {lineas.length === 0 ? <p className="py-8 text-center text-secundario">Recorre la tienda con el cliente y agrega lo que se va a llevar.</p> : (
          <ul className="divide-y divide-linea">
            {lineas.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px]">{l.nombre}</p>
                  <p className={`text-[12px] ${l.cantidad > l.existencia ? "text-red-700" : "text-secundario"}`}>{l.sku} · {l.existencia} en sucursal</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="Menos" onClick={() => setLineas((ls) => ls.map((x) => (x.id === l.id ? { ...x, cantidad: Math.max(0, x.cantidad - 1) } : x)).filter((x) => x.cantidad > 0))} className="h-9 w-9 rounded-full bg-niebla">−</button>
                  <span className="w-8 text-center tabular-nums">{l.cantidad}</span>
                  <button type="button" aria-label="Más" onClick={() => agregar(l)} className="h-9 w-9 rounded-full bg-niebla">+</button>
                </div>
                <span className="w-24 text-right tabular-nums">{l.precio != null ? mx(l.precio * (1 + IVA) * l.cantidad) : "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <aside className="space-y-3 rounded-[20px] bg-white p-4">
        <p className="flex items-baseline justify-between"><span className="text-secundario">Total aprox. con IVA</span><span className="text-[26px] font-semibold tabular-nums">{mx(total)}</span></p>
        <p className="text-[12px] text-secundario">Precio público; si el cliente tiene lista especial, caja la aplica al cobrar.{sinPrecio ? " Hay piezas sin precio: caja lo captura." : ""}</p>
        <ClienteVenta cliente={cliente} onCambio={setCliente} />
        <button type="button" disabled={enviando || lineas.length === 0 || !enLinea} onClick={enviar} className="w-full rounded-full bg-azul py-3 font-semibold text-white disabled:opacity-40">
          {!enLinea ? "Sin conexión: espera la señal" : enviando ? <span className="inline-flex items-center justify-center gap-3"><AnilloBoton /> Enviando…</span> : "Mandar a caja"}
        </button>
      </aside>
    </div>
  );
}
