import { Suspense } from "react";
import { BarraProvisional } from "./BarraProvisional";
import { ligaWhatsAppTuval } from "@/lib/contacto";
import { BarraSuperior } from "./BarraSuperior";
import { EspacioBarra } from "./BarraFlotante";
import { PieDePagina } from "./PieDePagina";

/**
 * Estructura pública: barra flotante translúcida con menú a pantalla completa, contenido y pie.
 * `bajoBarra`: la primera sección corre por debajo de la barra (portadas).
 */
/** `buscador`: se monta como segunda cápsula fija dentro de la barra (se queda arriba al deslizar). */
export function Marco({ children, fondo = "blanco", pie = true, bajoBarra = false, buscador }: { children: React.ReactNode; fondo?: "blanco" | "niebla"; pie?: boolean; bajoBarra?: boolean; buscador?: React.ReactNode }) {
  return (
    <div className={`flex min-h-full flex-1 flex-col ${fondo === "niebla" ? "bg-niebla" : "bg-white"}`}>
      <Suspense fallback={<BarraProvisional />}>
        <BarraSuperior whatsapp={ligaWhatsAppTuval()} debajo={buscador} />
      </Suspense>
      {!bajoBarra && <EspacioBarra conDebajo={!!buscador} />}
      <div className="flex-1">{children}</div>
      {pie && <PieDePagina />}
    </div>
  );
}
