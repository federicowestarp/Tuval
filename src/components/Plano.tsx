import type { Ubicacion } from "@/lib/plano";

/**
 * Plano de la tienda generado de las ubicaciones: cada pasillo es una columna y cada anaquel un bloque.
 * El anaquel resaltado muestra sus niveles (1 = abajo) con el nivel buscado en color.
 */
export function Plano({ ubicaciones, resaltar, compacto = false }: { ubicaciones: Ubicacion[]; resaltar?: Ubicacion | null; compacto?: boolean }) {
  if (ubicaciones.length === 0) return <p className="rounded-xl bg-niebla p-3 text-[14px] text-secundario">Todavía no hay ubicaciones capturadas para dibujar el plano.</p>;
  const pasillos = [...new Set(ubicaciones.map((u) => u.pasillo ?? "—"))];
  return (
    <div className="overflow-x-auto rounded-2xl bg-[#F4F7FB] p-3" role="img" aria-label={resaltar ? `Plano: ${resaltar.codigo}` : "Plano de la tienda"}>
      <div className="flex min-w-fit items-end gap-3">
        {pasillos.map((p) => {
          const anaqueles = [...new Set(ubicaciones.filter((u) => (u.pasillo ?? "—") === p).map((u) => u.anaquel ?? "—"))];
          const esteP = resaltar && (resaltar.pasillo ?? "—") === p;
          return (
            <div key={p} className="flex flex-col items-center gap-1.5">
              <div className="flex flex-col gap-1.5">
                {anaqueles.map((a) => {
                  const niveles = ubicaciones.filter((u) => (u.pasillo ?? "—") === p && (u.anaquel ?? "—") === a);
                  const aqui = esteP && (resaltar!.anaquel ?? "—") === a;
                  return (
                    <div key={a} className={`rounded-lg border-2 px-1.5 py-1 text-center ${aqui ? "border-[#E8590C] bg-[#FFF1E6]" : "border-[#C9D6E8] bg-white"} ${compacto ? "w-12" : "w-16"}`}>
                      <p className={`text-[11px] font-semibold ${aqui ? "text-[#E8590C]" : "text-[#5B6B80]"}`}>{a}</p>
                      {aqui && niveles.length > 1 && (
                        <div className="mt-1 flex flex-col-reverse gap-0.5">
                          {niveles.map((n) => (
                            <span key={n.id} className={`block h-2.5 rounded-sm ${n.id === resaltar!.id ? "bg-[#E8590C]" : "bg-[#F5C9A8]"}`} title={`Nivel ${n.nivel}`} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className={`text-[11px] font-semibold ${esteP ? "text-[#E8590C]" : "text-[#5B6B80]"}`}>Pasillo {p}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
