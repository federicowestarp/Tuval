/** Piezas del tablero: recuadros con un número y barras horizontales de un solo color. */
export function Indicador({ etiqueta, valor, nota }: { etiqueta: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-[20px] bg-white p-4">
      <p className="text-[13px] text-secundario">{etiqueta}</p>
      <p className="mt-1 font-display text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{valor}</p>
      {nota && <p className="mt-1.5 text-[12px] text-secundario">{nota}</p>}
    </div>
  );
}

/** Magnitud entre categorías → barras horizontales, un color, valor rotulado, ancho relativo al mayor. */
export function Barras({ filas, vacio = "Sin datos en este periodo." }: { filas: { etiqueta: string; valor: number; texto: string; detalle?: string }[]; vacio?: string }) {
  const max = Math.max(0, ...filas.map((f) => f.valor));
  if (filas.length === 0 || max === 0) return <p className="text-[14px] text-secundario">{vacio}</p>;
  return (
    <ul className="space-y-2.5">
      {filas.map((f) => (
        <li key={f.etiqueta} title={`${f.etiqueta}: ${f.texto}${f.detalle ? ` · ${f.detalle}` : ""}`} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3 text-[14px]">
          <span className="truncate text-secundario">{f.etiqueta}</span>
          <span className="h-3 rounded-r-[4px] bg-niebla">
            <span className="block h-3 rounded-r-[4px] bg-azul" style={{ width: f.valor > 0 ? `${Math.max(2, (f.valor / max) * 100)}%` : 0 }} />
          </span>
          <span className="tabular-nums font-semibold">{f.texto}</span>
        </li>
      ))}
    </ul>
  );
}

export const pesos = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
export const horas = (h: number | null) => (h == null ? "—" : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} días`);
