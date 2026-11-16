import Link from "next/link";

/** Componentes base: pocos estilos, mucho aire, una acción principal por pantalla. */

type Variante = "principal" | "secundario" | "acento" | "fantasma";
const estilos: Record<Variante, string> = {
  principal: "bg-azul text-white hover:bg-profundo",
  secundario: "bg-niebla text-azul hover:bg-cianclaro",
  acento: "bg-cian text-profundo hover:brightness-95",
  fantasma: "text-azul hover:bg-niebla",
};
const tam = { normal: "h-12 px-6 text-[15px]", grande: "h-14 px-7 text-base", chico: "h-9 px-4 text-sm" };

export function clasesBoton(v: Variante = "principal", t: keyof typeof tam = "normal", ancho = false) {
  return `inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 ${estilos[v]} ${tam[t]} ${ancho ? "w-full" : ""}`;
}

export function BotonLiga({ href, variante, tamano, ancho, children, ...resto }: { href: string; variante?: Variante; tamano?: keyof typeof tam; ancho?: boolean; children: React.ReactNode } & Omit<React.ComponentProps<typeof Link>, "href">) {
  return <Link href={href} className={clasesBoton(variante, tamano, ancho)} {...resto}>{children}</Link>;
}

export function Pastilla({ children, tono = "cian" }: { children: React.ReactNode; tono?: "cian" | "niebla" | "azul" | "borde" }) {
  const t = { cian: "bg-cian text-profundo", niebla: "bg-niebla text-azul", azul: "bg-azul text-white", borde: "border border-azul text-azul" }[tono];
  return <span className={`inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-semibold ${t}`}>{children}</span>;
}

export function Tarjeta({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-white p-5 ring-1 ring-linea sm:p-6 ${className}`}>{children}</section>;
}

export function Titulo({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-[34px] font-bold leading-[1.05] tracking-tight sm:text-5xl">{children}</h1>
      {sub && <p className="mt-2 text-[17px] text-acero">{sub}</p>}
    </div>
  );
}

export const campo =
  "h-14 w-full rounded-2xl bg-niebla px-4 text-[17px] text-profundo placeholder:text-acero/70 outline-none ring-cian transition focus:bg-white focus:ring-2";
export const areaTexto =
  "w-full rounded-2xl bg-niebla px-4 py-3.5 text-[17px] text-profundo placeholder:text-acero/70 outline-none ring-cian transition focus:bg-white focus:ring-2";
export const etiqueta = "mb-1.5 block text-[13px] font-semibold uppercase tracking-wide text-acero";
