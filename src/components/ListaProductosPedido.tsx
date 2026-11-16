import type { PedidoDetalle } from "@/lib/pedidos";
import { formatoMoneda } from "@/lib/catalogo-formato";
import { urlArchivo } from "@/lib/url-archivo";
import { Pastilla } from "@/components/ui";
import { IconoDocumento } from "@/components/Iconos";

export function ListaProductosPedido({ pedido, conPrecios = true }: { pedido: PedidoDetalle; conPrecios?: boolean }) {
  return (
    <ul className="divide-y divide-linea text-[15px]">
      {pedido.partidas.map((p) => (
        <li key={p.id} className="flex justify-between gap-4 py-3">
          <span><span className="font-semibold">{p.cantidad}</span> <span className="text-secundario">×</span> {p.nombre}</span>
          {conPrecios && (
            <span className="shrink-0 text-secundario">{p.precio_unitario != null && pedido.confirmado_en ? formatoMoneda(p.precio_unitario * p.cantidad) : "—"}</span>
          )}
        </li>
      ))}
      {pedido.especiales.map((e) => (
        <li key={e.id} className="flex items-center justify-between gap-4 py-3">
          <span><span className="font-semibold">{e.cantidad}</span> <span className="text-secundario">×</span> {e.descripcion}</span>
          <Pastilla tono="niebla">{e.estado === "no_conseguible" ? "No se consiguió" : "Buscando"}</Pastilla>
        </li>
      ))}
      {pedido.adjuntos.map((a) => (
        <li key={a.archivo_id} className="py-3">
          <a href={urlArchivo(a.archivo_id)} target="_blank" className="inline-flex items-center gap-2 text-azul">
            <IconoDocumento className="h-5 w-5" /> {a.nombre}
          </a>
        </li>
      ))}
    </ul>
  );
}
