import type { Direccion } from "@/lib/direcciones";
import { ZONAS } from "@/lib/corte";
import { urlArchivo } from "@/lib/url-archivo";
import { IconoPin } from "@/components/Iconos";

export function TarjetaDireccion({ d }: { d: Direccion }) {
  return (
    <div className="flex min-w-0 gap-4 pr-8">
      {d.foto_archivo_id ? (
        // eslint-disable-next-line @next/next/no-img-element -- archivo propio
        <img src={urlArchivo(d.foto_archivo_id)} alt="Entrada" className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
      ) : (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white text-azul ring-1 ring-linea">
          <IconoPin className="h-6 w-6" />
        </span>
      )}
      <div className="min-w-0">
        <p className="font-semibold">
          {d.alias} <span className="ml-1 text-[13px] font-medium text-secundario">· {d.tipo === "obra" ? "Obra" : "Particular"}</span>
        </p>
        <p className="truncate text-[14px] text-secundario">{d.direccion}</p>
        <p className="text-[14px] text-secundario">{[d.municipio, d.entidad].filter(Boolean).join(", ") || ZONAS.find((z) => z.id === d.zona)?.nombre}</p>
        <p className="mt-1 text-[14px]">Recibe {d.recibe_nombre}</p>
      </div>
    </div>
  );
}
