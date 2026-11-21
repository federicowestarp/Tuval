"use client";

import { useEffect, useState } from "react";
import { ETAPAS_CLIENTE, ETAPAS_CLIENTE_RECOGER } from "@/lib/estados";

/**
 * Anillo de Tuval como interfaz (docs/marca/ANIMACIONES.md).
 * Geometría: círculo r=21, trazo 11, arco de marca de 285° = 104.46 de longitud; empieza a las 3 en punto y avanza en sentido horario.
 * Para un avance p (0 a 1): stroke-dasharray = 104.46·p y el punto cian va en (53, 32) girado 285·p grados.
 */
export const LARGO_ANILLO = 104.46;
const GRADOS = 285;
const AZUL = "var(--azul-tuval)", CIAN = "var(--cian-flujo)";

const CORTAS = ["Recibido", "Surtido", "En ruta", "Entregado"];
const CORTAS_RECOGER = ["Recibido", "Surtido", "Listo para recoger", "Entregado"];

/** Anillo de marca completo (estático). Sobre azul: anillo blanco. */
export function AnilloMarca({ className = "h-6 w-6", tono = "color" }: { className?: string; tono?: "color" | "negativo" }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="21" fill="none" stroke={tono === "negativo" ? "#fff" : AZUL} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${LARGO_ANILLO} 200`} />
      <circle cx="37.44" cy="11.72" r="6.5" fill={CIAN} />
    </svg>
  );
}

/**
 * Avance del pedido: Recibido 25 % → Surtido 50 % → En ruta 75 % → Entregado 100 %.
 * Al cambiar de paso avanza del valor anterior al nuevo en 600 ms; en Entregado queda igual al logo y aparece la palomita.
 * Con `recuerdo` (id del pedido) recuerda el último avance visto, para animar el cambio la próxima vez que el cliente abra el pedido.
 */
export function AnilloAvance({ actual, recuerdo, etiqueta, className = "h-20 w-20" }: { actual: number; recuerdo?: string; etiqueta?: string; className?: string }) {
  const meta = Math.max(1, Math.min(4, actual + 1)) / 4;
  const [p, setP] = useState(meta);
  const [mover, setMover] = useState(false);

  useEffect(() => {
    let desde = meta;
    if (recuerdo) {
      try {
        const clave = `tuval.avance.${recuerdo}`;
        const visto = Number(localStorage.getItem(clave));
        if (visto > 0 && visto < meta) desde = visto;
        localStorage.setItem(clave, String(meta));
      } catch { /* sin almacenamiento: se muestra el estado final */ }
    }
    // Dos cuadros: primero pinta el valor anterior (sin transición), luego anima al nuevo.
    let segundo = 0;
    const primero = requestAnimationFrame(() => {
      if (desde !== meta) { setMover(false); setP(desde); }
      // Si viene de un paso anterior, espera a que se quite la pantalla de arranque para que el avance se vea.
      segundo = window.setTimeout(() => { setMover(true); setP(meta); }, desde !== meta ? 500 : 0);
    });
    return () => { cancelAnimationFrame(primero); clearTimeout(segundo); };
  }, [meta, recuerdo]);

  const completo = meta === 1;
  return (
    <svg viewBox="0 0 64 64" className={`${mover ? "anillo-mueve" : ""} ${className}`} role="img" aria-label={etiqueta ?? `Avance ${Math.round(meta * 100)} %`}>
      <circle cx="32" cy="32" r="21" fill="none" stroke="var(--linea)" strokeWidth="11" />
      <circle className="anillo-arco" cx="32" cy="32" r="21" fill="none" stroke={AZUL} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${LARGO_ANILLO * p} 200`} />
      <g className="anillo-giro" style={{ transform: `rotate(${GRADOS * p}deg)` }}>
        <circle cx="53" cy="32" r="6.5" fill={CIAN} />
      </g>
      <path className={`anillo-palomita ${completo ? "opacity-100" : "opacity-0"}`} d="M24 33 L30 39 L41 26" fill="none" stroke={AZUL} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Seguimiento: anillo + pasos con texto (el estado nunca se indica solo con color ni solo con animación). */
export function Progreso({ actual, recoger = false, recuerdo }: { actual: number; recoger?: boolean; recuerdo?: string }) {
  const cortas = recoger ? CORTAS_RECOGER : CORTAS;
  const etapas = recoger ? ETAPAS_CLIENTE_RECOGER : ETAPAS_CLIENTE;
  const i = Math.max(0, actual);
  return (
    <div className="flex items-center gap-5">
      <AnilloAvance actual={actual} recuerdo={recuerdo} etiqueta={`Pedido: ${etapas[i]}, ${(Math.min(3, i) + 1) * 25} %`} className="h-20 w-20 shrink-0" />
      <ol className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1.5 text-[14px]">
        {cortas.map((e, n) => (
          <li key={e} className={`flex items-center gap-2 ${n <= actual ? "font-semibold text-tinta" : "text-secundario"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${n < actual ? "bg-azul" : n === actual ? "bg-cian" : "bg-linea"}`} />
            {e}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Cargando: el anillo de marca completo gira (1.1 s por vuelta, lineal) con el punto al frente.
 * No aparece si la espera dura menos de 300 ms. 24 px en botones y listas; 48 px en pantallas completas.
 */
export function AnilloCargando({ className = "h-12 w-12", tono = "color" }: { className?: string; tono?: "color" | "negativo" }) {
  return (
    <svg viewBox="0 0 64 64" className={`anillo-gira ${className}`} role="img" aria-label="Cargando">
      <circle cx="32" cy="32" r="21" fill="none" stroke={tono === "negativo" ? "#fff" : AZUL} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${LARGO_ANILLO} 200`} />
      <circle cx="37.44" cy="11.72" r="6.5" fill={CIAN} />
    </svg>
  );
}

/**
 * Anillo dentro de un botón mientras se envía: se traza en 600 ms y, si el servidor tarda más, gira.
 * Con `listo` aparece la palomita cian (250 ms).
 */
export function AnilloBoton({ listo = false, className = "h-6 w-6" }: { listo?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={`${listo ? "" : "anillo-boton"} shrink-0 ${className}`} aria-hidden="true">
      {!listo && <circle className="anillo-boton-trazo" cx="32" cy="32" r="21" fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${LARGO_ANILLO} 200`} />}
      {listo && <path className="anillo-boton-palomita" d="M22 33 L29 40 L43 24" fill="none" stroke={CIAN} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}
