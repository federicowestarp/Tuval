"use client";

import { useState, useTransition } from "react";
import { enviarOGuardar } from "@/lib/cola";
import Link from "next/link";
import { clasesBoton } from "@/components/ui";
import type { EstadoConteo } from "../../acciones";

export function FormConteo({ tarjetaId, turno, folio, inventarioId }: { tarjetaId: string; turno: number; folio?: string | number; inventarioId?: string }) {
  const [e, setE] = useState<EstadoConteo & { sinSenal?: boolean }>({});
  const [enviando, iniciar] = useTransition();
  // Con o sin señal: sin señal se guarda en el teléfono y se envía solo (las reglas del conteo ciego se revisan al llegar).
  const accion = (fd: FormData) => iniciar(async () => {
    const r = await enviarOGuardar("registrarConteo", fd, `Conteo ${turno}º · tarjeta ${folio ?? ""} · ${fd.get("cantidad")}`.trim());
    if (r.estado === "error") return setE({ error: r.error });
    if (r.estado === "guardado") return setE({ mensaje: "Conteo guardado sin señal ✓ Se envía solo al volver la conexión.", sinSenal: true });
    setE(r.respuesta.resultado as EstadoConteo);
  });
  if (e.mensaje) return (
    <div className="space-y-3">
      <p className="rounded-xl bg-emerald-50 p-3 font-semibold text-emerald-800">{e.mensaje}</p>
      {e.siguiente ? <Link href={`/interno/inventario-fisico/t/${e.siguiente}`} className={clasesBoton("principal", "grande", true)}>Siguiente tarjeta</Link>
        : e.sinSenal ? (inventarioId ? <a href={`/interno/inventario-fisico/${inventarioId}`} className={clasesBoton("principal", "grande", true)}>Volver a las tarjetas</a> : null)
        : <p className="text-[14px] text-secundario">No te quedan tarjetas por contar en este inventario.</p>}
    </div>
  );
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="tarjeta_id" value={tarjetaId} />
      <label className="block">
        <span className="mb-1 block text-[14px] font-semibold">{turno}º conteo · ¿cuántas hay?</span>
        <input name="cantidad" inputMode="decimal" autoFocus required className="h-14 w-full rounded-2xl border border-linea text-center text-[28px] font-semibold" />
      </label>
      <p className="text-[13px] text-secundario">Cuenta lo que ves físicamente. No se muestra lo que dice el sistema.</p>
      {e.error && <p className="font-semibold text-red-700">{e.error}</p>}
      <button disabled={enviando} className={clasesBoton("principal", "grande", true)}>{enviando ? "Guardando…" : "Guardar conteo"}</button>
    </form>
  );
}
