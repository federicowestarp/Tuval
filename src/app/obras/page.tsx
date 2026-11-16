import type { Metadata } from "next";
import { Marco } from "@/components/marco/Marco";
import { Simbolo } from "@/components/Logo";
import { IconoCheck, IconoDocumento, IconoPin, IconoCamion, IconoPersona } from "@/components/Iconos";
import { BotonLiga, Pastilla } from "@/components/ui";
import { FormContacto } from "./FormContacto";

export const metadata: Metadata = {
  title: "Para obras y constructoras",
  description: "Suministro de tubería, equipos y material eléctrico a tu obra. Pide con tu requisición y sigue cada entrega.",
};

export default function Obras() {
  return (
    <Marco>
      <section className="bg-piedra">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-secundario">Para obras y constructoras</p>
          <h1 className="mt-4 font-display text-[40px] font-semibold leading-[1] tracking-[-0.04em] sm:text-7xl">
            Material en tu obra.
            <span className="block text-secundario">Sin perseguir a nadie.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[17px] text-secundario">Tubería, conexiones, válvulas, equipos y eléctrico, entregados a tiempo y con evidencia.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <BotonLiga href="#contacto">Hablar con un asesor</BotonLiga>
            <BotonLiga href="/lista" variante="secundario">Mandar mi requisición</BotonLiga>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-3 px-4 py-20 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
        {[
          { I: IconoDocumento, t: "Pide con tu requisición", d: "Súbela en foto, PDF o Excel. La capturamos y te confirmamos precio, existencia y entrega." },
          { I: IconoPin, t: "Todas tus obras guardadas", d: "Dirección, ubicación exacta, foto de la entrada y quién recibe en cada una." },
          { I: IconoPersona, t: "Acceso para el residente", d: "Ve cuándo llega el material y confirma partida por partida lo que recibió." },
          { I: IconoCamion, t: "Entrega con evidencia", d: "Foto y ubicación en cada entrega. Si lo autorizas, la dejamos sin que nadie espere." },
          { I: IconoCheck, t: "Faltantes resueltos", d: "Lo que no llegó queda registrado y lo resolvemos sin que tengas que llamar." },
          { I: IconoDocumento, t: "Factura o nota", d: "CFDI con tus datos fiscales, por pedido." },
        ].map(({ I, t, d }) => (
          <div key={t} className="rounded-[20px] bg-niebla p-7">
            <I className="h-7 w-7 text-azul" />
            <h2 className="mt-5 font-display text-xl font-semibold">{t}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-secundario">{d}</p>
          </div>
        ))}
      </section>

      <section className="bg-azul text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-16 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-5">
            <Simbolo className="h-14 w-14" tono="negativo" />
            <div>
              <p className="font-display text-3xl font-semibold">Tuval <span className="text-cian">Obra</span></p>
              <p className="text-white/70">Bodega dentro de tu obra, inventario controlado y entregas programadas.</p>
            </div>
          </div>
          <Pastilla tono="cian">Próximamente</Pastilla>
        </div>
      </section>

      <section id="contacto" className="scroll-mt-14 bg-piedra">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-2">
          <div>
            <h2 className="font-display text-4xl font-semibold sm:text-5xl">Platiquemos de tu obra.</h2>
            <p className="mt-4 text-[17px] text-secundario">Déjanos tus datos y un asesor te contacta para armar tu cuenta de obra.</p>
          </div>
          <FormContacto />
        </div>
      </section>
    </Marco>
  );
}
