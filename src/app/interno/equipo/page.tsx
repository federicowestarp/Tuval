import { Suspense } from "react";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { NavegacionInterna } from "../Navegacion";
import { cambiarActivo } from "./acciones";
import { FormInvitar } from "./FormInvitar";

export default function Equipo() {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="equipo" />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6">
        <h1 className="font-display text-2xl font-semibold">Equipo</h1>
        <Suspense fallback={<p className="text-sm text-secundario">Cargando…</p>}>
          <Contenido />
        </Suspense>
      </main>
    </div>
  );
}

async function Contenido() {
  await connection();
  const yo = await requerirInterno("admin");
  const usuarios = await sql<{ id: string; nombre: string; correo: string; rol: string; activo: boolean; ultimo_acceso: Date | null }[]>`
    select id, nombre, correo, rol, activo, ultimo_acceso from usuarios_internos order by activo desc, nombre`;
  return (
    <>
      <section className="rounded-[20px] bg-white p-5">
        <h2 className="mb-3 font-semibold">Invitar a alguien</h2>
        <FormInvitar />
      </section>
      <section className="rounded-[20px] bg-white p-5">
        <h2 className="mb-2 font-semibold">Usuarios</h2>
        <ul className="divide-y divide-linea">
          {usuarios.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 py-3">
              <div className={u.activo ? "" : "opacity-50"}>
                <p className="font-semibold">{u.nombre} <span className="text-[13px] font-normal text-secundario">· {u.rol === "admin" ? "Administrador" : u.rol === "chofer" ? "Chofer" : "Operador"}{!u.activo && " · dado de baja"}</span></p>
                <p className="text-[13px] text-secundario">
                  {u.correo} · {u.ultimo_acceso ? `último acceso ${new Date(u.ultimo_acceso).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" })}` : "sin acceso aún"}
                </p>
              </div>
              {u.id !== yo.id && (
                <form action={cambiarActivo}>
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="activo" value={u.activo ? "0" : "1"} />
                  <button className="text-[14px] text-secundario hover:text-azul">{u.activo ? "Dar de baja" : "Reactivar"}</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
