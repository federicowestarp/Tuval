"use client";

import { useRef } from "react";

/** Botón de formulario que, antes de enviar, intenta agregar la ubicación actual (lat/lng ocultos). */
export function ConUbicacion({ children, className }: { children: React.ReactNode; className?: string }) {
  const lat = useRef<HTMLInputElement>(null);
  const lng = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={lat} type="hidden" name="lat" />
      <input ref={lng} type="hidden" name="lng" />
      <button
        className={className}
        onClick={(e) => {
          const form = e.currentTarget.form;
          if (!form || !navigator.geolocation || lat.current?.value) return;
          e.preventDefault();
          const enviar = () => form.requestSubmit();
          navigator.geolocation.getCurrentPosition(
            (p) => { lat.current!.value = String(p.coords.latitude); lng.current!.value = String(p.coords.longitude); enviar(); },
            enviar,
            { enableHighAccuracy: true, timeout: 6000, maximumAge: 60_000 },
          );
        }}
      >
        {children}
      </button>
    </>
  );
}
