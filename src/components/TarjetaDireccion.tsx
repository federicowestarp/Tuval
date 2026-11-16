import type { Direccion } from "@/lib/direcciones";
import { ZONAS } from "@/lib/corte";
import { urlArchivo } from "@/lib/url-archivo";

export function TarjetaDireccion({ d }: { d: Direccion }) {
  return (
    <div className="flex gap-3">
      {d.foto_archivo_id ? (
        // eslint-disable-next-line @next/next/no-img-element -- archivo propio
        <img src={urlArchivo(d.foto_archivo_id)} alt="Fachada" className="h-16 w-16 shrink-0 rounded-md object-cover" />
      ) : (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-niebla text-xs text-acero">Sin foto</span>
      )}
      <div className="min-w-0">
        <p className="font-semibold">
          {d.alias}{" "}
          <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${d.tipo === "obra" ? "bg-cian text-profundo" : "bg-niebla text-azul"}`}>
            {d.tipo === "obra" ? "Obra" : "Particular"}
          </span>
        </p>
        <p className="truncate text-sm text-acero">{d.direccion} · {ZONAS.find((z) => z.id === d.zona)?.nombre}</p>
        <p className="text-sm">
          Recibe: {d.recibe_nombre} · {d.recibe_telefono} ({d.preferencia_contacto === "whatsapp" ? "WhatsApp" : "llamada"})
        </p>
        <p className="text-xs text-acero">
          {d.lat != null ? "📍 Ubicación en mapa" : "Sin ubicación en mapa"}
          {d.permite_sin_recepcion && " · Se puede dejar sin recepción"}
        </p>
      </div>
    </div>
  );
}
