"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AccionCola } from "@/app/cola-acciones";
import { enviarOGuardar } from "@/lib/cola";

/**
 * Formulario que funciona con o sin señal. Con señal se aplica al momento; sin señal se guarda en el teléfono
 * (con la hora real) y se envía solo al volver la conexión. `siguiente` es lo que se muestra después
 * (por ejemplo el siguiente paso de la entrega), para poder seguir trabajando sin esperar al servidor.
 */
export function FormCola({ accion, descripcion, children, siguiente, className }: {
  accion: AccionCola; descripcion: string; children: React.ReactNode; siguiente?: React.ReactNode; className?: string;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<"listo" | "guardado" | "enviado">("listo");
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  if (estado !== "listo") {
    return (
      <>
        {estado === "guardado" && <p className="rounded-xl bg-niebla px-3 py-2 text-[13px] text-secundario">Guardado sin señal ✓ Se envía solo al volver la conexión.</p>}
        {siguiente}
      </>
    );
  }
  return (
    <form
      className={className}
      aria-busy={enviando}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        setError(null);
        iniciar(async () => {
          const r = await enviarOGuardar(accion, fd, descripcion);
          if (r.estado === "error") { setError(r.error); return; }
          if (r.estado === "guardado") { setEstado("guardado"); return; }
          setEstado("enviado");
          router.refresh();
        });
      }}
    >
      {children}
      {error && <p role="alert" className="mt-2 font-semibold text-red-700">{error}</p>}
    </form>
  );
}
