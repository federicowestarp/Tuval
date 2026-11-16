"use client";

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
      <label className="flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-cian p-5 text-center font-semibold text-azul">
        <input type="file" name="pdf" accept="application/pdf" className="text-sm" />
      </label>
      <button type="button" onClick={() => setPegar(!pegar)} className="text-sm text-acero underline">
        {pegar ? "Ocultar" : "¿No tienes PDF? Pegar desde Excel"}
      </button>
      {pegar && (
        <>
          <input name="folio" placeholder="Folio de cotización (opcional)" className="w-full rounded-xl border border-cianclaro px-3 py-2" />
          <textarea
            name="texto"
            rows={5}
            placeholder={"Columnas: código | descripción | cantidad | precio unitario | disponible | tiempo de entrega"}
            className="w-full rounded-xl border border-cianclaro px-3 py-2 font-mono text-xs"
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
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-cianclaro text-xs">
            <tr>
              <th className="p-2">Producto</th>
              <th className="p-2">Cant.</th>
              <th className="p-2">Exist. propia</th>
              <th className="p-2">Emmsa: costo</th>
              <th className="p-2">Emmsa: disp. / tiempo</th>
              <th className="p-2">Nuestra lista</th>
              <th className="p-2">Precio de venta</th>
              <th className="p-2">Margen</th>
              <th className="p-2">No se consigue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cianclaro">
            {renglones.map((x) => {
              const venta = Number(precios[x.partida_id]) || null;
              const alerta = x.cot_disponible === false;
              return (
                <tr key={x.partida_id} className={alerta ? "bg-red-50" : ""}>
                  <td className="p-2"><span className="font-semibold">{x.nombre}</span><span className="block text-xs text-acero">{x.sku}{x.cot_codigo && ` · Emmsa ${x.cot_codigo}`}</span></td>
                  <td className="p-2">{x.cantidad}</td>
                  <td className="p-2">{x.existencia_propia}</td>
                  <td className="p-2">{x.cot_precio != null ? formatoMoneda(x.cot_precio) : <span className="text-acero">sin cotizar</span>}</td>
                  <td className="p-2">
                    {x.cot_disponible == null ? "—" : x.cot_disponible ? "Sí" : <span className="font-semibold text-red-700">No</span>}
                    {x.cot_tiempo && (
                      <span className={`block text-xs ${x.cot_dias != null && x.cot_dias > 1 ? "font-semibold text-red-700" : "text-acero"}`}>{x.cot_tiempo}</span>
                    )}
                  </td>
                  <td className="p-2">{x.precio_lista != null ? formatoMoneda(x.precio_lista) : "—"}</td>
                  <td className="p-2">
                    <input
                      name={`precio_${x.partida_id}`}
                      value={precios[x.partida_id]}
                      onChange={(e) => setPrecios({ ...precios, [x.partida_id]: e.target.value })}
                      disabled={quitar[x.partida_id]}
                      inputMode="decimal"
                      placeholder="sin IVA"
                      className="w-24 rounded-lg border border-cianclaro px-2 py-1 disabled:opacity-40"
                    />
                  </td>
                  <td className={`p-2 ${venta && x.cot_precio && venta <= x.cot_precio ? "font-semibold text-red-700" : ""}`}>{margen(venta, x.cot_precio)}</td>
                  <td className="p-2 text-center"><input
                      type="checkbox"
                      name={`quitar_${x.partida_id}`}
                      checked={quitar[x.partida_id]}
                      onChange={(e) => setQuitar({ ...quitar, [x.partida_id]: e.target.checked })}
                      className="h-5 w-5"
                    /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-acero">Precios sin IVA. Lo marcado como “no se consigue” se quita del pedido y queda registrado en Demanda.</p>
      <button disabled={enviando} className="rounded-lg bg-cian px-5 py-3 font-bold text-profundo disabled:opacity-60">
        {enviando ? "Confirmando…" : confirmado ? "Volver a confirmar" : "Confirmar pedido"}
      </button>
      <Aviso r={r} />
    </form>
  );
}
