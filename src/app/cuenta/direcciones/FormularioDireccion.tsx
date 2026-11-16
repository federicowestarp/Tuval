"use client";

import { useActionState, useState } from "react";
import dynamic from "next/dynamic";
import { guardarDireccion, type EstadoDireccion } from "./acciones";
import { CampoFoto } from "@/components/formularios/CampoFoto";
import { Segmentado } from "@/components/Segmentado";
import { campo, clasesBoton, etiqueta } from "@/components/ui";
import { ESTADOS } from "@/lib/corte";

const MapaUbicacion = dynamic(() => import("@/components/formularios/MapaUbicacion").then((m) => m.MapaUbicacion), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-[20px] bg-niebla" />,
});

export function FormularioDireccion({ volver }: { volver?: string }) {
  const [estado, accion, enviando] = useActionState<EstadoDireccion, FormData>(guardarDireccion, {});
  const v = estado.campos ?? {};
  const [tipo, setTipo] = useState(v.tipo ?? "obra");
  const [pref, setPref] = useState(v.preferencia_contacto ?? "whatsapp");

  return (
    <form action={accion} className="space-y-8">
      {volver && <input type="hidden" name="volver" value={volver} />}

      <div className="space-y-4">
        <Segmentado name="tipo" valor={tipo} onCambio={setTipo} opciones={[{ id: "obra", texto: "Obra" }, { id: "particular", texto: "Particular" }]} />
        <div>
          <label className={etiqueta} htmlFor="alias">Nombre</label>
          <input id="alias" name="alias" defaultValue={v.alias} className={campo} placeholder={tipo === "obra" ? "Ej. Obra Lomas" : "Ej. Casa"} required />
        </div>
        <div>
          <label className={etiqueta} htmlFor="direccion">Dirección</label>
          <input id="direccion" name="direccion" defaultValue={v.direccion} className={campo} placeholder="Calle, número, colonia, C.P." autoComplete="street-address" required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={etiqueta} htmlFor="entidad">Estado</label>
            <select id="entidad" name="entidad" defaultValue={v.entidad ?? ""} className={campo} required>
              <option value="" disabled>Elige…</option>
              {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className={etiqueta} htmlFor="municipio">Municipio o ciudad</label>
            <input id="municipio" name="municipio" defaultValue={v.municipio} className={campo} autoComplete="address-level2" required />
          </div>
        </div>
      </div>

      <div className="space-y-4 border-t border-linea pt-8">
        <h2 className="font-display text-xl font-semibold">Ubicación exacta</h2>
        <MapaUbicacion />
        <CampoFoto name="foto" etiqueta="Foto de la entrada (opcional)" ayuda="Así el chofer llega a la primera." />
      </div>

      <div className="space-y-4 border-t border-linea pt-8">
        <h2 className="font-display text-xl font-semibold">¿Quién recibe?</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={etiqueta} htmlFor="recibe_nombre">Nombre</label>
            <input id="recibe_nombre" name="recibe_nombre" defaultValue={v.recibe_nombre} className={campo} placeholder={tipo === "obra" ? "Residente o encargado" : ""} required />
          </div>
          <div>
            <label className={etiqueta} htmlFor="recibe_telefono">Teléfono</label>
            <input id="recibe_telefono" name="recibe_telefono" defaultValue={v.recibe_telefono} inputMode="tel" className={campo} placeholder="10 dígitos" required />
          </div>
        </div>
        <div>
          <span className={etiqueta}>Contactarlo por</span>
          <Segmentado name="preferencia_contacto" valor={pref} onCambio={setPref} opciones={[{ id: "whatsapp", texto: "WhatsApp" }, { id: "telefono", texto: "Llamada" }]} />
        </div>
        {tipo === "obra" && (
          <label className="flex cursor-pointer items-start justify-between gap-4 rounded-[20px] bg-niebla p-5">
            <span>
              <span className="block font-semibold">Entregar sin que alguien reciba</span>
              <span className="block text-[14px] text-secundario">El chofer deja foto con ubicación como comprobante.</span>
            </span>
            <input type="checkbox" name="permite_sin_recepcion" defaultChecked={v.permite_sin_recepcion === "on"} className="peer sr-only" />
            <span className="relative mt-1 h-7 w-12 shrink-0 rounded-full bg-secundario/30 transition peer-checked:bg-azul after:absolute after:left-0.5 after:top-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
          </label>
        )}
        <div>
          <label className={etiqueta} htmlFor="indicaciones">Indicaciones (opcional)</label>
          <input id="indicaciones" name="indicaciones" defaultValue={v.indicaciones} className={campo} placeholder="Ej. portón azul, entrar por atrás" />
        </div>
      </div>

      {estado.error && <p role="alert" className="aparecer rounded-2xl bg-red-50 p-4 font-semibold text-red-700">{estado.error}</p>}
      <button disabled={enviando} className={clasesBoton("principal", "grande", true)}>
        {enviando ? "Guardando…" : "Guardar dirección"}
      </button>
    </form>
  );
}
