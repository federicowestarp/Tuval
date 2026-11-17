"use client";

import { useEffect, useState } from "react";
import { registrarPosicion } from "./acciones";

const CADA_MS = 30_000;

/**
 * Mientras la ruta está activa y esta pantalla abierta, manda la ubicación cada 30 s
 * y pide al teléfono no apagar la pantalla (Wake Lock). Con la pantalla bloqueada el navegador
 * deja de mandar; para eso está la app de rastreo en segundo plano (ver Flotilla).
 */
export function Rastreo() {
  const [estado, setEstado] = useState("Obteniendo ubicación…");
  const [pantalla, setPantalla] = useState<"activa" | "no" | null>(null);

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
        if (ahora - ultimo < CADA_MS) return;
        ultimo = ahora;
        registrarPosicion(p.coords.latitude, p.coords.longitude, p.coords.accuracy ?? null).catch(() => {});
        setEstado(`Ubicación compartida · ${new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`);
      },
      () => setEstado("Activa la ubicación para que el cliente vea por dónde vas."),
      { enableHighAccuracy: true, maximumAge: 15_000 },
    );

    // Mantener la pantalla encendida mientras haya ruta; se vuelve a pedir al regresar a la app.
    type Candado = { release: () => Promise<void> };
    let candado: Candado | null = null;
    const pedir = async () => {
      try {
        const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Candado> } }).wakeLock;
        if (!wl) { setPantalla("no"); return; }
        candado = await wl.request("screen");
        setPantalla("activa");
      } catch { setPantalla("no"); }
    };
    const alVolver = () => { if (document.visibilityState === "visible") pedir(); };
    pedir();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      navigator.geolocation.clearWatch(id);
      document.removeEventListener("visibilitychange", alVolver);
      candado?.release().catch(() => {});
    };
  }, []);

  return (
    <div className="space-y-1">
      <p className="flex items-center gap-2 text-[13px] text-secundario">
        <span className="h-2 w-2 animate-pulse rounded-full bg-cian" /> {estado}
      </p>
      {pantalla === "activa" && <p className="text-[12px] text-secundario">Pantalla encendida mientras dure la ruta. Si bloqueas el teléfono, deja de mandar ubicación.</p>}
      {pantalla === "no" && <p className="text-[12px] text-secundario">Deja esta pantalla abierta: si se bloquea el teléfono, deja de mandar ubicación.</p>}
    </div>
  );
}
