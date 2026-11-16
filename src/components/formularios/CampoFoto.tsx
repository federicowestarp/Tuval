"use client";

import { useRef, useState } from "react";

/** Toma o elige una foto y la reduce en el teléfono (máx. 1600 px, JPEG) antes de subirla. */
export function CampoFoto({ name, etiqueta, ayuda }: { name: string; etiqueta: string; ayuda?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  async function alCambiar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    setProcesando(true);
    try {
      const bmp = await createImageBitmap(f);
      const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * escala);
      canvas.height = Math.round(bmp.height * escala);
      canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.8));
      if (blob && input.current) {
        const dt = new DataTransfer();
        dt.items.add(new File([blob], "foto.jpg", { type: "image/jpeg" }));
        input.current.files = dt.files;
        setVista(URL.createObjectURL(blob));
      }
    } catch {
      setVista(URL.createObjectURL(f)); // si no se puede reducir, se sube tal cual
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div>
      <span className="mb-1 block text-sm font-semibold">{etiqueta}</span>
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-cianclaro p-3">
        {vista ? (
          // eslint-disable-next-line @next/next/no-img-element -- vista previa local
          <img src={vista} alt="" className="h-20 w-20 rounded-md object-cover" />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-md bg-niebla text-3xl text-acero">📷</span>
        )}
        <span className="text-sm">{procesando ? "Procesando…" : vista ? "Cambiar foto" : "Tomar o elegir foto"}</span>
        <input ref={input} type="file" name={name} accept="image/*" capture="environment" onChange={alCambiar} className="sr-only" />
      </label>
      {ayuda && <p className="mt-1 text-xs text-acero">{ayuda}</p>}
    </div>
  );
}
