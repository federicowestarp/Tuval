/** Símbolo Tuval: maneral de válvula + corte de tubo (retícula 8×8 del manual). */
export function Simbolo({ className = "h-8 w-8", color = "var(--cian-flujo)" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 8 8" className={className} aria-hidden="true">
      <rect x="1.5" y="0.6" width="5" height="1" rx="0.5" fill={color} />
      <rect x="3.6" y="1.4" width="0.8" height="1.3" fill={color} />
      <circle cx="4" cy="5" r="1.6" fill="none" stroke={color} strokeWidth="0.85" />
    </svg>
  );
}

export function Logo({ tono = "claro" }: { tono?: "claro" | "oscuro" }) {
  const texto = tono === "claro" ? "text-white" : "text-azul";
  return (
    <span className="inline-flex items-center gap-2" aria-label="Tuval">
      <Simbolo className="h-8 w-8" />
      <span className={`font-display text-2xl font-bold tracking-wide ${texto}`}>TUVAL</span>
    </span>
  );
}
