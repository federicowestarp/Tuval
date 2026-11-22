import { Logo } from "@/components/Logo";
import { PantallasGuardadas } from "./PantallasGuardadas";

export const metadata = { title: "Sin conexión", robots: { index: false } };

/** Se muestra cuando no hay señal y la pantalla que pediste nunca se abrió en este teléfono. */
export default function SinConexion() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-4 py-10">
      <Logo className="h-7 w-auto self-start" />
      <div>
        <h1 className="font-display text-[32px] font-semibold leading-tight">Sin conexión.</h1>
        <p className="mt-2 text-[17px] text-secundario">Esta pantalla no estaba guardada en tu teléfono. Las que ya abriste sí funcionan sin señal:</p>
      </div>
      <PantallasGuardadas />
      <p className="text-[14px] text-secundario">Lo que captures sin señal (entregas, llegadas, conteos) se guarda y se envía solo cuando vuelva la conexión.</p>
    </main>
  );
}
