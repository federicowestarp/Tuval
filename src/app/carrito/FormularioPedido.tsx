"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useCarrito } from "@/components/carrito/CarritoProvider";
import { crearPedido, type EstadoFormulario } from "./acciones";
import { ZONAS } from "@/lib/corte";

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

export function FormularioPedido() {
  const { lineas, cambiar } = useCarrito();
  const [estado, accion, enviando] = useActionState<EstadoFormulario, FormData>(crearPedido, {});
  const v = estado.campos ?? {};
  const [comprobante, setComprobante] = useState(v.comprobante ?? "nota");
  const [tipoEntrega, setTipoEntrega] = useState(v.tipo_entrega ?? "domicilio");

  if (lineas.length === 0) {
    return (
      <div className="mt-6 rounded-xl bg-white p-6">
        <p>Tu carrito está vacío.</p>
        <Link href="/" className="mt-4 inline-block rounded-lg bg-azul px-5 py-3 font-semibold text-white">Ver catálogo</Link>
      </div>
    );
  }

  return (
    <form action={accion} className="mt-6 space-y-6">
      <input type="hidden" name="lineas" value={JSON.stringify(lineas.map((l) => ({ id: l.id, cantidad: l.cantidad })))} />

      <section className="rounded-xl bg-white p-4">
        <ul className="divide-y divide-cianclaro">
          {lineas.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold">{l.nombre}</p>
                <p className="text-xs text-acero">SKU {l.sku} · {l.unidad}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Menos" onClick={() => cambiar(l.id, l.cantidad - 1)} className="h-10 w-10 rounded-lg bg-niebla text-xl font-bold text-azul">−</button>
                <span className="w-8 text-center font-semibold">{l.cantidad}</span>
                <button type="button" aria-label="Más" onClick={() => cambiar(l.id, l.cantidad + 1)} className="h-10 w-10 rounded-lg bg-niebla text-xl font-bold text-azul">+</button>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-acero">Los precios y el total se confirman con existencias al procesar tu pedido.</p>
      </section>

      <section className="space-y-4 rounded-xl bg-white p-4">
        <h2 className="font-display text-xl font-bold">Entrega</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={etiqueta} htmlFor="nombre">Nombre</label>
            <input id="nombre" name="nombre" defaultValue={v.nombre} className={campo} autoComplete="name" required />
          </div>
          <div>
            <label className={etiqueta} htmlFor="telefono">Celular (WhatsApp)</label>
            <input id="telefono" name="telefono" defaultValue={v.telefono} inputMode="tel" className={campo} autoComplete="tel" required />
          </div>
        </div>
        <fieldset>
          <legend className={etiqueta}>¿A dónde lo llevamos?</legend>
          <div className="grid grid-cols-2 gap-2">
            {[["domicilio", "Domicilio"], ["obra", "Obra"]].map(([id, n]) => (
              <label key={id} className={`cursor-pointer rounded-lg border-2 p-3 text-center font-semibold ${tipoEntrega === id ? "border-azul bg-cianclaro" : "border-cianclaro"}`}>
                <input type="radio" name="tipo_entrega" value={id} checked={tipoEntrega === id} onChange={() => setTipoEntrega(id)} className="sr-only" />
                {n}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label className={etiqueta} htmlFor="zona">Zona</label>
          <select id="zona" name="zona" defaultValue={v.zona ?? "puebla"} className={campo}>
            {ZONAS.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
          </select>
          <p className="mt-1 text-xs text-acero">
            Puebla: pedidos antes de las 12:00 llegan hoy (sábado antes de las 10:00). Atlixco y Tlaxcala: pedidos antes de las 17:00 llegan al día siguiente por la mañana.
          </p>
        </div>
        <div>
          <label className={etiqueta} htmlFor="direccion">Dirección completa{tipoEntrega === "obra" ? " de la obra" : ""}</label>
          <textarea id="direccion" name="direccion" defaultValue={v.direccion} rows={2} className={campo} required />
        </div>
        {tipoEntrega === "obra" && (
          <label className="flex items-start gap-3 rounded-lg bg-niebla p-3 text-sm">
            <input type="checkbox" name="sin_recepcion" defaultChecked={v.sin_recepcion === "on"} className="mt-1 h-5 w-5" />
            <span>Pueden dejarlo sin que alguien reciba. El chofer deja foto con ubicación como comprobante de entrega.</span>
          </label>
        )}
        <div>
          <label className={etiqueta} htmlFor="notas">Indicaciones (opcional)</label>
          <input id="notas" name="notas" defaultValue={v.notas} className={campo} placeholder="Ej. preguntar por el residente, portón azul" />
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
        {enviando ? "Enviando…" : "Hacer pedido"}
      </button>
      <p className="text-center text-xs text-acero">Te confirmamos por WhatsApp el total y la forma de pago.</p>
    </form>
  );
}
