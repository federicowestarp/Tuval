"use client";

/** Control segmentado (estilo iOS) que funciona como radio dentro de un formulario. */
export function Segmentado({
  name, valor, onCambio, opciones,
}: { name: string; valor: string; onCambio: (v: string) => void; opciones: { id: string; texto: string; nota?: string; deshabilitada?: boolean }[] }) {
  return (
    <div role="radiogroup" className="grid gap-1 rounded-2xl bg-niebla p-1" style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}>
      {opciones.map((o) => (
        <label
          key={o.id}
          className={`flex min-h-12 cursor-pointer flex-col items-center justify-center rounded-xl px-2 py-2 text-center text-[15px] font-semibold transition ${
            o.deshabilitada ? "cursor-not-allowed text-acero/60" : valor === o.id ? "bg-white text-azul shadow-sm" : "text-acero"
          }`}
        >
          <input type="radio" name={name} value={o.id} checked={valor === o.id} disabled={o.deshabilitada} onChange={() => onCambio(o.id)} className="sr-only" />
          {o.texto}
          {o.nota && <span className="text-[11px] font-medium">{o.nota}</span>}
        </label>
      ))}
    </div>
  );
}
