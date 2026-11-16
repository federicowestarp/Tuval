import Link from "next/link";
import { Marco } from "@/components/marco/Marco";
import { Buscador } from "@/components/tienda/Buscador";
import { Simbolo } from "@/components/Logo";
import { AnilloAvance } from "@/components/Progreso";
import { IconoCategoria } from "@/components/IconoCategoria";
import { IconoCamion, IconoChat, IconoDocumento, IconoLista, IconoPin, IconoCamara, IconoCheck, IconoFlecha } from "@/components/Iconos";
import { BotonLiga, Pastilla } from "@/components/ui";
import { CATEGORIAS } from "@/lib/categorias";
import { ligaWhatsAppTuval } from "@/lib/contacto";

export default function Inicio() {
  const wa = ligaWhatsAppTuval();
  return (
    <Marco>
      {/* Portada */}
      <section className="bg-piedra">
      <div className="mx-auto max-w-4xl px-4 pb-20 pt-14 text-center sm:px-6 sm:pt-24">
        <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-secundario">Puebla · Atlixco · Tlaxcala</p>
        <h1 className="mt-4 font-display text-[44px] font-semibold leading-[0.98] tracking-[-0.04em] sm:text-7xl">
          Tubería, equipos y eléctrico.
          <span className="block text-secundario">Todo, a tiempo.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[17px] text-secundario sm:text-xl">
          Pide lo que necesitas para tu obra y te lo llevamos. Si no lo tenemos, lo conseguimos.
        </p>
        <div className="mx-auto mt-8 max-w-2xl">
          <Buscador grande />
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <BotonLiga href="/tienda" variante="principal">Ver tienda</BotonLiga>
          <BotonLiga href="/lista" variante="secundario"><IconoLista className="h-5 w-5" /> Pedir con lista</BotonLiga>
          {wa && <a href={wa} className="inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold text-azul"><IconoChat className="h-5 w-5" /> WhatsApp</a>}
        </div>
      </div>
      </section>

      {/* Tres promesas */}
      <section className="mx-auto mt-16 grid max-w-6xl gap-3 px-4 sm:grid-cols-3 sm:px-6">
        {[
          { Icono: IconoCamion, t: "Te lo llevamos hoy", d: "En Puebla, pide antes de las 12:00 y llega el mismo día. Atlixco y Tlaxcala, al día siguiente." },
          { Icono: IconoCamara, t: "Pide como quieras", d: "Busca en la tienda, pega tu lista o mándanos una foto de la requisición." },
          { Icono: IconoDocumento, t: "Factura o nota", d: "Tú eliges. Confirmamos precio y existencias antes de surtir." },
        ].map(({ Icono, t, d }) => (
          <div key={t} className="rounded-[20px] bg-niebla p-7">
            <Icono className="h-8 w-8 text-azul" />
            <h2 className="mt-5 font-display text-xl font-semibold">{t}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-secundario">{d}</p>
          </div>
        ))}
      </section>

      {/* Cómo funciona */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 sm:px-6 md:grid-cols-2">
        <div>
          <h2 className="font-display text-4xl font-semibold sm:text-5xl">Así de simple.</h2>
          <ol className="mt-8 space-y-7">
            {[
              ["Pide", "Desde el celular, la computadora o WhatsApp. Elige a cuál de tus obras o direcciones lo mandamos."],
              ["Confirmamos", "Revisamos precios y existencias y te mandamos el total antes de surtir."],
              ["Te lo llevamos", "Sigues la entrega en vivo. Quien recibe en obra confirma lo que llegó."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-azul font-display font-semibold text-white">{i + 1}</span>
                <div>
                  <p className="text-lg font-semibold">{t}</p>
                  <p className="mt-1 text-[15px] leading-relaxed text-secundario">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        {/* Vista de seguimiento, dibujada con la misma interfaz de la app */}
        <div className="mx-auto w-full max-w-sm rounded-[28px] bg-piedra p-3">
          <div className="rounded-[22px] bg-white p-6">
            <p className="text-[13px] text-secundario">Pedido de ejemplo · Obra</p>
            <p className="mt-1 font-display text-2xl font-semibold">Va en camino</p>
            <div className="mt-5 flex items-center gap-4">
              <AnilloAvance actual={2} className="h-16 w-16" />
              <div className="text-[13px] text-secundario">
                <p>Recibido · Preparando</p>
                <p className="font-semibold text-tinta">En ruta</p>
              </div>
            </div>
            <div className="mt-6 rounded-2xl bg-niebla p-4">
              <p className="text-[13px] text-secundario">Llega</p>
              <p className="font-semibold">Hoy por la tarde</p>
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-niebla p-4">
              <IconoPin className="h-5 w-5 text-azul" />
              <p className="text-[14px]">Recibe el residente de obra</p>
            </div>
          </div>
        </div>
      </section>

      {/* Para obras */}
      <section id="obras" className="scroll-mt-14 bg-azul text-white">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-cian">Para obras y constructoras</p>
          <h2 className="mt-4 max-w-2xl font-display text-4xl font-semibold sm:text-5xl">Material en tu obra, sin perseguir a nadie.</h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-[20px] bg-white/10 sm:grid-cols-2">
            {[
              ["Todas tus obras guardadas", "Dirección, ubicación en mapa, foto de la entrada y quién recibe en cada una."],
              ["Acceso para el residente", "Ve cuándo llega el material y confirma partida por partida lo que recibió."],
              ["Entrega sin esperar", "Si lo autorizas, dejamos el material con foto y ubicación como comprobante."],
              ["Pide con tu requisición", "Mándanos la lista en foto o PDF. La capturamos y te confirmamos todo."],
            ].map(([t, d]) => (
              <div key={t} className="bg-azul p-7">
                <IconoCheck className="h-6 w-6 text-cian" />
                <p className="mt-4 text-lg font-semibold">{t}</p>
                <p className="mt-1 text-[15px] leading-relaxed text-white/70">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-[20px] bg-white/5 p-7 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <Simbolo className="h-10 w-10" tono="negativo" />
              <div>
                <p className="font-display text-xl font-semibold">Tuval <span className="text-cian">Obra</span></p>
                <p className="text-[15px] text-white/70">Tu bodega, dentro de tu obra.</p>
              </div>
            </div>
            <Pastilla tono="cian">Próximamente</Pastilla>
          </div>
        </div>
      </section>

      {/* Categorías */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <h2 className="font-display text-4xl font-semibold sm:text-5xl">Todo sale de un solo lugar.</h2>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORIAS.map((c) => (
            <Link key={c.id} href={`/tienda?cat=${c.id}`} className="group flex flex-col justify-between rounded-[20px] bg-piedra p-5 transition hover:bg-niebla">
              <IconoCategoria categoria={c.id} className="h-9 w-9 text-azul" />
              <p className="mt-10 flex items-center justify-between font-semibold">
                {c.nombre}
                <IconoFlecha className="h-4 w-4 text-secundario transition group-hover:translate-x-0.5" />
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Entregas */}
      <section id="entregas" className="scroll-mt-14 bg-piedra">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-24 sm:px-6 md:grid-cols-2">
          <div>
            <h2 className="font-display text-4xl font-semibold sm:text-5xl">Horarios de entrega.</h2>
            <p className="mt-4 text-[17px] text-secundario">Te decimos cuándo llega al momento de pedir. Sin sorpresas.</p>
          </div>
          <div className="divide-y divide-linea rounded-[20px] bg-white px-6 ring-1 ring-linea">
            {[
              ["Puebla", "Pide antes de las 12:00", "Llega hoy"],
              ["Puebla · sábado", "Pide antes de las 10:00", "Llega hoy"],
              ["Atlixco y Tlaxcala", "Pide antes de las 17:00", "Llega mañana temprano"],
            ].map(([z, c, l]) => (
              <div key={z} className="flex items-center justify-between gap-4 py-5">
                <div>
                  <p className="font-semibold">{z}</p>
                  <p className="text-[14px] text-secundario">{c}</p>
                </div>
                <Pastilla tono="niebla">{l}</Pastilla>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cierre */}
      <section className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        <h2 className="font-display text-4xl font-semibold sm:text-6xl">¿Qué necesitas para tu obra?</h2>
        <div className="mx-auto mt-8 max-w-xl"><Buscador grande /></div>
      </section>
    </Marco>
  );
}
