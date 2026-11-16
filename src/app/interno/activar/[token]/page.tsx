import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { invitacionVigente } from "@/lib/equipo";
import { FormActivar } from "./FormActivar";

export default function Activar(props: PageProps<"/interno/activar/[token]">) {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center bg-piedra px-4 py-16">
      <div className="w-full max-w-sm">
        <Logo className="mx-auto h-8 w-auto" />
        <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-[28px] bg-white" />}>
          <Contenido params={props.params} />
        </Suspense>
      </div>
    </main>
  );
}

async function Contenido({ params }: Pick<PageProps<"/interno/activar/[token]">, "params">) {
  const { token } = await params;
  const inv = await invitacionVigente(token);
  if (!inv)
    return (
      <div className="mt-8 text-center">
        <h1 className="font-display text-3xl font-semibold">Invitación no válida</h1>
        <p className="mt-2 text-[15px] text-secundario">Ya se usó o venció. Pide una nueva a quien te invitó.</p>
      </div>
    );
  return (
    <>
      <h1 className="mt-8 text-center font-display text-3xl font-semibold">Bienvenido al equipo</h1>
      <p className="mt-1 text-center text-[15px] text-secundario">
        Crea tu acceso {inv.rol === "admin" ? "de administrador" : "de operador"}.
      </p>
      <FormActivar token={token} />
    </>
  );
}
