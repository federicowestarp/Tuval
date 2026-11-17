"use client";

import { useActionState, useState } from "react";
import { Segmentado } from "@/components/Segmentado";
import { clasesBoton } from "@/components/ui";
import { invitar, type EstadoInvitar } from "./acciones";

export function FormInvitar() {
  const [e, accion, enviando] = useActionState<EstadoInvitar, FormData>(invitar, {});
  const [rol, setRol] = useState("operador");
  const [copiado, setCopiado] = useState(false);
  const mensaje = e.liga ? `Te invito al panel de Tuval. Crea tu acceso aquí (vale 24 horas, un solo uso): ${e.liga}` : "";
  return (
    <div className="space-y-4">
      <form action={accion} className="space-y-3">
        <Segmentado name="rol" valor={rol} onCambio={setRol} opciones={[{ id: "operador", texto: "Operador" }, { id: "mostrador", texto: "Mostrador" }, { id: "chofer", texto: "Chofer" }, { id: "admin", texto: "Admin" }]} />
        <button disabled={enviando} className={clasesBoton("principal", "normal")}>{enviando ? "Generando…" : "Generar invitación"}</button>
      </form>
      {e.liga && (
        <div className="aparecer space-y-3 rounded-[20px] bg-niebla p-4">
          <p className="text-[13px] text-secundario">Invitación de {e.rol}. Vale 24 horas y un solo uso. Compártela solo con esa persona.</p>
          <p className="break-all font-mono text-[13px]">{e.liga}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { navigator.clipboard.writeText(e.liga!); setCopiado(true); }} className={clasesBoton("principal", "chico")}>
              {copiado ? "Copiada ✓" : "Copiar liga"}
            </button>
            <a href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`} target="_blank" className={clasesBoton("secundario", "chico")}>Mandar por WhatsApp</a>
          </div>
        </div>
      )}
    </div>
  );
}
