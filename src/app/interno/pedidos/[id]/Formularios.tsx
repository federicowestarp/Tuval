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

export function FormCotizacion({ pedidoId }: { pedidoId: string }) {
  const [r, accion, enviando] = useActionState<Resultado, FormData>(cargarCotizacion, {});
  const [pegar, setPegar] = useState(false);
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="pedido_id" value={pedidoId} />
      <ElegirArchivo name="pdf" accept="application/pdf" texto="Elegir PDF de la cotización" ayuda="El PDF que mandó el proveedor" grande />
      <button type="button" onClick={() => setPegar(!pegar)} className="text-sm text-secundario underline">
        {pegar ? "Ocultar" : "¿No tienes PDF? Pegar desde Excel"}
      </button>
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
  const [quitar, setQuitar] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(renglones.map((x) => [x.partida_id, x.cot_disponible === false])),
  );
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="pedido_id" value={pedidoId} />
      {/* Tarjetas en vez de tabla: se leen igual en el celular que en la computadora. */}
      <ul className="space-y-2">
        {renglones.map((x) => {
          const venta = Number(precios[x.partida_id]) || null;
          const alerta = x.cot_disponible === false;
          const bajo = !!(venta && x.cot_precio && venta <= x.cot_precio);
          return (
            <li key={x.partida_id} className={`rounded-xl border p-3 ${alerta ? "border-red-200 bg-red-50" : "border-linea"} ${quitar[x.partida_id] ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0"><span className="font-semibold">{x.nombre}</span><span className="block text-xs text-secundario">{x.sku}{x.cot_codigo && ` · Emmsa ${x.cot_codigo}`}</span></p>
                <span className="shrink-0 rounded-full bg-niebla px-2.5 py-0.5 text-sm font-semibold">× {x.cantidad}</span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-4">
                <div><dt className="text-secundario">Exist. propia</dt><dd className="font-semibold">{x.existencia_propia}</dd></div>
                <div><dt className="text-secundario">Emmsa: costo</dt><dd className="font-semibold">{x.cot_precio != null ? formatoMoneda(x.cot_precio) : <span className="font-normal text-secundario">sin cotizar</span>}</dd></div>
                <div><dt className="text-secundario">Emmsa: disponible</dt><dd className="font-semibold">
                  {x.cot_disponible == null ? "—" : x.cot_disponible ? "Sí" : <span className="text-red-700">No</span>}
                  {x.cot_tiempo && <span className={`block text-xs font-normal ${x.cot_dias != null && x.cot_dias > 1 ? "font-semibold text-red-700" : "text-secundario"}`}>{x.cot_tiempo}</span>}
                </dd></div>
                <div><dt className="text-secundario">Nuestra lista</dt><dd className="font-semibold">{x.precio_lista != null ? formatoMoneda(x.precio_lista) : "—"}</dd></div>
              </dl>
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
                <span className={`text-[13px] ${bajo ? "font-semibold text-red-700" : "text-secundario"}`}>Margen <strong>{margen(venta, x.cot_precio)}</strong></span>
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
