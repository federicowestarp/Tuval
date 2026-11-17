"use client";

import { useRef, useState, useTransition } from "react";
import { quitarFoto, subirFoto } from "./fotos";

/** Reduce la foto en el teléfono o la computadora antes de subirla (máx. 1000 px, JPEG): sube rápido y la tienda carga rápido. */
async function reducir(f: File): Promise<Blob> {
  const img = await createImageBitmap(f);
  const escala = Math.min(1, 1000 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * escala);
  c.height = Math.round(img.height * escala);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo procesar la foto"))), "image/jpeg", 0.85));
}

export function FotoProducto({ id, nombre, sku, url }: { id: string; nombre: string; sku: string; url: string | null }) {
  const [foto, setFoto] = useState(url);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, iniciar] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const elegir = (f: File | undefined) => {
    if (!f) return;
    setError(null);
    iniciar(async () => {
      try {
        const fd = new FormData();
        fd.set("producto_id", id);
        fd.set("foto", new File([await reducir(f)], `${sku}.jpg`, { type: "image/jpeg" }));
        const r = await subirFoto(fd);
        if (r.error) setError(r.error); else setFoto(r.url ?? null);
      } catch (e) { setError((e as Error).message); }
      if (input.current) input.current.value = "";
    });
  };

  return (
    <li className="flex flex-col overflow-hidden rounded-xl bg-white ring-1 ring-linea">
      <button type="button" onClick={() => input.current?.click()} className="relative flex aspect-square items-center justify-center bg-piedra" aria-label={`Foto de ${nombre}`}>
        {foto
          // eslint-disable-next-line @next/next/no-img-element -- foto propia
          ? <img src={foto} alt="" className="h-full w-full object-contain p-1" />
          : <span className="text-[13px] font-semibold text-azul">+ Agregar foto</span>}
        {subiendo && <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-[13px] font-semibold">Subiendo…</span>}
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => elegir(e.target.files?.[0])} />
      <div className="flex flex-1 flex-col p-2">
        <p className="line-clamp-2 text-[13px] leading-snug">{nombre}</p>
        <p className="text-[11px] text-secundario">{sku}</p>
        {error && <p className="text-[12px] text-red-700">{error}</p>}
        <div className="mt-auto flex justify-between pt-1 text-[12px]">
          <button type="button" onClick={() => input.current?.click()} className="font-semibold text-azul">{foto ? "Cambiar" : "Subir"}</button>
          {foto && (
            <button type="button" onClick={() => iniciar(async () => { const fd = new FormData(); fd.set("producto_id", id); await quitarFoto(fd); setFoto(null); })} className="text-secundario hover:text-red-700">Quitar</button>
          )}
        </div>
      </div>
    </li>
  );
}
