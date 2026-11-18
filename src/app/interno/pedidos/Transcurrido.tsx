"use client";

import { useEffect, useState } from "react";

const texto = (ms: number) => {
  const min = Math.max(0, Math.floor(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ${min % 60} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
};

/** Tiempo desde una fecha, que se actualiza solo cada 30 s (sin recargar la página). */
export function Transcurrido({ desde, inicial }: { desde: string; inicial: string }) {
  const [t, setT] = useState(inicial);
  useEffect(() => {
    const f = () => setT(texto(Date.now() - new Date(desde).getTime()));
    f();
    const id = setInterval(f, 30_000);
    return () => clearInterval(id);
  }, [desde]);
  return <>{t}</>;
}

