import { Logo } from "@/components/Logo";
import { FormEntrar } from "./FormEntrar";

export default function Entrar() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center bg-piedra px-4 py-16">
      <div className="w-full max-w-sm">
        <Logo className="mx-auto h-8 w-auto" />
        <h1 className="mt-8 text-center font-display text-3xl font-semibold">Equipo Tuval</h1>
        <p className="mt-1 text-center text-[15px] text-secundario">Entra para ver y operar los pedidos.</p>
        <FormEntrar />
      </div>
    </main>
  );
}
