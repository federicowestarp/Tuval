import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ligaWhatsAppTuval } from "@/lib/contacto";

export function PieDePagina() {
  const wa = ligaWhatsAppTuval();
  return (
    <footer className="border-t border-linea bg-piedra">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 text-[13px] text-secundario sm:grid-cols-4 sm:px-6">
        <div className="sm:col-span-2">
          <Logo />
          <p className="mt-3 max-w-xs">Tubería, equipos y eléctrico. Todo, a tiempo.</p>
          <p className="mt-1">Puebla · Atlixco · Tlaxcala</p>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-tinta">Comprar</p>
          <Link href="/tienda" className="block hover:text-azul">Tienda</Link>
          <Link href="/lista" className="block hover:text-azul">Pedir con lista o foto</Link>
          <Link href="/obras" className="block hover:text-azul">Para obras y constructoras</Link>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-tinta">Ayuda</p>
          <Link href="/cuenta/pedidos" className="block hover:text-azul">Mis pedidos</Link>
          <Link href="/#entregas" className="block hover:text-azul">Horarios de entrega</Link>
          {wa && <a href={wa} className="block hover:text-azul">WhatsApp</a>}
        </div>
      </div>
      <div className="mx-auto max-w-6xl border-t border-linea px-4 py-5 text-[12px] text-secundario sm:px-6">© Tuval</div>
    </footer>
  );
}
