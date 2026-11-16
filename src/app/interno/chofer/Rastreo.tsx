"use client";

import { useEffect, useState } from "react";
import { registrarPosicion } from "./acciones";

/** Mientras la ruta está activa y esta pantalla abierta, manda la ubicación cada minuto. */
export function Rastreo() {
  const [estado, setEstado] = useState("Obteniendo ubicación…");
  useEffect(() => {
    if (!navigator.geolocation) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- aviso único si el navegador no tiene GPS
      setEstado("Este teléfono no comparte ubicación.");
      return;
    }
    let ultimo = 0;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const ahora = Date.now();
        if (ahora - ultimo < 60_000) return;
        ultimo = ahora;
        registrarPosicion(p.coords.latitude, p.coords.longitude, p.coords.accuracy ?? null).catch(() => {});
        setEstado(`Ubicación compartida · ${new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`);
      },
      () => setEstado("Activa la ubicación para que el cliente vea por dónde vas."),
      { enableHighAccuracy: true, maximumAge: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);
  return (
    <p className="flex items-center gap-2 text-[13px] text-secundario">
      <span className="h-2 w-2 animate-pulse rounded-full bg-cian" /> {estado}
    </p>
  );
}
