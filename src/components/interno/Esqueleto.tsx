import { AnilloCargando } from "@/components/Progreso";

/** Esqueleto de carga: la página aparece al instante con la forma del contenido. */
export function Esqueleto({ tarjetas = 4 }: { tarjetas?: number }) {
  return (
    <div aria-busy="true" aria-label="Cargando" className="relative animate-pulse space-y-4">
      <div className="absolute inset-x-0 top-24 z-10 flex justify-center"><AnilloCargando className="h-12 w-12" /></div>
      <div className="h-8 w-48 rounded-full bg-white" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: tarjetas }, (_, i) => <div key={i} className="h-24 rounded-[20px] bg-white" />)}
      </div>
      <div className="h-48 rounded-[20px] bg-white" />
      <div className="h-32 rounded-[20px] bg-white" />
    </div>
  );
}
