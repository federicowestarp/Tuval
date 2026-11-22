"use client";

import { ElegirArchivo } from "@/components/ElegirArchivo";
import { useState, useTransition } from "react";
import { enviarOGuardar } from "@/lib/cola";
import { campo, clasesBoton } from "@/components/ui";

export function FormCombustible() {
  const [e, setE] = useState<{ error?: string; ok?: boolean; sinSenal?: boolean }>({});
  const [enviando, iniciar] = useTransition();
  const accion = (fd: FormData) => iniciar(async () => {
    const r = await enviarOGuardar("cargarCombustible", fd, `Carga de gasolina · ${fd.get("litros")} L`);
    setE(r.estado === "error" ? { error: r.error } : { ok: true, sinSenal: r.estado === "guardado" });
  });
  return (
    <details className="rounded-[20px] bg-white p-4">
      <summary className="cursor-pointer font-semibold">Cargar gasolina</summary>
      <form action={accion} className="mt-3 grid grid-cols-2 gap-2">
        <input name="litros" inputMode="decimal" placeholder="Litros" required className={campo} />
        <input name="monto" inputMode="decimal" placeholder="Monto $" required className={campo} />
        <input name="odometro" inputMode="numeric" placeholder="Odómetro (km)" className={campo} />
        <select name="forma_pago" className={campo}><option>Efectivo</option><option>Tarjeta</option><option>Vales</option></select>
        <div className="col-span-2"><ElegirArchivo name="ticket" accept="image/*" capture="environment" required texto="Foto del ticket" ayuda="Obligatoria" /></div>
        {e.error && <p role="alert" className="col-span-2 font-semibold text-red-700">{e.error}</p>}
        {e.ok && !e.error && <p className="col-span-2 font-semibold text-azul">{e.sinSenal ? "Carga guardada sin señal; se envía sola al volver la conexión." : "Carga registrada."}</p>}
        <button disabled={enviando} className={`${clasesBoton("principal", "normal")} col-span-2`}>{enviando ? "Guardando…" : "Guardar carga"}</button>
      </form>
    </details>
  );
}
