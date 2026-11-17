import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { puede, requerirInterno } from "@/lib/equipo";
import { Esqueleto } from "@/components/interno/Esqueleto";
import { clasesBoton } from "@/components/ui";
import { NavegacionInterna } from "../../Navegacion";
import { cerrarInventario } from "../acciones";

const mx = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function DetalleInventario(props: PageProps<"/interno/inventario-fisico/[id]">) {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="conteo" />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-6">
        <Suspense fallback={<Esqueleto />}><Contenido params={props.params} /></Suspense>
      </main>
    </div>
  );
}

type Tarjeta = { id: string; folio: number; producto: string; sku: string; ubicacion: string | null; c1: number | null; c2: number | null; c3: number | null; sistema: number; final: number | null; costo: number | null };

async function Contenido({ params }: { params: PageProps<"/interno/inventario-fisico/[id]">["params"] }) {
  await connection();
  const yo = await requerirInterno("mostrador");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [inv] = await sql<{ nombre: string; almacen: string; estado: string; cerrado: string | null }[]>`
    select i.nombre, a.nombre almacen, i.estado, to_char(i.cerrado_en at time zone 'America/Mexico_City', 'DD/MM/YYYY HH24:MI') cerrado
    from inventarios_fisicos i join almacenes a on a.id = i.almacen_id where i.id = ${id}`;
  if (!inv) notFound();
  const tarjetas = await sql<Tarjeta[]>`
    select t.id, t.folio, p.nombre producto, p.sku, t.ubicacion, t.conteo1::float c1, t.conteo2::float c2, t.conteo3::float c3,
           t.sistema::float sistema, t.final::float final, p.costo_promedio::float costo
    from tarjetas_inventario t join productos p on p.id = t.producto_id where t.inventario_id = ${id} order by t.folio`;
  // Lo que ve el equipo de conteo vs. lo que solo ve la supervisión (diferencias contra sistema).
  const supervisa = puede(yo.rol, "supervisor");
  const sinContar = tarjetas.filter((t) => t.c1 == null);
  const falta2 = tarjetas.filter((t) => t.c1 != null && t.c2 == null);
  const falta3 = tarjetas.filter((t) => t.c1 != null && t.c2 != null && t.final == null);
  const listas = tarjetas.filter((t) => t.final != null);
  const conDif = listas.filter((t) => t.final !== t.sistema);
  const valor = (t: Tarjeta) => ((t.final ?? 0) - t.sistema) * (t.costo ?? 0);
  const faltante = conDif.filter((t) => valor(t) < 0).reduce((a, t) => a + valor(t), 0);
  const sobrante = conDif.filter((t) => valor(t) > 0).reduce((a, t) => a + valor(t), 0);
  const sinCosto = conDif.filter((t) => t.costo == null).length;
  const abierto = inv.estado === "abierto";

  const lista = (titulo: string, ts: Tarjeta[], tono: string) => ts.length > 0 && (
    <section className="rounded-[20px] bg-white p-4">
      <h2 className="mb-2 font-semibold">{titulo} <span className={`ml-1 rounded-full px-2 py-0.5 text-[13px] ${tono}`}>{ts.length}</span></h2>
      <div className="flex flex-wrap gap-1.5">
        {ts.map((t) => (
          <Link key={t.id} href={`/interno/inventario-fisico/t/${t.id}`} className="rounded-full bg-niebla px-3 py-1 text-[13px]" title={t.producto}>
            #{t.folio}{t.ubicacion ? ` · ${t.ubicacion}` : ""}
          </Link>
        ))}
      </div>
    </section>
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/interno/inventario-fisico" className="text-[14px] text-azul">← Inventarios</Link>
          <h1 className="text-[28px] font-semibold tracking-tight">{inv.nombre}</h1>
          <p className="text-[15px] text-secundario">{inv.almacen} · {abierto ? "contando" : `cerrado ${inv.cerrado}`} · {listas.length}/{tarjetas.length} tarjetas terminadas</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/interno/inventario-fisico/${id}/tarjetas`} target="_blank" className={clasesBoton("secundario", "normal")}>Imprimir tarjetas</Link>
          {abierto && tarjetas.length > 0 && <Link href={`/interno/inventario-fisico/t/${(sinContar[0] ?? falta2[0] ?? falta3[0] ?? tarjetas[0]).id}`} className={clasesBoton("principal", "normal")}>Contar</Link>}
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full bg-azul" style={{ width: `${tarjetas.length ? (listas.length / tarjetas.length) * 100 : 0}%` }} />
      </div>

      {abierto && (
        <>
          {lista("Folios sin contar", sinContar, "bg-red-100 text-red-800")}
          {lista("Falta 2º conteo (otra persona)", falta2, "bg-amber-100 text-amber-800")}
          {lista("No coinciden: falta 3er conteo", falta3, "bg-amber-100 text-amber-800")}
        </>
      )}

      {supervisa && (
        <section className="rounded-[20px] bg-white p-4">
          <h2 className="font-semibold">Diferencias contra sistema</h2>
          <p className="mb-3 text-[14px] text-secundario">Solo supervisión las ve; el equipo cuenta a ciegas.</p>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Dato t="Con diferencia" v={String(conDif.length)} />
            <Dato t="Faltante (a costo)" v={mx(faltante)} rojo={faltante < 0} />
            <Dato t="Sobrante (a costo)" v={mx(sobrante)} />
            <Dato t="Neto" v={mx(faltante + sobrante)} rojo={faltante + sobrante < 0} />
          </div>
          {sinCosto > 0 && <p className="mb-2 text-[13px] text-amber-800">{sinCosto} producto(s) con diferencia no tienen costo promedio: no entran en la valuación.</p>}
          {conDif.length > 0 && (
            <div className="overflow-x-auto">
              <table className="tabla w-full min-w-[560px] text-[14px]">
                <thead className="text-left text-secundario"><tr><th>Producto</th><th>Folio</th><th className="text-right">Sistema</th><th className="text-right">Conteos</th><th className="text-right">Final</th><th className="text-right">Valor</th></tr></thead>
                <tbody className="divide-y divide-linea">
                  {conDif.map((t) => (
                    <tr key={t.id}>
                      <td>{t.producto}<span className="block text-[12px] text-secundario">{t.sku}</span></td>
                      <td>#{t.folio}</td>
                      <td className="text-right">{t.sistema}</td>
                      <td className="text-right text-secundario">{[t.c1, t.c2, t.c3].filter((x) => x != null).join(" / ")}</td>
                      <td className={`text-right font-semibold ${(t.final ?? 0) < t.sistema ? "text-red-700" : "text-emerald-700"}`}>{t.final}</td>
                      <td className="text-right">{t.costo == null ? "—" : mx(valor(t))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {abierto && puede(yo.rol, "admin") && (
            <form action={cerrarInventario} className="mt-4">
              <input type="hidden" name="id" value={id} />
              <button disabled={listas.length < tarjetas.length} className={clasesBoton("principal", "normal")}>
                {listas.length < tarjetas.length ? `Faltan ${tarjetas.length - listas.length} tarjetas para cerrar` : "Cerrar inventario y ajustar existencias"}
              </button>
            </form>
          )}
        </section>
      )}
    </>
  );
}

function Dato({ t, v, rojo }: { t: string; v: string; rojo?: boolean }) {
  return <div className="rounded-xl bg-niebla p-3"><p className="text-[12px] text-secundario">{t}</p><p className={`text-[18px] font-semibold ${rojo ? "text-red-700" : ""}`}>{v}</p></div>;
}
