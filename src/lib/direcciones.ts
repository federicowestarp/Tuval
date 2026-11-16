import { sql } from "@/lib/db";
import type { Zona } from "@/lib/corte";

export type Direccion = {
  id: string;
  tipo: "obra" | "particular";
  alias: string;
  direccion: string;
  zona: Zona;
  lat: number | null;
  lng: number | null;
  foto_archivo_id: string | null;
  recibe_nombre: string;
  recibe_telefono: string;
  preferencia_contacto: "whatsapp" | "telefono";
  permite_sin_recepcion: boolean;
  indicaciones: string | null;
};

export async function direccionesDe(cuentaId: string): Promise<Direccion[]> {
  return sql<Direccion[]>`
    select id, tipo, alias, direccion, zona, lat, lng, foto_archivo_id, recibe_nombre, recibe_telefono,
           preferencia_contacto, permite_sin_recepcion, indicaciones
    from direcciones where cuenta_id = ${cuentaId} and activa order by creado_en desc`;
}
