import { Suspense } from "react";
import { connection } from "next/server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { ligaWhatsApp } from "@/lib/pedidos";
import { NavegacionInterna } from "../Navegacion";

async function marcarAtendido(fd: FormData) {
  "use server";
  await requerirInterno("operador");
  await sql`update contactos_web set atendido = true where id = ${String(fd.get("id"))}`;
  revalidatePath("/interno/contactos");
}

export default function Contactos() {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="contactos" />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">
        <h1 className="font-display text-2xl font-semibold">Contactos de la página</h1>
        <Suspense fallback={<p className="text-sm text-secundario">Cargando…</p>}><Lista /></Suspense>
      </main>
    </div>
  );
}

async function Lista() {
  await connection();
  await requerirInterno("operador");
  const cs = await sql<{ id: string; tipo: string; nombre: string; empresa: string | null; telefono: string; correo: string | null; mensaje: string | null; atendido: boolean; creado_en: Date }[]>`
    select * from contactos_web order by atendido, creado_en desc limit 200`;
  if (cs.length === 0) return <p className="rounded-[20px] bg-white p-6 text-secundario">Aún no hay contactos.</p>;
  return (
    <ul className="space-y-2">
      {cs.map((c) => (
        <li key={c.id} className={`rounded-[20px] bg-white p-4 ${c.atendido ? "opacity-60" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{c.nombre}{c.empresa && <span className="font-normal text-secundario"> · {c.empresa}</span>}</p>
              <p className="text-[13px] text-secundario">
                {c.tipo === "obra" ? "Obra" : "Contacto"} · {c.telefono}{c.correo && ` · ${c.correo}`} · {new Date(c.creado_en).toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
            {!c.atendido && (
              <form action={marcarAtendido}><input type="hidden" name="id" value={c.id} /><button className="text-[14px] text-secundario hover:text-azul">Marcar atendido</button></form>
            )}
          </div>
          {c.mensaje && <p className="mt-2 text-[15px]">{c.mensaje}</p>}
          <a href={ligaWhatsApp(c.telefono, `Hola ${c.nombre}, te escribimos de Tuval por tu solicitud en nuestra página.`)} target="_blank" className="mt-2 inline-block text-[14px] font-semibold text-azul">Escribir por WhatsApp ›</a>
        </li>
      ))}
    </ul>
  );
}
