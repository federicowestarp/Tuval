import { Suspense } from "react";
import { Encabezado } from "@/components/Encabezado";
import { TarjetaDireccion } from "@/components/TarjetaDireccion";
import { cuentaActual } from "@/lib/sesion";
import { direccionesDe } from "@/lib/direcciones";
import { FormularioDireccion } from "./FormularioDireccion";
import { borrarDireccion } from "./acciones";

export default function Direcciones(props: PageProps<"/cuenta/direcciones">) {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <header className="bg-azul"><Encabezado /></header>
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
        <h1 className="font-display text-3xl font-bold">Mis direcciones</h1>
        <Suspense fallback={<p className="text-sm text-acero">Cargando…</p>}>
          <Lista />
        </Suspense>
        <Suspense>
          <Formulario searchParams={props.searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function Lista() {
  const cuenta = await cuentaActual();
  const dirs = cuenta ? await direccionesDe(cuenta.id) : [];
  if (dirs.length === 0) return <p className="text-sm text-acero">Aún no tienes direcciones guardadas.</p>;
  return (
    <ul className="space-y-3">
      {dirs.map((d) => (
        <li key={d.id} className="flex items-start justify-between gap-3 rounded-xl bg-white p-4">
          <TarjetaDireccion d={d} />
          <form action={borrarDireccion}>
            <input type="hidden" name="id" value={d.id} />
            <button className="text-sm text-acero underline">Quitar</button>
          </form>
        </li>
      ))}
    </ul>
  );
}

async function Formulario({ searchParams }: { searchParams: PageProps<"/cuenta/direcciones">["searchParams"] }) {
  const volver = (await searchParams).volver === "/carrito" ? "/carrito" : undefined;
  return <FormularioDireccion volver={volver} />;
}
