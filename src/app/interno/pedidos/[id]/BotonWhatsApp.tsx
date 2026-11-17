"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/** Botón que registra el paso en el sistema y abre WhatsApp con el mensaje ya escrito. */
export function BotonWhatsApp({ accion, id, texto, hecho }: { accion: (id: string) => Promise<{ url?: string; error?: string }>; id: string; texto: string; hecho?: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const router = useRouter();
  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" disabled={enviando} onClick={() => iniciar(async () => {
        const r = await accion(id);
        if (r.error) { setError(r.error); return; }
        if (r.url) window.open(r.url, "_blank");
        router.refresh();
      })} className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${hecho ? "border border-azul text-azul" : "bg-azul text-white"}`}>
        {enviando ? "Abriendo…" : hecho ? `${texto} otra vez` : texto}
      </button>
      {hecho && <span className="text-[12px] text-secundario">Enviado {hecho}</span>}
      {error && <span className="text-[12px] font-semibold text-red-700">{error}</span>}
    </span>
  );
}
