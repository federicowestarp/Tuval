"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";

export type EnlaceMenu = { href: string; texto: string; nota?: string };
export type GrupoMenu = { titulo: string; enlaces: EnlaceMenu[] };

/**
 * Barra flotante translúcida (cápsula separada de los bordes) con menú a pantalla completa.
 * La usan el sitio público y el panel interno.
 */
export function BarraFlotante({
  inicio = "/", enlaces = [], grupos, enLinea = [], acciones, pieMenu, titulo,
}: {
  inicio?: string;
  enlaces?: EnlaceMenu[];
  /** Menú por áreas: cada área con sus secciones (submenú). */
  grupos?: GrupoMenu[];
  /** Enlaces visibles en la barra en pantallas grandes. */
  enLinea?: EnlaceMenu[];
  acciones?: React.ReactNode;
  pieMenu?: React.ReactNode;
  /** Texto junto al logo (p. ej. la sección actual del panel). */
  titulo?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const ruta = usePathname();

  // Cerrar al cambiar de página; bloquear el scroll de fondo mientras está abierto.
  const [rutaPrevia, setRutaPrevia] = useState(ruta);
  if (ruta !== rutaPrevia) { setRutaPrevia(ruta); setAbierto(false); }
  useEffect(() => {
    if (!abierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = previo; window.removeEventListener("keydown", esc); };
  }, [abierto]);

  const coincide = (href: string) => (href === "/" ? ruta === "/" : ruta === href || ruta.startsWith(href + "/"));
  // Solo se marca la sección más específica (Cortes de caja, no también Mostrador).
  const todos = [...enlaces, ...enLinea, ...(grupos ?? []).flatMap((g) => g.enlaces)].map((e) => e.href);
  const mejor = todos.filter(coincide).sort((a, b) => b.length - a.length)[0];
  const activo = (href: string) => href === mejor;

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
        <div className="pointer-events-auto mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 rounded-full bg-white/70 pl-5 pr-2 shadow-[0_8px_30px_rgba(29,29,31,0.08)] ring-1 ring-black/5 backdrop-blur-xl backdrop-saturate-150">
          <div className="flex min-w-0 items-center gap-3">
            <Link href={inicio} aria-label="Inicio" className="shrink-0"><Logo /></Link>
            {titulo && <span className="truncate border-l border-linea pl-3 text-[14px] font-semibold text-secundario">{titulo}</span>}
          </div>
          {enLinea.length > 0 && (
            <nav className="hidden items-center gap-7 text-[14px] lg:flex">
              {enLinea.map((e) => (
                <Link key={e.href} href={e.href} className={`transition hover:text-azul ${activo(e.href) ? "font-semibold text-azul" : "text-tinta/80"}`}>{e.texto}</Link>
              ))}
            </nav>
          )}
          <div className="flex shrink-0 items-center gap-1">
            {acciones}
            <button
              type="button"
              onClick={() => setAbierto(true)}
              aria-expanded={abierto}
              aria-controls="menu-completo"
              className="flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-semibold text-tinta transition hover:bg-niebla"
            >
              Menú
              <span aria-hidden className="flex w-4 flex-col gap-[5px]"><span className="h-[1.5px] w-full bg-current" /><span className="h-[1.5px] w-full bg-current" /></span>
            </button>
          </div>
        </div>
      </header>

      <div
        id="menu-completo"
        role="dialog"
        aria-modal="true"
        aria-label="Menú"
        className={`fixed inset-0 z-50 flex flex-col bg-white transition-[opacity,visibility] duration-300 ${abierto ? "visible opacity-100" : "invisible opacity-0"}`}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-6 sm:px-9 sm:pt-8">
          <Link href={inicio} onClick={() => setAbierto(false)} aria-label="Inicio"><Logo /></Link>
          <button type="button" onClick={() => setAbierto(false)} className="flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-semibold hover:bg-niebla">
            Cerrar <span aria-hidden className="relative h-4 w-4"><span className="absolute left-0 top-1/2 h-[1.5px] w-4 rotate-45 bg-current" /><span className="absolute left-0 top-1/2 h-[1.5px] w-4 -rotate-45 bg-current" /></span>
          </button>
        </div>
        <nav className="mx-auto w-full max-w-6xl flex-1 overflow-y-auto px-6 pb-10 pt-8 sm:px-9 sm:pt-12">
          {grupos ? (
            <>
              {/* Computadora: una columna por área, todo a la vista. */}
              <div className="hidden gap-10 lg:grid lg:grid-cols-4">
                {grupos.map((g, gi) => (
                  <section key={g.titulo} className={`transition duration-500 ${abierto ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`} style={{ transitionDelay: abierto ? `${60 + gi * 50}ms` : "0ms" }}>
                    <h2 className="pb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-secundario">{g.titulo}</h2>
                    <ul>
                      {g.enlaces.map((e) => (
                        <li key={e.href}>
                          <Link href={e.href} onClick={() => setAbierto(false)} className={`flex items-center justify-between gap-3 border-b border-linea py-2.5 font-display text-[19px] font-semibold tracking-[-0.01em] ${activo(e.href) ? "text-azul" : "text-tinta hover:text-azul"}`}>
                            {e.texto}
                            {e.nota && <span className="font-sans text-[13px] font-normal text-secundario">{e.nota}</span>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
              {/* Celular: áreas que se despliegan (submenú); la del lugar donde estás, abierta. */}
              <div className="lg:hidden">
                {grupos.map((g) => {
                  const aqui = g.enlaces.some((e) => activo(e.href));
                  return (
                    <details key={g.titulo} open={aqui || undefined} className="group/area border-b border-linea [&_summary::-webkit-details-marker]:hidden">
                      <summary className="flex cursor-pointer list-none items-center justify-between py-4 font-display text-[22px] font-semibold tracking-[-0.02em]">
                        <span className={aqui ? "text-azul" : ""}>{g.titulo}</span>
                        <span aria-hidden className="text-[22px] font-normal text-secundario transition group-open/area:rotate-45">+</span>
                      </summary>
                      <ul className="pb-3">
                        {g.enlaces.map((e) => (
                          <li key={e.href}>
                            <Link href={e.href} onClick={() => setAbierto(false)} className={`flex items-center justify-between py-2 pl-1 text-[17px] ${activo(e.href) ? "font-semibold text-azul" : "text-tinta"}`}>
                              {e.texto}
                              <span aria-hidden className="text-secundario">→</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </details>
                  );
                })}
              </div>
            </>
          ) : (
          <ul className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
              {enlaces.map((e, i) => (
                <li key={e.href} className={`transition duration-500 ${abierto ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`} style={{ transitionDelay: abierto ? `${60 + i * 35}ms` : "0ms" }}>
                  <Link
                    href={e.href}
                    onClick={() => setAbierto(false)}
                    className={`group flex items-center justify-between gap-4 border-b border-linea py-3 font-display text-[20px] font-semibold leading-tight tracking-[-0.02em] sm:text-[24px] ${activo(e.href) ? "text-azul" : "text-tinta hover:text-azul"}`}
                  >
                    <span>{e.texto}</span>
                    {e.nota ? <span className="font-sans text-[14px] font-normal tracking-normal text-secundario">{e.nota}</span> : <span aria-hidden className="text-[16px] text-secundario transition group-hover:translate-x-1 group-hover:text-azul">→</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {pieMenu && <div className="mt-10 text-[15px] text-secundario">{pieMenu}</div>}
        </nav>
      </div>
    </>
  );
}

/** Espacio bajo la barra fija para que el contenido no quede detrás. */
export function EspacioBarra() {
  return <div aria-hidden className="h-[5.25rem] sm:h-24" />;
}
