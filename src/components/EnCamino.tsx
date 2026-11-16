import { ultimaPosicion, fotosDeEntrega } from "@/lib/ruta";
import { ligaMapa } from "@/lib/pedidos";
import { urlArchivo } from "@/lib/url-archivo";
import { IconoCamion } from "@/components/Iconos";

/** Ubicación del chofer (en ruta) y fotos de la entrega (entregado). */
export async function EnCamino({ pedidoId, estado }: { pedidoId: string; estado: string }) {
  if (estado === "en_ruta") {
    const p = await ultimaPosicion(pedidoId);
    if (!p) return null;
    const min = Math.max(0, p.minutos);
    return (
      <a href={ligaMapa(p.lat, p.lng)} target="_blank" className="flex items-center gap-4 rounded-[20px] bg-niebla p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-azul"><IconoCamion className="h-5 w-5" /></span>
        <span>
          <span className="block font-semibold">Ver dónde va el chofer ›</span>
          <span className="block text-[13px] text-secundario">Ubicación de {min <= 1 ? "hace un momento" : `hace ${min} min`}</span>
        </span>
      </a>
    );
  }
  if (estado === "entregado" || estado === "entregado_con_faltantes") {
    const fotos = (await fotosDeEntrega(pedidoId)).filter((f) => f.archivo_id);
    if (fotos.length === 0) return null;
    return (
      <section>
        <h2 className="mb-2 font-display text-xl font-semibold">Fotos de la entrega</h2>
        <div className="flex flex-wrap gap-2">
          {fotos.map((f) => (
            <a key={f.id} href={urlArchivo(f.archivo_id)} target="_blank">
              {/* eslint-disable-next-line @next/next/no-img-element -- archivo propio */}
              <img src={urlArchivo(f.archivo_id)} alt="Entrega" className="h-28 w-28 rounded-2xl object-cover" />
            </a>
          ))}
        </div>
      </section>
    );
  }
  return null;
}
