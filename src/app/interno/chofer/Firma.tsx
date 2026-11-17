"use client";

import { useEffect, useRef, useState } from "react";

/** Firma con el dedo en pantalla. Entrega un PNG listo para subir (o null si está vacía). */
export function Firma({ onCambio }: { onCambio: (archivo: File | null) => void }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const trazo = useRef(false);
  const [vacia, setVacia] = useState(true);

  useEffect(() => {
    const c = lienzo.current!;
    const escala = window.devicePixelRatio || 1;
    c.width = c.clientWidth * escala; c.height = c.clientHeight * escala;
    const ctx = c.getContext("2d")!;
    ctx.scale(escala, escala); ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#1D1D1F";
  }, []);

  const punto = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const exportar = () => lienzo.current!.toBlob((b) => onCambio(b ? new File([b], "firma.png", { type: "image/png" }) : null), "image/png");

  return (
    <div>
      <canvas
        ref={lienzo}
        className="h-36 w-full touch-none rounded-xl bg-white ring-1 ring-linea"
        onPointerDown={(e) => { dibujando.current = true; e.currentTarget.setPointerCapture(e.pointerId); const p = punto(e); const ctx = e.currentTarget.getContext("2d")!; ctx.beginPath(); ctx.moveTo(p.x, p.y); }}
        onPointerMove={(e) => { if (!dibujando.current) return; const p = punto(e); const ctx = e.currentTarget.getContext("2d")!; ctx.lineTo(p.x, p.y); ctx.stroke(); trazo.current = true; setVacia(false); }}
        onPointerUp={() => { dibujando.current = false; if (trazo.current) exportar(); }}
        aria-label="Firma de quien recibe"
      />
      <div className="mt-1 flex justify-between text-[13px] text-secundario">
        <span>{vacia ? "Firma aquí con el dedo" : "Firma capturada ✓"}</span>
        <button type="button" onClick={() => { const c = lienzo.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); trazo.current = false; setVacia(true); onCambio(null); }}>Borrar</button>
      </div>
    </div>
  );
}
