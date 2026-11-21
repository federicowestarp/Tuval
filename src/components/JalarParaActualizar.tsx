"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LARGO_ANILLO } from "@/components/Progreso";

const UMBRAL = 72; // px de jalón para actualizar
const MAXIMO = 110;

/**
 * Actualizar al jalar hacia abajo (docs/marca/ANIMACIONES.md §6), en listas que cambian: pedidos, catálogo, existencias.
 * Mientras jalas, el anillo se dibuja en proporción; al soltar pasado el umbral gira hasta que llegan los datos
 * y la lista regresa en 300 ms. Si sueltas antes, regresa a cero sin cargar. Solo en pantallas táctiles.
 */
export function JalarParaActualizar({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [jalon, setJalon] = useState(0);
  const [arrastrando, setArrastrando] = useState(false);
  const [cargando, iniciar] = useTransition();
  const inicio = useRef<number | null>(null);
  const actual = useRef(0);
  const ocupado = useRef(false);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("sin-jalon-nativo");
    const poner = (v: number) => { actual.current = v; setJalon(v); };
    const tocar = (e: TouchEvent) => {
      if (ocupado.current || e.touches.length !== 1 || window.scrollY > 0) return;
      inicio.current = e.touches[0].clientY;
    };
    const mover = (e: TouchEvent) => {
      if (inicio.current == null) return;
      const d = e.touches[0].clientY - inicio.current;
      if (d <= 0 || window.scrollY > 0) { if (actual.current) poner(0); setArrastrando(false); return; }
      setArrastrando(true);
      poner(Math.min(MAXIMO, d * 0.5));
    };
    const soltar = () => {
      if (inicio.current == null) return;
      inicio.current = null;
      setArrastrando(false);
      if (actual.current >= UMBRAL) {
        ocupado.current = true;
        poner(UMBRAL);
        iniciar(() => router.refresh());
      } else poner(0);
    };
    window.addEventListener("touchstart", tocar, { passive: true });
    window.addEventListener("touchmove", mover, { passive: true });
    window.addEventListener("touchend", soltar);
    window.addEventListener("touchcancel", soltar);
    return () => {
      html.classList.remove("sin-jalon-nativo");
      window.removeEventListener("touchstart", tocar);
      window.removeEventListener("touchmove", mover);
      window.removeEventListener("touchend", soltar);
      window.removeEventListener("touchcancel", soltar);
    };
  }, [router]);

  // Al llegar los datos, la lista regresa a su lugar.
  useEffect(() => {
    if (cargando || !ocupado.current) return;
    ocupado.current = false;
    actual.current = 0;
    setJalon(0);
  }, [cargando]);

  const p = Math.min(1, jalon / UMBRAL);
  return (
    <div className="relative">
      {(jalon > 0 || cargando) && (
        <div className="pointer-events-none absolute inset-x-0 -top-1 flex justify-center" style={{ height: jalon }} aria-hidden={!cargando}>
          <svg viewBox="0 0 64 64" className={`mt-3 h-8 w-8 ${cargando ? "anillo-gira-ya" : ""}`} role={cargando ? "img" : undefined} aria-label={cargando ? "Actualizando" : undefined} style={{ opacity: Math.min(1, p * 1.5) }}>
            <circle cx="32" cy="32" r="21" fill="none" stroke="var(--azul-tuval)" strokeWidth="11" strokeLinecap="round" strokeDasharray={`${LARGO_ANILLO * (cargando ? 1 : p)} 200`} />
            <g className="anillo-giro" style={{ transform: `rotate(${285 * (cargando ? 1 : p)}deg)` }}>
              <circle cx="53" cy="32" r="6.5" fill="var(--cian-flujo)" />
            </g>
          </svg>
        </div>
      )}
      <div className={arrastrando ? "" : "jalon-regresa"} style={jalon > 0 ? { transform: `translateY(${jalon}px)` } : undefined}>
        {children}
      </div>
    </div>
  );
}
