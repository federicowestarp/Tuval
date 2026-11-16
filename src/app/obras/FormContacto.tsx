"use client";

import { useActionState } from "react";
import { areaTexto, campo, clasesBoton, etiqueta } from "@/components/ui";
import { IconoCheck } from "@/components/Iconos";
import { enviarContacto, type EstadoContacto } from "./acciones";

export function FormContacto() {
  const [e, accion, enviando] = useActionState<EstadoContacto, FormData>(enviarContacto, {});
  const v = e.campos ?? {};
  if (e.ok)
    return (
      <div className="flex items-center gap-3 rounded-[20px] bg-white p-6">
        <IconoCheck className="h-6 w-6 text-azul" />
        <p className="font-semibold">Gracias. Te contactamos en menos de un día hábil.</p>
      </div>
    );
  return (
    <form action={accion} className="space-y-4 rounded-[28px] bg-white p-6">
      <input type="hidden" name="tipo" value="obra" />
      <input name="sitio" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={etiqueta} htmlFor="nombre">Nombre</label><input id="nombre" name="nombre" defaultValue={v.nombre} className={campo} autoComplete="name" required /></div>
        <div><label className={etiqueta} htmlFor="empresa">Empresa (opcional)</label><input id="empresa" name="empresa" defaultValue={v.empresa} className={campo} autoComplete="organization" /></div>
        <div><label className={etiqueta} htmlFor="telefono">Celular</label><input id="telefono" name="telefono" defaultValue={v.telefono} inputMode="tel" className={campo} autoComplete="tel" required /></div>
        <div><label className={etiqueta} htmlFor="correo">Correo (opcional)</label><input id="correo" name="correo" type="email" defaultValue={v.correo} className={campo} autoComplete="email" /></div>
      </div>
      <div><label className={etiqueta} htmlFor="mensaje">Cuéntanos de tu obra</label><textarea id="mensaje" name="mensaje" defaultValue={v.mensaje} rows={3} className={areaTexto} placeholder="Ubicación, tipo de obra, qué material necesitas y desde cuándo" /></div>
      {e.error && <p role="alert" className="font-semibold text-red-700">{e.error}</p>}
      <button disabled={enviando} className={clasesBoton("principal", "grande", true)}>{enviando ? "Enviando…" : "Quiero que me contacten"}</button>
    </form>
  );
}
