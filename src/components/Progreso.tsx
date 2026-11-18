import { ETAPAS_CLIENTE, ETAPAS_CLIENTE_RECOGER } from "@/lib/estados";

const CORTAS = ["Recibido", "Preparando", "En ruta", "Entregado"];
const ARCO = 285; // grados del anillo del símbolo (abertura arriba a la derecha)

const punto = (grados: number) => {
  const r = (grados * Math.PI) / 180;
  return [32 + 21 * Math.cos(r), 32 + 21 * Math.sin(r)] as const;
};
const arco = (grados: number) => {
  const [x, y] = punto(grados);
  return `M53 32 A21 21 0 ${grados > 180 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
};

/** Anillo de avance: el símbolo de Tuval se va cerrando hasta el punto cian (entregado). */
export function AnilloAvance({ actual, className = "h-20 w-20" }: { actual: number; className?: string }) {
  const g = (ARCO * Math.min(4, actual + 1)) / 4;
  const [px, py] = punto(g);
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d={arco(ARCO)} fill="none" stroke="var(--linea)" strokeWidth="9" strokeLinecap="round" />
      <path d={arco(g)} fill="none" stroke="var(--azul-tuval)" strokeWidth="9" strokeLinecap="round" />
      <circle cx={px} cy={py} r="5.5" fill="var(--cian-flujo)" />
    </svg>
  );
}

/** Seguimiento: anillo + pasos con texto (el estado nunca se indica solo con color). */
export function Progreso({ actual, recoger = false }: { actual: number; recoger?: boolean }) {
  const cortas = recoger ? ["Recibido", "Preparando", "Listo para recoger", "Entregado"] : CORTAS;
  const etapas = recoger ? ETAPAS_CLIENTE_RECOGER : ETAPAS_CLIENTE;
  return (
    <div className="flex items-center gap-5" aria-label={`Estado: ${etapas[Math.max(0, actual)]}`}>
      <AnilloAvance actual={actual} className="h-20 w-20 shrink-0" />
      <ol className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1.5 text-[14px]">
        {cortas.map((e, i) => (
          <li key={e} className={`flex items-center gap-2 ${i <= actual ? "font-semibold text-tinta" : "text-secundario"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${i < actual ? "bg-azul" : i === actual ? "bg-cian" : "bg-linea"}`} />
            {e}
          </li>
        ))}
      </ol>
    </div>
  );
}
