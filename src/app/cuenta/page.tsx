import { Suspense } from "react";
import Link from "next/link";
import { Marco } from "@/components/marco/Marco";
import { Titulo } from "@/components/ui";
import { IconoCaja, IconoFlecha, IconoPin, IconoChat } from "@/components/Iconos";
import { cuentaActual } from "@/lib/sesion";
import { ligaWhatsAppTuval } from "@/lib/contacto";
import { sql } from "@/lib/db";
import { puntosDe } from "@/lib/clientes";
import { paramLealtad } from "@/lib/lealtad";
import { URL_SITIO } from "@/lib/sitio";

export default function Cuenta() {
  return (
    <Marco pie={false}>
      <main className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-14">
        <Suspense fallback={<div className="h-12" />}>
          <Encabezado />
        </Suspense>
        <Suspense fallback={null}>
          <Lealtad />
        </Suspense>
        <nav className="divide-y divide-linea overflow-hidden rounded-[20px] bg-niebla">
          {[
            { href: "/cuenta/pedidos", t: "Mis pedidos", d: "Seguimiento y entregas", Icono: IconoCaja },
            { href: "/cuenta/direcciones", t: "Mis direcciones", d: "Obras y domicilios guardados", Icono: IconoPin },
          ].map(({ href, t, d, Icono }) => (
            <Link key={href} href={href} className="flex items-center gap-4 p-5 transition hover:bg-piedra">
              <Icono className="h-6 w-6 text-azul" />
              <span className="flex-1">
                <span className="block font-semibold">{t}</span>
                <span className="block text-[14px] text-secundario">{d}</span>
              </span>
              <IconoFlecha className="h-5 w-5 text-secundario" />
            </Link>
          ))}
          {ligaWhatsAppTuval() && (
            <a href={ligaWhatsAppTuval("Hola Tuval, necesito ayuda.")!} className="flex items-center gap-4 p-5 transition hover:bg-piedra">
              <IconoChat className="h-6 w-6 text-azul" />
              <span className="flex-1"><span className="block font-semibold">Ayuda por WhatsApp</span></span>
              <IconoFlecha className="h-5 w-5 text-secundario" />
            </a>
          )}
        </nav>
        <p className="mt-6 text-center text-[13px] text-secundario">Pronto podrás entrar con tu celular o correo desde cualquier dispositivo.</p>
      </main>
    </Marco>
  );
}

async function Encabezado() {
  const c = await cuentaActual();
  return <Titulo sub={c?.telefono ? `Celular ${c.telefono}` : undefined}>{c?.nombre ? `Hola, ${c.nombre.split(" ")[0]}.` : "Tu cuenta."}</Titulo>;
}

/** Puntos del programa de lealtad y el código para recomendar (solo si la cuenta ya está ligada a un cliente). */
async function Lealtad() {
  const c = await cuentaActual();
  if (!c) return null;
  const [cl] = await sql<{ id: string; codigo: string | null }[]>`
    select cl.id, cl.codigo_recomendado codigo from cuentas cu join clientes cl on cl.id = cu.cliente_id where cu.id = ${c.id} and cl.activo`;
  if (!cl) return null;
  const [puntos, p] = await Promise.all([puntosDe(cl.id), paramLealtad()]);
  const valor = (puntos * (p.valor_punto ?? 0)).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
  const mensaje = cl.codigo
    ? `Te recomiendo Tuval para tubería, válvulas y equipo. Usa mi código ${cl.codigo} al hacer tu pedido en ${URL_SITIO}${p.puntos_recomendado ? ` y recibe ${p.puntos_recomendado} puntos en tu primera compra${p.compra_minima_recomendado ? ` de ${p.compra_minima_recomendado.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })} o más` : ""}` : ""}.`
    : null;
  return (
    <section className="mb-4 rounded-[20px] bg-azul p-5 text-white">
      <p className="text-[14px] opacity-80">Tus puntos Tuval</p>
      <p className="text-[34px] font-semibold leading-tight">{puntos.toLocaleString("es-MX")}</p>
      <p className="text-[14px] opacity-80">Equivalen a {valor} para tu próxima compra en mostrador.</p>
      {cl.codigo && mensaje && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/10 p-3">
          <span><span className="block text-[13px] opacity-80">Tu código para recomendar</span><span className="font-mono text-[18px] font-semibold">{cl.codigo}</span></span>
          <a href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`} target="_blank" className="rounded-full bg-white px-4 py-2 text-[14px] font-semibold text-azul">Compartir por WhatsApp</a>
        </div>
      )}
      {p.puntos_recomienda ? <p className="mt-2 text-[13px] opacity-80">Ganas {p.puntos_recomienda} puntos cuando alguien hace su primera compra con tu código.</p> : null}
    </section>
  );
}
