import { Suspense } from "react";
import { Marco } from "@/components/marco/Marco";
import { TarjetaDireccion } from "@/components/TarjetaDireccion";
import { Titulo } from "@/components/ui";
import { cuentaActual } from "@/lib/sesion";
import { direccionesDe } from "@/lib/direcciones";
import { FormularioDireccion } from "./FormularioDireccion";
import { borrarDireccion } from "./acciones";

export default function Direcciones(props: PageProps<"/cuenta/direcciones">) {
  return (
    <Marco pie={false}>
      <main className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-14">
        <Titulo sub="Tus obras y domicilios, listos para el siguiente pedido.">Direcciones.</Titulo>
        <Suspense fallback={<div className="h-24 animate-pulse rounded-[20px] bg-niebla" />}>
          <Lista />
        </Suspense>
        <h2 className="mb-5 mt-12 font-display text-2xl font-semibold">Nueva dirección</h2>
        <Suspense>
          <Formulario searchParams={props.searchParams} />
        </Suspense>
      </main>
    </Marco>
  );
}

async function Lista() {
  const cuenta = await cuentaActual();
  const dirs = cuenta ? await direccionesDe(cuenta.id) : [];
  if (dirs.length === 0) return <p className="text-[15px] text-secundario">Aún no tienes direcciones guardadas.</p>;
  return (
    <ul className="space-y-2">
      {dirs.map((d) => (
        <li key={d.id} className="flex items-start justify-between gap-3 rounded-[20px] bg-niebla p-4">
          <TarjetaDireccion d={d} />
          <form action={borrarDireccion}>
            <input type="hidden" name="id" value={d.id} />
            <button className="text-[14px] text-secundario hover:text-azul">Quitar</button>
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
