"use client";

import { useActionState } from "react";
import { campo, clasesBoton, etiqueta } from "@/components/ui";
import { activar, type EstadoActivar } from "../../sesion-acciones";

export function FormActivar({ token }: { token: string }) {
  const [e, accion, enviando] = useActionState<EstadoActivar, FormData>(activar, {});
  const v = e.campos ?? {};
  return (
    <form action={accion} className="mt-8 space-y-4 rounded-[28px] bg-white p-6">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className={etiqueta} htmlFor="nombre">Nombre</label>
        <input id="nombre" name="nombre" defaultValue={v.nombre} autoComplete="name" className={campo} required />
      </div>
      <div>
        <label className={etiqueta} htmlFor="correo">Correo</label>
        <input id="correo" name="correo" type="email" defaultValue={v.correo} autoComplete="username" className={campo} required />
      </div>
      <div>
        <label className={etiqueta} htmlFor="contrasena">Contraseña</label>
        <input id="contrasena" name="contrasena" type="password" autoComplete="new-password" className={campo} required />
        <p className="mt-1.5 text-[13px] text-secundario">Mínimo 10 caracteres, con letras y números.</p>
      </div>
      <div>
        <label className={etiqueta} htmlFor="confirmacion">Repite la contraseña</label>
        <input id="confirmacion" name="confirmacion" type="password" autoComplete="new-password" className={campo} required />
      </div>
      {e.error && <p role="alert" className="text-[15px] font-semibold text-red-700">{e.error}</p>}
      <button disabled={enviando} className={clasesBoton("principal", "grande", true)}>{enviando ? "Creando…" : "Crear mi acceso"}</button>
    </form>
  );
}
