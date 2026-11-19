import { Suspense } from "react";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { puede, requerirInterno } from "@/lib/equipo";
import { PUNTOS_RECORRIDO, type PuntoRegistrado } from "@/lib/recorrido";
import { Esqueleto } from "@/components/interno/Esqueleto";
import { NavegacionInterna } from "../Navegacion";
import { Recorrido } from "./Recorrido";
import { estadoRecorrido } from "./estado";

/** Recorrido de tienda: el equipo lo hace cada cierto tiempo; la gerencia ve cumplimiento y lo que se encontró. */
export default function RecorridoTienda() {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="recorrido" />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Recorrido de tienda</h1>
          <p className="text-[15px] text-secundario">Pequeños recorridos seguidos: tienda ordenada, piezas en su lugar y clientes atendidos.</p>
        </div>
        <Suspense fallback={<Esqueleto />}><Contenido /></Suspense>
      </main>
    </div>
  );
}

async function Contenido() {
  await connection();
  const yo = await requerirInterno("mostrador");
  const { ultimo, cadaMin } = await estadoRecorrido();
  const gerencia = puede(yo.rol, "supervisor");
  const [hoy, fallas] = await Promise.all([
    sql<{ id: string; quien: string; hora: string; minutos: number; problemas: number; puntos: PuntoRegistrado[]; hueco: number | null }[]>`
      select r.id, u.nombre quien, to_char(r.terminado_en at time zone 'America/Mexico_City', 'HH24:MI') hora,
             greatest(1, round(extract(epoch from r.terminado_en - r.iniciado_en) / 60))::int minutos, r.problemas, r.puntos,
             round(extract(epoch from r.terminado_en - lag(r.terminado_en) over (order by r.terminado_en)) / 60)::int hueco
      from recorridos_tienda r join usuarios_internos u on u.id = r.usuario_id
      where r.terminado_en is not null and (r.terminado_en at time zone 'America/Mexico_City')::date = (now() at time zone 'America/Mexico_City')::date
      order by r.terminado_en desc`,
    gerencia ? sql<{ id: string; n: number }[]>`
      select p->>'id' id, count(*)::int n from recorridos_tienda r, jsonb_array_elements(r.puntos) p
      where r.terminado_en > now() - interval '7 days' and (p->>'ok')::boolean = false group by 1 order by 2 desc` : Promise.resolve([]),
  ]);
  const titulo = (id: string) => PUNTOS_RECORRIDO.find((p) => p.id === id)?.titulo ?? id;
  const tarde = hoy.filter((r) => r.hueco != null && r.hueco > cadaMin * 1.5).length;

  return (
    <>
      <Recorrido ultimo={ultimo} cadaMin={cadaMin} />
      <section className="space-y-2 rounded-[20px] bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Hoy · {hoy.length} recorrido{hoy.length === 1 ? "" : "s"}</h2>
          {gerencia && hoy.length > 1 && <span className={`text-[13px] ${tarde ? "font-semibold text-amber-800" : "text-emerald-700"}`}>{tarde ? `${tarde} con más de ${Math.round(cadaMin * 1.5)} min de espera` : "Sin huecos largos"}</span>}
        </div>
        {hoy.length === 0 ? <p className="text-[14px] text-secundario">Todavía no hay recorridos hoy.</p> : (
          <ul className="divide-y divide-linea text-[14px]">
            {hoy.map((r) => (
              <li key={r.id} className="py-2">
                <p><strong className="tabular-nums">{r.hora}</strong> · {r.quien} · {r.minutos} min
                  {r.hueco != null && <span className={r.hueco > cadaMin * 1.5 ? "font-semibold text-amber-800" : "text-secundario"}> · {r.hueco} min desde el anterior</span>}
                  {r.problemas === 0 ? <span className="text-emerald-700"> · todo bien</span> : <span className="text-amber-800"> · {r.problemas} con algo</span>}</p>
                {r.puntos.filter((p) => !p.ok).map((p) => <p key={p.id} className="text-[13px] text-secundario">{titulo(p.id)}: {p.nota}</p>)}
              </li>
            ))}
          </ul>
        )}
      </section>
      {gerencia && fallas.length > 0 && (
        <section className="space-y-2 rounded-[20px] bg-white p-4">
          <h2 className="font-semibold">Lo que más se encuentra · últimos 7 días</h2>
          <ul className="space-y-1 text-[14px]">
            {fallas.map((f) => <li key={f.id} className="flex justify-between"><span>{titulo(f.id)}</span><span className="font-semibold tabular-nums">{f.n} {f.n === 1 ? "vez" : "veces"}</span></li>)}
          </ul>
        </section>
      )}
    </>
  );
}
