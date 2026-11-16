import { Suspense } from "react";
import Link from "next/link";
import { Marco } from "@/components/marco/Marco";
import { Titulo } from "@/components/ui";
import { IconoCaja, IconoFlecha, IconoPin, IconoChat } from "@/components/Iconos";
import { cuentaActual } from "@/lib/sesion";
import { ligaWhatsAppTuval } from "@/lib/contacto";

export default function Cuenta() {
  return (
    <Marco pie={false}>
      <main className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-14">
        <Suspense fallback={<div className="h-12" />}>
          <Encabezado />
        </Suspense>
        <nav className="divide-y divide-linea overflow-hidden rounded-3xl bg-niebla">
          {[
            { href: "/cuenta/pedidos", t: "Mis pedidos", d: "Seguimiento y entregas", Icono: IconoCaja },
            { href: "/cuenta/direcciones", t: "Mis direcciones", d: "Obras y domicilios guardados", Icono: IconoPin },
          ].map(({ href, t, d, Icono }) => (
            <Link key={href} href={href} className="flex items-center gap-4 p-5 transition hover:bg-cianclaro">
              <Icono className="h-6 w-6 text-azul" />
              <span className="flex-1">
                <span className="block font-semibold">{t}</span>
                <span className="block text-[14px] text-acero">{d}</span>
              </span>
              <IconoFlecha className="h-5 w-5 text-acero" />
            </Link>
          ))}
          {ligaWhatsAppTuval() && (
            <a href={ligaWhatsAppTuval("Hola Tuval, necesito ayuda.")!} className="flex items-center gap-4 p-5 transition hover:bg-cianclaro">
              <IconoChat className="h-6 w-6 text-azul" />
              <span className="flex-1"><span className="block font-semibold">Ayuda por WhatsApp</span></span>
              <IconoFlecha className="h-5 w-5 text-acero" />
            </a>
          )}
        </nav>
        <p className="mt-6 text-center text-[13px] text-acero">Pronto podrás entrar con tu celular o correo desde cualquier dispositivo.</p>
      </main>
    </Marco>
  );
}

async function Encabezado() {
  const c = await cuentaActual();
  return <Titulo sub={c?.telefono ? `Celular ${c.telefono}` : undefined}>{c?.nombre ? `Hola, ${c.nombre.split(" ")[0]}.` : "Tu cuenta."}</Titulo>;
}
