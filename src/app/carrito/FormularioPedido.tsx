"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useCarrito } from "@/components/carrito/CarritoProvider";
import { TarjetaDireccion } from "@/components/TarjetaDireccion";
import type { Direccion } from "@/lib/direcciones";
import { crearPedido, type EstadoFormulario } from "./acciones";

const REGIMENES = [
  ["601", "601 · General de Ley Personas Morales"],
  ["603", "603 · Personas Morales con Fines no Lucrativos"],
  ["605", "605 · Sueldos y Salarios"],
  ["606", "606 · Arrendamiento"],
  ["612", "612 · Personas Físicas con Actividades Empresariales y Profesionales"],
  ["616", "616 · Sin obligaciones fiscales"],
  ["621", "621 · Incorporación Fiscal"],
  ["626", "626 · Régimen Simplificado de Confianza"],
];
const USOS = [
  ["G01", "G01 · Adquisición de mercancías"],
  ["G03", "G03 · Gastos en general"],
  ["I01", "I01 · Construcciones"],
];

const campo = "w-full rounded-lg border border-cianclaro bg-white px-3 py-3 text-base outline-none focus:ring-4 focus:ring-cian";
const etiqueta = "mb-1 block text-sm font-semibold";

type Props = { direcciones: Direccion[]; haySucursal: boolean; nombre: string; telefono: string };

export function FormularioPedido({ direcciones, haySucursal, nombre, telefono }: Props) {
  const { lineas, adjuntos, cambiar, quitarAdjunto } = useCarrito();
  const [estado, accion, enviando] = useActionState<EstadoFormulario, FormData>(crearPedido, {});
  const v = estado.campos ?? {};
  const [comprobante, setComprobante] = useState(v.comprobante ?? "nota");
  const [modo, setModo] = useState(v.modo ?? "envio");
  const [dirId, setDirId] = useState(v.direccion_id ?? direcciones[0]?.id ?? "");

  if (lineas.length === 0 && adjuntos.length === 0) {
    return (
      <div className="mt-6 rounded-xl bg-white p-6">
        <p>Tu carrito está vacío.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/" className="rounded-lg bg-azul px-5 py-3 font-semibold text-white">Ver catálogo</Link>
          <Link href="/lista" className="rounded-lg bg-cian px-5 py-3 font-semibold text-profundo">Pedir con lista</Link>
        </div>
      </div>
    );
  }

  const catalogo = lineas.filter((l) => !l.especial);
  const especiales = lineas.filter((l) => l.especial);

  return (
    <form action={accion} className="mt-6 space-y-6">
      <input type="hidden" name="lineas" value={JSON.stringify(catalogo.map((l) => ({ id: l.id, cantidad: l.cantidad })))} />
      <input type="hidden" name="especiales" value={JSON.stringify(especiales.map((l) => ({ descripcion: l.nombre, cantidad: l.cantidad })))} />
      <input type="hidden" name="adjuntos" value={JSON.stringify(adjuntos.map((a) => a.id))} />

      <section className="rounded-xl bg-white p-4">
        <ul className="divide-y divide-cianclaro">
          {lineas.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold">{l.nombre}</p>
                <p className="text-xs text-acero">
                  {l.especial ? <span className="rounded-full bg-cianclaro px-2 py-0.5 text-profundo">Lo buscamos por ti</span> : `SKU ${l.sku} · ${l.unidad}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Menos" onClick={() => cambiar(l.id, l.cantidad - 1)} className="h-10 w-10 rounded-lg bg-niebla text-xl font-bold text-azul">−</button>
                <span className="w-8 text-center font-semibold">{l.cantidad}</span>
                <button type="button" aria-label="Más" onClick={() => cambiar(l.id, l.cantidad + 1)} className="h-10 w-10 rounded-lg bg-niebla text-xl font-bold text-azul">+</button>
              </div>
            </li>
          ))}
          {adjuntos.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold">📄 {a.nombre}</p>
                <p className="text-xs text-acero">Lista adjunta: la capturamos y te confirmamos</p>
              </div>
              <button type="button" onClick={() => quitarAdjunto(a.id)} className="text-sm text-acero underline">Quitar</button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-acero">
          Confirmamos precios, existencias y hora de entrega antes de surtir. <Link href="/lista" className="underline">Agregar con lista</Link>
        </p>
      </section>

      <section className="space-y-4 rounded-xl bg-white p-4">
        <h2 className="font-display text-xl font-bold">Tus datos</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={etiqueta} htmlFor="nombre">Nombre</label>
            <input id="nombre" name="nombre" defaultValue={v.nombre ?? nombre} className={campo} autoComplete="name" required />
          </div>
          <div>
            <label className={etiqueta} htmlFor="telefono">Celular (WhatsApp)</label>
            <input id="telefono" name="telefono" defaultValue={v.telefono ?? telefono} inputMode="tel" className={campo} autoComplete="tel" required />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl bg-white p-4">
        <h2 className="font-display text-xl font-bold">Entrega</h2>
        <div className="grid grid-cols-2 gap-2">
          <label className={`cursor-pointer rounded-lg border-2 p-3 text-center font-semibold ${modo === "envio" ? "border-azul bg-cianclaro" : "border-cianclaro"}`}>
            <input type="radio" name="modo" value="envio" checked={modo === "envio"} onChange={() => setModo("envio")} className="sr-only" />
            Envío
          </label>
          <label className={`rounded-lg border-2 p-3 text-center font-semibold ${!haySucursal ? "cursor-not-allowed border-niebla text-acero" : modo === "recoger" ? "cursor-pointer border-azul bg-cianclaro" : "cursor-pointer border-cianclaro"}`}>
            <input type="radio" name="modo" value="recoger" disabled={!haySucursal} checked={modo === "recoger"} onChange={() => setModo("recoger")} className="sr-only" />
            Recoger en sucursal
            {!haySucursal && <span className="block text-xs font-normal">Próximamente</span>}
          </label>
        </div>

        {modo === "envio" && (
          <>
            {direcciones.length > 0 ? (
              <fieldset className="min-w-0 space-y-2">
                <legend className={etiqueta}>¿A cuál dirección?</legend>
                {direcciones.map((d) => (
                  <label key={d.id} className={`block cursor-pointer rounded-lg border-2 p-3 ${dirId === d.id ? "border-azul bg-cianclaro" : "border-cianclaro"}`}>
                    <input type="radio" name="direccion_id" value={d.id} checked={dirId === d.id} onChange={() => setDirId(d.id)} className="sr-only" />
                    <TarjetaDireccion d={d} />
                  </label>
                ))}
              </fieldset>
            ) : (
              <p className="rounded-lg bg-niebla p-3 text-sm">Aún no tienes direcciones guardadas.</p>
            )}
            <Link href="/cuenta/direcciones?volver=/carrito" className="inline-block rounded-lg border-2 border-azul px-4 py-2 text-sm font-semibold text-azul">
              + Agregar dirección
            </Link>
            <p className="text-xs text-acero">
              Puebla: pedidos antes de las 12:00 llegan hoy (sábado antes de las 10:00). Atlixco y Tlaxcala: pedidos antes de las 17:00 llegan al día siguiente por la mañana.
            </p>
          </>
        )}
        <div>
          <label className={etiqueta} htmlFor="notas">Notas del pedido (opcional)</label>
          <input id="notas" name="notas" defaultValue={v.notas} className={campo} placeholder="Ej. número de orden de compra" />
        </div>
      </section>

      <section className="space-y-4 rounded-xl bg-white p-4">
        <h2 className="font-display text-xl font-bold">Comprobante</h2>
        <div className="grid grid-cols-2 gap-2">
          {[["nota", "Nota"], ["factura", "Factura"]].map(([id, n]) => (
            <label key={id} className={`cursor-pointer rounded-lg border-2 p-3 text-center font-semibold ${comprobante === id ? "border-azul bg-cianclaro" : "border-cianclaro"}`}>
              <input type="radio" name="comprobante" value={id} checked={comprobante === id} onChange={() => setComprobante(id)} className="sr-only" />
              {n}
            </label>
          ))}
        </div>
        {comprobante === "factura" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={etiqueta} htmlFor="rfc">RFC</label>
              <input id="rfc" name="rfc" defaultValue={v.rfc} className={`${campo} uppercase`} required />
            </div>
            <div>
              <label className={etiqueta} htmlFor="cp_fiscal">C.P. fiscal</label>
              <input id="cp_fiscal" name="cp_fiscal" defaultValue={v.cp_fiscal} inputMode="numeric" className={campo} required />
            </div>
            <div className="sm:col-span-2">
              <label className={etiqueta} htmlFor="razon_social">Razón social (como en tu constancia)</label>
              <input id="razon_social" name="razon_social" defaultValue={v.razon_social} className={campo} required />
            </div>
            <div>
              <label className={etiqueta} htmlFor="regimen_fiscal">Régimen fiscal</label>
              <select id="regimen_fiscal" name="regimen_fiscal" defaultValue={v.regimen_fiscal ?? ""} className={campo} required>
                <option value="" disabled>Elige…</option>
                {REGIMENES.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className={etiqueta} htmlFor="uso_cfdi">Uso del CFDI</label>
              <select id="uso_cfdi" name="uso_cfdi" defaultValue={v.uso_cfdi ?? "G01"} className={campo}>
                {USOS.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
              </select>
            </div>
          </div>
        )}
      </section>

      {estado.error && <p role="alert" className="rounded-lg bg-white p-3 font-semibold text-red-700 ring-2 ring-red-200">{estado.error}</p>}

      <button disabled={enviando} className="w-full rounded-xl bg-azul py-4 text-lg font-bold text-white disabled:opacity-60">
        {enviando ? "Enviando…" : "Enviar pedido"}
      </button>
      <p className="text-center text-xs text-acero">Te confirmamos por WhatsApp precios, existencias, total y forma de pago.</p>
    </form>
  );
}
