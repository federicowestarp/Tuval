import Link from "next/link";

/** Componentes base: pocos estilos, mucho aire, una acción principal por pantalla. */

type Variante = "principal" | "secundario" | "acento" | "fantasma";
const estilos: Record<Variante, string> = {
  principal: "bg-azul text-white hover:bg-azul",
  secundario: "text-azul hover:bg-niebla",
  acento: "bg-cian text-sobrecian",
  fantasma: "text-azul hover:bg-niebla",
};
const tam = { normal: "h-12 px-6 text-[15px]", grande: "h-14 px-7 text-base", chico: "h-9 shrink-0 px-4 text-sm" };

export function clasesBoton(v: Variante = "principal", t: keyof typeof tam = "normal", ancho = false) {
  return `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 ${estilos[v]} ${tam[t]} ${ancho ? "w-full" : ""}`;
}

export function BotonLiga({ href, variante, tamano, ancho, children, ...resto }: { href: string; variante?: Variante; tamano?: keyof typeof tam; ancho?: boolean; children: React.ReactNode } & Omit<React.ComponentProps<typeof Link>, "href">) {
  return (
    <Link href={href} className={clasesBoton(variante, tamano, ancho)} {...resto}>
      {children}
      {variante === "secundario" && <span aria-hidden="true">›</span>}
    </Link>
  );
}

export function Pastilla({ children, tono = "cian" }: { children: React.ReactNode; tono?: "cian" | "niebla" | "azul" | "borde" }) {
  const t = { cian: "bg-cian text-sobrecian", niebla: "bg-niebla text-tinta", azul: "bg-azul text-white", borde: "border border-azul text-azul" }[tono];
  return <span className={`inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-semibold ${t}`}>{children}</span>;
}

export function Tarjeta({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[20px] bg-white p-5 ring-1 ring-linea sm:p-6 ${className}`}>{children}</section>;
}

export function Titulo({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-[34px] font-semibold leading-[1.05] sm:text-5xl">{children}</h1>
      {sub && <p className="mt-2 text-[17px] text-secundario">{sub}</p>}
    </div>
  );
}

export const campo =
  "h-14 w-full rounded-xl bg-niebla px-4 text-[17px] text-tinta placeholder:text-secundario/70 outline-none ring-azul/30 transition focus:bg-white focus:ring-2";
export const areaTexto =
  "w-full rounded-xl bg-niebla px-4 py-3.5 text-[17px] text-tinta placeholder:text-secundario/70 outline-none ring-azul/30 transition focus:bg-white focus:ring-2";
export const etiqueta = "mb-1.5 block text-[13px] font-semibold uppercase tracking-wide text-secundario";
