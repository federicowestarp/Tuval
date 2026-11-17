"use client";

import { PagarEnCaja } from "./PagarEnCaja";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useCarrito } from "@/components/carrito/CarritoProvider";
import { TarjetaDireccion } from "@/components/TarjetaDireccion";
import { Segmentado } from "@/components/Segmentado";
import { IconoCheck, IconoDocumento, IconoMas, IconoMenos } from "@/components/Iconos";
import { BotonLiga, campo, clasesBoton, etiqueta, Pastilla } from "@/components/ui";
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

type Props = { direcciones: Direccion[]; haySucursal: boolean; nombre: string; telefono: string };

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-linea pt-8">
      <h2 className="mb-5 font-display text-2xl font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

export function FormularioPedido({ direcciones, haySucursal, nombre, telefono }: Props) {
  const { lineas, adjuntos, piezas, cambiar, quitarAdjunto } = useCarrito();
  const [estado, accion, enviando] = useActionState<EstadoFormulario, FormData>(crearPedido, {});
  const v = estado.campos ?? {};
  const [comprobante, setComprobante] = useState(v.comprobante ?? "nota");
  const [modo, setModo] = useState(v.modo ?? "envio");
  const [dirId, setDirId] = useState(v.direccion_id ?? direcciones[0]?.id ?? "");

  if (lineas.length === 0 && adjuntos.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="font-display text-2xl font-semibold">Tu carrito está vacío.</p>
        <p className="mt-2 text-secundario">Busca en la tienda o pide con tu lista.</p>
        <div className="mt-6 flex justify-center gap-2">
          <BotonLiga href="/tienda">Ir a la tienda</BotonLiga>
          <BotonLiga href="/lista" variante="secundario">Pedir con lista</BotonLiga>
        </div>
      </div>
    );
  }

  const catalogo = lineas.filter((l) => !l.especial);
  const especiales = lineas.filter((l) => l.especial);

  return (
    <form action={accion} className="space-y-8 pb-28 md:pb-8">
      <input type="hidden" name="lineas" value={JSON.stringify(catalogo.map((l) => ({ id: l.id, cantidad: l.cantidad })))} />
      <input type="hidden" name="especiales" value={JSON.stringify(especiales.map((l) => ({ descripcion: l.nombre, cantidad: l.cantidad })))} />
      <input type="hidden" name="adjuntos" value={JSON.stringify(adjuntos.map((a) => a.id))} />

      <ul className="divide-y divide-linea">
        {lineas.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-4 py-4">
            <div className="min-w-0">
              <p className="font-semibold leading-snug">{l.nombre}</p>
              <div className="mt-1">{l.especial ? <Pastilla tono="niebla">Lo buscamos por ti</Pastilla> : <p className="text-[13px] text-secundario">{l.sku}</p>}</div>
            </div>
            <div className="flex h-10 shrink-0 items-center rounded-full bg-niebla">
              <button type="button" aria-label="Quitar uno" onClick={() => cambiar(l.id, l.cantidad - 1)} className="flex h-10 w-10 items-center justify-center text-azul"><IconoMenos className="h-4 w-4" /></button>
              <span className="min-w-6 text-center font-semibold">{l.cantidad}</span>
              <button type="button" aria-label="Agregar uno" onClick={() => cambiar(l.id, l.cantidad + 1)} className="flex h-10 w-10 items-center justify-center text-azul"><IconoMas className="h-4 w-4" /></button>
            </div>
          </li>
        ))}
        {adjuntos.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-niebla text-azul"><IconoDocumento className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{a.nombre}</p>
                <p className="text-[13px] text-secundario">Lista adjunta · la capturamos</p>
              </div>
            </div>
            <button type="button" onClick={() => quitarAdjunto(a.id)} className="text-[14px] text-secundario">Quitar</button>
          </li>
        ))}
      </ul>
      <PagarEnCaja />
      <p className="-mt-4 text-[13px] text-secundario">Confirmamos precios y existencias antes de surtir. <Link href="/tienda" className="text-azul underline">Seguir comprando</Link></p>

      <Seccion titulo="Tus datos">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={etiqueta} htmlFor="nombre">Nombre</label>
            <input id="nombre" name="nombre" defaultValue={v.nombre ?? nombre} className={campo} autoComplete="name" required />
          </div>
          <div>
            <label className={etiqueta} htmlFor="telefono">Celular</label>
            <input id="telefono" name="telefono" defaultValue={v.telefono ?? telefono} inputMode="tel" className={campo} autoComplete="tel" placeholder="10 dígitos" required />
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Entrega">
        <Segmentado
          name="modo"
          valor={modo}
          onCambio={setModo}
          opciones={[
            { id: "envio", texto: "Envío" },
            { id: "recoger", texto: "Recoger", nota: haySucursal ? undefined : "Próximamente", deshabilitada: !haySucursal },
          ]}
        />
        {modo === "envio" && (
          <div className="mt-4 space-y-2">
            {direcciones.length > 0 ? (
              <fieldset className="min-w-0 space-y-2">
                <legend className="sr-only">Dirección de entrega</legend>
                {direcciones.map((d) => (
                  <label key={d.id} className={`relative block cursor-pointer rounded-[20px] p-4 transition ${dirId === d.id ? "bg-white ring-2 ring-azul" : "bg-niebla ring-1 ring-transparent hover:ring-linea"}`}>
                    <input type="radio" name="direccion_id" value={d.id} checked={dirId === d.id} onChange={() => setDirId(d.id)} className="sr-only" />
                    <TarjetaDireccion d={d} />
                    {dirId === d.id && <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-azul text-white"><IconoCheck className="h-4 w-4" /></span>}
                  </label>
                ))}
              </fieldset>
            ) : (
              <p className="rounded-[20px] bg-niebla p-5 text-[15px] text-secundario">Agrega la dirección de tu obra o de tu casa. Se guarda para tus siguientes pedidos.</p>
            )}
            <BotonLiga href="/cuenta/direcciones?volver=/carrito" variante="secundario" ancho>
              <IconoMas className="h-5 w-5" /> Agregar dirección
            </BotonLiga>
          </div>
        )}
        <div className="mt-4">
          <label className={etiqueta} htmlFor="notas">Notas (opcional)</label>
          <input id="notas" name="notas" defaultValue={v.notas} className={campo} placeholder="Ej. orden de compra 1234" />
        </div>
        <div className="mt-4">
          <label className={etiqueta} htmlFor="codigo_recomendado">¿Te recomendó alguien? Código (opcional)</label>
          <input id="codigo_recomendado" name="codigo_recomendado" className={campo} placeholder="TUV-XXXXX" autoCapitalize="characters" />
        </div>
      </Seccion>

      <Seccion titulo="Comprobante">
        <Segmentado name="comprobante" valor={comprobante} onCambio={setComprobante} opciones={[{ id: "nota", texto: "Nota" }, { id: "factura", texto: "Factura" }]} />
        {comprobante === "factura" && (
          <div className="aparecer mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={etiqueta} htmlFor="rfc">RFC</label>
              <input id="rfc" name="rfc" defaultValue={v.rfc} className={`${campo} uppercase`} autoCapitalize="characters" required />
            </div>
            <div>
              <label className={etiqueta} htmlFor="cp_fiscal">C.P. fiscal</label>
              <input id="cp_fiscal" name="cp_fiscal" defaultValue={v.cp_fiscal} inputMode="numeric" className={campo} required />
            </div>
            <div className="sm:col-span-2">
              <label className={etiqueta} htmlFor="razon_social">Razón social</label>
              <input id="razon_social" name="razon_social" defaultValue={v.razon_social} className={campo} placeholder="Como aparece en tu constancia" required />
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
      </Seccion>

      {estado.error && <p role="alert" className="aparecer rounded-2xl bg-red-50 p-4 font-semibold text-red-700">{estado.error}</p>}

      {/* Barra de acción fija */}
      <div className="fixed inset-x-0 bottom-14 z-30 border-t border-linea/70 bg-white/90 p-3 backdrop-blur-xl md:static md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto max-w-2xl">
          <button disabled={enviando} className={clasesBoton("principal", "grande", true)}>
            {enviando ? "Enviando…" : `Enviar pedido · ${piezas} ${piezas === 1 ? "artículo" : "artículos"}`}
          </button>
          <p className="mt-2 hidden text-center text-[13px] text-secundario md:block">Te confirmamos total y forma de pago por WhatsApp antes de surtir.</p>
        </div>
      </div>
    </form>
  );
}
