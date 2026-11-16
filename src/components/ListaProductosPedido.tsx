import type { PedidoDetalle } from "@/lib/pedidos";
import { formatoMoneda } from "@/lib/catalogo";
import { urlArchivo } from "@/lib/url-archivo";

export function ListaProductosPedido({ pedido, conPrecios = true }: { pedido: PedidoDetalle; conPrecios?: boolean }) {
  return (
    <ul className="mt-2 divide-y divide-cianclaro text-sm">
      {pedido.partidas.map((p) => (
        <li key={p.id} className="flex justify-between gap-3 py-2">
          <span>{p.cantidad} × {p.nombre}</span>
          {conPrecios && (
            <span className="shrink-0 text-acero">{p.precio_unitario != null ? formatoMoneda(p.precio_unitario * p.cantidad) : "por confirmar"}</span>
          )}
        </li>
      ))}
      {pedido.especiales.map((e) => (
        <li key={e.id} className="flex justify-between gap-3 py-2">
          <span>{e.cantidad} × {e.descripcion}</span>
          <span className="h-fit shrink-0 whitespace-nowrap rounded-full bg-cianclaro px-2 text-xs text-profundo">Lo estamos buscando</span>
        </li>
      ))}
      {pedido.adjuntos.map((a) => (
        <li key={a.archivo_id} className="py-2">
          <a href={urlArchivo(a.archivo_id)} target="_blank" className="text-azul underline">📄 {a.nombre}</a>
          <span className="ml-2 text-xs text-acero">lista adjunta</span>
        </li>
      ))}
    </ul>
  );
}
