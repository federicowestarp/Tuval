import { MOTIVOS_CANCELACION } from "@/lib/motivos";
import { cambiarEstado } from "./acciones";

/** Cancelar siempre pide el motivo: el tablero lo agrupa. */
export function Cancelar({ id }: { id: string }) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-lg border border-secundario px-3 py-2 text-sm text-secundario">Cancelar</summary>
      <form action={cambiarEstado} className="absolute right-0 z-10 mt-2 w-64 space-y-2 rounded-xl bg-white p-3 shadow-lg ring-1 ring-linea">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="estado" value="cancelado" />
        <label className="block text-[13px] text-secundario" htmlFor={`motivo-${id}`}>Motivo</label>
        <select id={`motivo-${id}`} name="motivo" required defaultValue="" className="w-full rounded-lg border border-linea px-2 py-2 text-sm">
          <option value="" disabled>Elige…</option>
          {MOTIVOS_CANCELACION.map((m) => <option key={m}>{m}</option>)}
        </select>
        <input name="nota" placeholder="Detalle (opcional)" className="w-full rounded-lg border border-linea px-2 py-2 text-sm" />
        <button className="w-full rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white">Cancelar pedido</button>
      </form>
    </details>
  );
}
