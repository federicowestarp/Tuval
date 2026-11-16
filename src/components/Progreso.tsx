import { ETAPAS_CLIENTE } from "@/lib/estados";

const CORTAS = ["Recibido", "Preparando", "En ruta", "Entregado"];

/** Avance del pedido en cuatro tramos. */
export function Progreso({ actual }: { actual: number }) {
  return (
    <div aria-label={`Estado: ${ETAPAS_CLIENTE[Math.max(0, actual)]}`}>
      <div className="flex gap-1.5">
        {CORTAS.map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= actual ? "bg-cian" : "bg-niebla"}`} />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-4 text-[11px] sm:text-[12px]">
        {CORTAS.map((e, i) => (
          <span key={e} className={`${i === 0 ? "text-left" : i === 3 ? "text-right" : "text-center"} ${i <= actual ? "font-semibold text-profundo" : "text-acero"}`}>{e}</span>
        ))}
      </div>
    </div>
  );
}
