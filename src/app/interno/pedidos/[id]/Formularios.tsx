"use client";

import { ElegirArchivo } from "@/components/ElegirArchivo";
import { useActionState, useState } from "react";
import { cargarCotizacion, confirmarPedido, type Resultado } from "./acciones";
import type { RenglonComparacion } from "@/lib/interno";
import { formatoMoneda } from "@/lib/catalogo-formato";

function Aviso({ r }: { r: Resultado }) {
  if (r.error) return <p role="alert" className="text-sm font-semibold text-red-700">{r.error}</p>;
  if (r.mensaje) return <p className="text-sm font-semibold text-azul">{r.mensaje}</p>;
  return null;
}

export function FormCotizacion({ pedidoId, proveedores }: { pedidoId: string; proveedores: { id: string; nombre: string }[] }) {
  const [r, accion, enviando] = useActionState<Resultado, FormData>(cargarCotizacion, {});
  const [proveedor, setProveedor] = useState(proveedores[0]?.id ?? "");
  const esEmmsa = proveedores.find((x) => x.id === proveedor)?.nombre === "Emmsa";
  const [pegarManual, setPegar] = useState(false);
  const pegar = pegarManual || !esEmmsa;
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="pedido_id" value={pedidoId} />
      <label className="block text-sm">
        <span className="mb-1 block font-semibold">Proveedor</span>
        <select name="proveedor_id" value={proveedor} onChange={(e) => setProveedor(e.target.value)} className="h-10 w-full rounded-xl border border-linea bg-white px-3">
          {proveedores.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          <option value="nuevo">+ Proveedor nuevo…</option>
        </select>
      </label>
      {proveedor === "nuevo" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <input name="proveedor_nuevo" placeholder="Nombre del proveedor" required className="h-10 rounded-xl border border-linea px-3" />
          <input name="proveedor_whatsapp" inputMode="tel" placeholder="WhatsApp (10 dígitos, opcional)" className="h-10 rounded-xl border border-linea px-3" />
        </div>
      )}
      <ElegirArchivo name="pdf" accept="application/pdf,image/*" texto={esEmmsa ? "Elegir PDF de la cotización" : "Adjuntar su cotización (respaldo)"} ayuda={esEmmsa ? "El PDF de Emmsa se lee solo" : "PDF o foto; los precios se toman de lo que pegues abajo"} grande />
      {esEmmsa && (
        <button type="button" onClick={() => setPegar(!pegarManual)} className="text-sm text-secundario underline">
          {pegarManual ? "Ocultar" : "¿No tienes PDF? Pegar desde Excel"}
        </button>
      )}
      {pegar && (
        <>
          <input name="folio" placeholder="Folio de cotización (opcional)" className="w-full rounded-xl border border-linea px-3 py-2" />
          <textarea
            name="texto"
            rows={5}
            placeholder={"Columnas: código | descripción | cantidad | precio unitario | disponible | tiempo de entrega"}
            className="w-full rounded-xl border border-linea px-3 py-2 font-mono text-xs"
          />
        </>
      )}
      <div>
        <button disabled={enviando} className="rounded-full bg-azul px-5 py-2.5 font-semibold text-white disabled:opacity-60">
          {enviando ? "Leyendo…" : "Cargar y comparar"}
        </button>
      </div>
      <Aviso r={r} />
    </form>
  );
}

const margen = (venta: number | null, costo: number | null) =>
  venta && costo ? `${Math.round(((venta - costo) / venta) * 100)}%` : "—";

export function FormConfirmar({ pedidoId, renglones, confirmado }: { pedidoId: string; renglones: RenglonComparacion[]; confirmado: boolean }) {
  const [r, accion, enviando] = useActionState<Resultado, FormData>(confirmarPedido, {});
  const [precios, setPrecios] = useState<Record<string, string>>(() =>
    Object.fromEntries(renglones.map((x) => [x.partida_id, String(x.precio_unitario ?? x.precio_lista ?? "")])),
  );
  // A quién se le compra cada partida: por default la oferta disponible más barata (o la ya elegida).
  const [elegidos, setElegidos] = useState<Record<string, string>>(() =>
    Object.fromEntries(renglones.map((x) => [x.partida_id, x.proveedor_id ?? ""])),
  );
  const [quitar, setQuitar] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(renglones.map((x) => [x.partida_id, x.ofertas.length > 0 && x.ofertas.every((o) => o.disponible === false)])),
  );
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="pedido_id" value={pedidoId} />
      {/* Tarjetas en vez de tabla: se leen igual en el celular que en la computadora. */}
      <ul className="space-y-2">
        {renglones.map((x) => {
          const venta = Number(precios[x.partida_id]) || null;
          const o = x.ofertas.find((k) => k.proveedor_id === elegidos[x.partida_id]) ?? x.ofertas[0] ?? null;
          const costo = o?.precio ?? null;
          const alerta = o?.disponible === false;
          const bajo = !!(venta && costo && venta <= costo);
          const quien = o?.proveedor ?? "Proveedor";
          return (
            <li key={x.partida_id} className={`rounded-xl border p-3 ${alerta ? "border-red-200 bg-red-50" : "border-linea"} ${quitar[x.partida_id] ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0"><span className="font-semibold">{x.nombre}</span><span className="block text-xs text-secundario">{x.sku}{o?.codigo && ` · ${quien} ${o.codigo}`} · <a href={`/interno/escanear/${encodeURIComponent(x.sku)}`} className="text-azul underline">quién lo surte</a></span></p>
                <span className="shrink-0 rounded-full bg-niebla px-2.5 py-0.5 text-sm font-semibold">× {x.cantidad}</span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-4">
                <div><dt className="text-secundario">Exist. propia</dt><dd className="font-semibold">{x.existencia_propia}</dd></div>
                <div><dt className="text-secundario">{quien}: costo</dt><dd className="font-semibold">{costo != null ? formatoMoneda(costo) : <span className="font-normal text-secundario">sin cotizar</span>}</dd></div>
                <div><dt className="text-secundario">{quien}: disponible</dt><dd className="font-semibold">
                  {o?.disponible == null ? "—" : o.disponible ? "Sí" : <span className="text-red-700">No</span>}
                  {o?.tiempo && <span className={`block text-xs font-normal ${o.dias != null && o.dias > 1 ? "font-semibold text-red-700" : "text-secundario"}`}>{o.tiempo}</span>}
                </dd></div>
                <div><dt className="text-secundario">Nuestra lista</dt><dd className="font-semibold">{x.precio_lista != null ? formatoMoneda(x.precio_lista) : "—"}</dd></div>
              </dl>
              <input type="hidden" name={`proveedor_${x.partida_id}`} value={o?.proveedor_id ?? ""} />
              {x.ofertas.length > 1 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px]" role="radiogroup" aria-label={`Comprar ${x.nombre} a`}>
                  <span className="text-secundario">Comprar a:</span>
                  {x.ofertas.map((k) => (
                    <button key={k.proveedor_id} type="button" role="radio" aria-checked={k.proveedor_id === o?.proveedor_id}
                      onClick={() => setElegidos({ ...elegidos, [x.partida_id]: k.proveedor_id })}
                      className={`rounded-full border px-2.5 py-1 ${k.proveedor_id === o?.proveedor_id ? "border-azul bg-azul text-white" : "border-linea"} ${k.disponible === false ? "line-through opacity-60" : ""}`}>
                      {k.proveedor} {formatoMoneda(k.precio)}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-linea pt-2">
                <label className="flex items-center gap-2 text-[13px]">
                  <span className="text-secundario">Precio de venta</span>
                  <input
                    name={`precio_${x.partida_id}`}
                    value={precios[x.partida_id]}
                    onChange={(e) => setPrecios({ ...precios, [x.partida_id]: e.target.value })}
                    disabled={quitar[x.partida_id]}
                    inputMode="decimal"
                    placeholder="sin IVA"
                    className="h-9 w-28 rounded-lg border border-linea px-2 text-right disabled:opacity-40"
                  />
                </label>
                <span className={`text-[13px] ${bajo ? "font-semibold text-red-700" : "text-secundario"}`}>Margen <strong>{margen(venta, costo)}</strong></span>
                <label className="ml-auto flex items-center gap-2 text-[13px]">
                  <input type="checkbox" name={`quitar_${x.partida_id}`} checked={quitar[x.partida_id]} onChange={(e) => setQuitar({ ...quitar, [x.partida_id]: e.target.checked })} className="h-5 w-5" />
                  No se consigue
                </label>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-secundario">Precios sin IVA. Lo marcado como “no se consigue” se quita del pedido y queda registrado en Demanda.</p>
      <button disabled={enviando} className="rounded-full bg-azul px-5 py-3 font-semibold text-white disabled:opacity-60">
        {enviando ? "Confirmando…" : confirmado ? "Volver a confirmar" : "Confirmar pedido"}
      </button>
      <Aviso r={r} />
    </form>
  );
}
