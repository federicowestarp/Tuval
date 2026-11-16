"use client";

import { useActionState } from "react";
import { campo, clasesBoton, etiqueta } from "@/components/ui";
import { entrar, type EstadoSesion } from "../sesion-acciones";

export function FormEntrar() {
  const [e, accion, enviando] = useActionState<EstadoSesion, FormData>(entrar, {});
  return (
    <form action={accion} className="mt-8 space-y-4 rounded-[28px] bg-white p-6">
      <div>
        <label className={etiqueta} htmlFor="correo">Correo</label>
        <input id="correo" name="correo" type="email" defaultValue={e.correo} autoComplete="username" className={campo} required />
      </div>
      <div>
        <label className={etiqueta} htmlFor="contrasena">Contraseña</label>
        <input id="contrasena" name="contrasena" type="password" autoComplete="current-password" className={campo} required />
      </div>
      {e.error && <p role="alert" className="text-[15px] font-semibold text-red-700">{e.error}</p>}
      <button disabled={enviando} className={clasesBoton("principal", "grande", true)}>{enviando ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
