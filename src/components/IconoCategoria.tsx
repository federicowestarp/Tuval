import type { Categoria } from "@/lib/catalogo-demo";

/** Íconos de categoría del manual: trazo redondeado, línea. */
export function IconoCategoria({ categoria, className = "h-7 w-7" }: { categoria: Categoria; className?: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {categoria === "tuberia" && (<g {...p}><path d="M4 8v8M20 8v8M4 10h16M4 14h16" /></g>)}
      {categoria === "conexiones" && (<g {...p}><path d="M6 20v-7a6 6 0 0 1 6-6h7M16 4l3 3-3 3" /></g>)}
      {categoria === "valvulas" && (<g {...p}><path d="M8 4h8M12 4v4" /><circle cx="12" cy="14" r="5" /></g>)}
      {categoria === "equipos" && (<g {...p}><circle cx="11" cy="12" r="6" /><path d="M17 12h4M7 16l8-8" /></g>)}
      {categoria === "electrico" && (<g {...p}><path d="M13 2 5 14h6l-1 8 8-12h-6z" /></g>)}
      {categoria === "herramienta" && (<g {...p}><path d="m14 4 6 6-9 9-6-6zM14 4l2-2" /></g>)}
    </svg>
  );
}
