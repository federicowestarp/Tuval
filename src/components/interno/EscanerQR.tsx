"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

/**
 * Lector de QR con la cámara del dispositivo (tablet de caja, celular del equipo).
 * Funciona en iPhone/iPad y Android sin instalar nada. Llama onLeer con el texto del QR.
 */
export function EscanerQR({ onLeer, onCerrar, titulo = "Escanea el QR" }: { onLeer: (texto: string) => void; onCerrar: () => void; titulo?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const leido = useRef(false);
  const avisar = useRef(onLeer);
  useEffect(() => { avisar.current = onLeer; }, [onLeer]);

  useEffect(() => {
    let flujo: MediaStream | null = null;
    let cuadro = 0;
    let vivo = true;
    (async () => {
      try {
        flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (!vivo) return;
        const v = video.current!;
        v.srcObject = flujo;
        await v.play();
        const leer = () => {
          if (!vivo || leido.current) return;
          const c = lienzo.current!;
          if (v.readyState === v.HAVE_ENOUGH_DATA && v.videoWidth) {
            const escala = Math.min(1, 640 / v.videoWidth);
            c.width = v.videoWidth * escala; c.height = v.videoHeight * escala;
            const ctx = c.getContext("2d", { willReadFrequently: true })!;
            ctx.drawImage(v, 0, 0, c.width, c.height);
            const r = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: "dontInvert" });
            if (r?.data) { leido.current = true; navigator.vibrate?.(60); avisar.current(r.data); return; }
          }
          cuadro = requestAnimationFrame(leer);
        };
        cuadro = requestAnimationFrame(leer);
      } catch {
        setError("No se pudo abrir la cámara. Da permiso de cámara a esta página en el navegador.");
      }
    })();
    return () => { vivo = false; cancelAnimationFrame(cuadro); flujo?.getTracks().forEach((t) => t.stop()); };
  }, []);

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black/90 p-4 text-white" role="dialog" aria-label={titulo}>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold">{titulo}</p>
        <button type="button" onClick={onCerrar} className="rounded-full bg-white/15 px-4 py-2 font-semibold">Cerrar</button>
      </div>
      <div className="relative mx-auto w-full max-w-md flex-1">
        <video ref={video} playsInline muted className="h-full max-h-[70vh] w-full rounded-2xl object-cover" />
        <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-white/80" />
      </div>
      <canvas ref={lienzo} className="hidden" />
      {error && <p className="mt-3 rounded-xl bg-red-600 p-3 text-center">{error}</p>}
    </div>
  );
}

/** Saca el SKU de un QR de etiqueta (…/producto/SKU?e=1) o del de surtido; null si no es de producto. */
export function skuDeQr(texto: string): string | null {
  const m = texto.match(/\/producto\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Código del carrito de tienda en el QR (…carrito=ABC123) o el código escrito a mano. */
export function codigoCarritoDeQr(texto: string): string | null {
  const m = texto.match(/carrito=([A-Z0-9]{4,10})/i) ?? texto.trim().match(/^([A-Z0-9]{6})$/i);
  return m ? m[1].toUpperCase() : null;
}
