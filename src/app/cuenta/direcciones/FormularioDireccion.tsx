"use client";

import { useActionState, useState } from "react";
import dynamic from "next/dynamic";
import { guardarDireccion, type EstadoDireccion } from "./acciones";
import { CampoFoto } from "@/components/formularios/CampoFoto";
import { ZONAS } from "@/lib/corte";

const MapaUbicacion = dynamic(() => import("@/components/formularios/MapaUbicacion").then((m) => m.MapaUbicacion), {
  ssr: false,
  loading: () => <div className="h-64 rounded-lg bg-niebla" />,
});

export const campo = "w-full rounded-lg border border-cianclaro bg-white px-3 py-3 text-base outline-none focus:ring-4 focus:ring-cian";
export const etiqueta = "mb-1 block text-sm font-semibold";

function Opciones({ name, valor, setValor, opciones }: { name: string; valor: string; setValor: (v: string) => void; opciones: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {opciones.map(([id, n]) => (
        <label key={id} className={`cursor-pointer rounded-lg border-2 p-3 text-center font-semibold ${valor === id ? "border-azul bg-cianclaro" : "border-cianclaro"}`}>
          <input type="radio" name={name} value={id} checked={valor === id} onChange={() => setValor(id)} className="sr-only" />
          {n}
        </label>
      ))}
    </div>
  );
}

export function FormularioDireccion({ volver }: { volver?: string }) {
  const [estado, accion, enviando] = useActionState<EstadoDireccion, FormData>(guardarDireccion, {});
  const v = estado.campos ?? {};
  const [tipo, setTipo] = useState(v.tipo ?? "obra");
  const [pref, setPref] = useState(v.preferencia_contacto ?? "whatsapp");

  return (
    <form action={accion} className="space-y-4 rounded-xl bg-white p-4">
      {volver && <input type="hidden" name="volver" value={volver} />}
      <h2 className="font-display text-xl font-bold">Nueva dirección</h2>
      <fieldset>
        <legend className={etiqueta}>¿Qué es?</legend>
        <Opciones name="tipo" valor={tipo} setValor={setTipo} opciones={[["obra", "Obra"], ["particular", "Particular"]]} />
      </fieldset>
      <div>
        <label className={etiqueta} htmlFor="alias">Nombre para reconocerla</label>
        <input id="alias" name="alias" defaultValue={v.alias} className={campo} placeholder={tipo === "obra" ? "Ej. Obra Lomas de Angelópolis" : "Ej. Casa"} required />
      </div>
      <div>
        <label className={etiqueta} htmlFor="direccion">Dirección completa</label>
        <textarea id="direccion" name="direccion" defaultValue={v.direccion} rows={2} className={campo} placeholder="Calle, número, colonia, C.P." required />
      </div>
      <div>
        <label className={etiqueta} htmlFor="zona">Zona</label>
        <select id="zona" name="zona" defaultValue={v.zona ?? "puebla"} className={campo}>
          {ZONAS.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
        </select>
      </div>
      <div>
        <span className={etiqueta}>Ubicación en el mapa</span>
        <MapaUbicacion />
      </div>
      <CampoFoto name="foto" etiqueta="Foto de la fachada o entrada (opcional)" ayuda="Ayuda al chofer a encontrar el lugar a la primera." />

      <div className="rounded-lg bg-niebla p-3">
        <p className="font-semibold">¿Quién recibe ahí?</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={etiqueta} htmlFor="recibe_nombre">Nombre</label>
            <input id="recibe_nombre" name="recibe_nombre" defaultValue={v.recibe_nombre} className={campo} placeholder={tipo === "obra" ? "Residente o encargado" : ""} required />
          </div>
          <div>
            <label className={etiqueta} htmlFor="recibe_telefono">Teléfono</label>
            <input id="recibe_telefono" name="recibe_telefono" defaultValue={v.recibe_telefono} inputMode="tel" className={campo} required />
          </div>
        </div>
        <fieldset className="mt-3">
          <legend className={etiqueta}>Prefiere que lo contacten por</legend>
          <Opciones name="preferencia_contacto" valor={pref} setValor={setPref} opciones={[["whatsapp", "WhatsApp"], ["telefono", "Llamada"]]} />
        </fieldset>
      </div>

      {tipo === "obra" && (
        <label className="flex items-start gap-3 rounded-lg bg-niebla p-3 text-sm">
          <input type="checkbox" name="permite_sin_recepcion" defaultChecked={v.permite_sin_recepcion === "on"} className="mt-1 h-5 w-5" />
          <span>Pueden dejar el material sin que alguien reciba. El chofer deja foto con ubicación como comprobante.</span>
        </label>
      )}
      <div>
        <label className={etiqueta} htmlFor="indicaciones">Indicaciones para el chofer (opcional)</label>
        <input id="indicaciones" name="indicaciones" defaultValue={v.indicaciones} className={campo} placeholder="Ej. portón azul, entrar por la calle de atrás" />
      </div>

      {estado.error && <p role="alert" className="rounded-lg p-3 font-semibold text-red-700 ring-2 ring-red-200">{estado.error}</p>}
      <button disabled={enviando} className="w-full rounded-xl bg-azul py-4 text-lg font-bold text-white disabled:opacity-60">
        {enviando ? "Guardando…" : "Guardar dirección"}
      </button>
    </form>
  );
}
