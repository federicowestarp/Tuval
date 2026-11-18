"use client";

import { useActionState, useState } from "react";
import { Firma } from "../../chofer/Firma";
import { entregarEnSucursal, type EstadoRecoger } from "../acciones";

/** Entrega en mostrador: revisión partida por partida con el cliente, nombre de quien recoge y firma. */
export function EntregarSucursal({ pedidoId, recibeNombre, partidas }: { pedidoId: string; recibeNombre: string; partidas: { id: string; nombre: string; cantidad: number }[] }) {
  const [revisado, setRevisado] = useState<Record<string, { ok: boolean; recibida: string }>>(() => Object.fromEntries(partidas.map((x) => [x.id, { ok: false, recibida: String(x.cantidad) }])));
  const [firma, setFirma] = useState<File | null>(null);
  const [e, accion, enviando] = useActionState<EstadoRecoger, FormData>(entregarEnSucursal, {});
  const pendientes = partidas.filter((x) => !revisado[x.id]?.ok).length;
  if (e.ok) return <p className="rounded-[20px] bg-emerald-50 p-5 text-[18px] font-semibold text-emerald-800">Entregado ✓ Quedó registrado con su firma.</p>;
  return (
    <form action={(fd) => {
      fd.set("checklist", JSON.stringify(partidas.map((x) => ({ id: x.id, recibida: Number(revisado[x.id]?.recibida ?? x.cantidad) }))));
      if (firma) fd.set("firma", firma);
      accion(fd);
    }} className="space-y-4">
      <input type="hidden" name="pedido_id" value={pedidoId} />
      <div>
        <p className="mb-2 font-semibold">Revisa con el cliente, partida por partida</p>
        <ul className="space-y-1.5">
          {partidas.map((x) => {
            const r = revisado[x.id]; const falta = Number(r?.recibida) < x.cantidad;
            return (
              <li key={x.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${r?.ok ? (falta ? "bg-amber-50" : "bg-emerald-50") : "bg-niebla"}`}>
                <input type="checkbox" checked={!!r?.ok} onChange={(ev) => setRevisado({ ...revisado, [x.id]: { ...r, ok: ev.target.checked } })} className="h-6 w-6 shrink-0" aria-label={`Revisado ${x.nombre}`} />
                <span className="min-w-0 flex-1 text-[15px]">{x.nombre}</span>
                <input inputMode="decimal" value={r?.recibida ?? ""} onChange={(ev) => setRevisado({ ...revisado, [x.id]: { ...r, recibida: ev.target.value } })} aria-label={`Entregadas de ${x.nombre}`} className={`h-9 w-16 rounded-lg border bg-white text-center ${falta ? "border-amber-500" : "border-linea"}`} />
                <span className="text-[13px] text-secundario">/ {x.cantidad}</span>
              </li>
            );
          })}
        </ul>
        {pendientes > 0 && <p className="mt-1 text-[13px] text-secundario">Faltan {pendientes} por revisar.</p>}
      </div>
      <label className="block">
        <span className="mb-1 block text-[13px] font-semibold uppercase tracking-wide text-secundario">Recoge</span>
        <input name="recibio" defaultValue={recibeNombre} required className="h-12 w-full rounded-2xl border border-linea px-4" />
      </label>
      <div>
        <span className="mb-1 block text-[13px] font-semibold uppercase tracking-wide text-secundario">Firma de quien recoge</span>
        <Firma onCambio={setFirma} />
      </div>
      {e.error && <p className="font-semibold text-red-700">{e.error}</p>}
      <button disabled={enviando || pendientes > 0 || !firma} className="h-14 w-full rounded-full bg-azul text-[17px] font-semibold text-white disabled:opacity-40">
        {enviando ? "Guardando…" : pendientes > 0 ? "Revisa todas las partidas" : !firma ? "Falta la firma" : "Entregar"}
      </button>
    </form>
  );
}
