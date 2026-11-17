import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { requerirInterno } from "@/lib/equipo";
import { fechaHora, listarCortes } from "@/lib/cortes";
import { Esqueleto } from "@/components/interno/Esqueleto";
import { Indicador, pesos } from "@/components/interno/Indicadores";
import { NavegacionInterna } from "../../Navegacion";

export default function Cortes() {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="cortes" />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-6">
        <h1 className="font-display text-2xl font-semibold">Cortes de caja</h1>
        <Suspense fallback={<Esqueleto />}><Contenido /></Suspense>
      </main>
    </div>
  );
}

async function Contenido() {
  await connection();
  await requerirInterno("mostrador");
  const cortes = await listarCortes();
  const cerrados = cortes.filter((c) => c.cerrada_en);
  const faltantes = cerrados.filter((c) => c.contado != null && c.contado - c.esperado <= -1);
  const sumaDif = cerrados.reduce((a, c) => a + (c.contado != null ? c.contado - c.esperado : 0), 0);

  if (cortes.length === 0) return <p className="rounded-[20px] bg-white p-6 text-secundario">Aún no hay cortes. Se generan al cerrar la caja en <Link href="/interno/mostrador" className="text-azul">Mostrador</Link>.</p>;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador etiqueta="Cortes" valor={String(cerrados.length)} nota={`últimos ${cortes.length}`} />
        <Indicador etiqueta="Vendido" valor={pesos(cerrados.reduce((a, c) => a + c.ventas, 0))} />
        <Indicador etiqueta="Cortes con faltante" valor={String(faltantes.length)} />
        <Indicador etiqueta="Diferencia acumulada" valor={pesos(sumaDif)} nota={sumaDif < 0 ? "Falta efectivo" : sumaDif > 0 ? "Sobra efectivo" : "Cuadra"} />
      </div>
      <section className="overflow-x-auto rounded-[20px] bg-white p-4">
        <table className="w-full min-w-[760px] text-left text-[14px]">
          <thead className="text-[12px] text-secundario">
            <tr><th className="pb-2">Turno</th><th>Cajero</th><th className="text-right">Tickets</th><th className="text-right">Vendido</th><th className="text-right">Efectivo</th><th className="text-right">Tarjeta</th><th className="text-right">Transfer.</th><th className="text-right">Esperado</th><th className="text-right">Contado</th><th className="text-right">Diferencia</th></tr>
          </thead>
          <tbody className="divide-y divide-linea tabular-nums">
            {cortes.map((c) => {
              const dif = c.contado != null ? c.contado - c.esperado : null;
              return (
                <tr key={c.id} className="hover:bg-niebla">
                  <td className="py-2.5"><Link href={`/interno/mostrador/cortes/${c.id}`} className="font-semibold text-azul">{fechaHora(c.abierta_en)}</Link>{!c.cerrada_en && <span className="ml-2 rounded-full bg-cian/20 px-2 text-[12px]">abierta</span>}</td>
                  <td>{c.abrio}</td>
                  <td className="text-right">{c.tickets}</td>
                  <td className="text-right">{pesos(c.ventas)}</td>
                  <td className="text-right">{pesos(c.efectivo)}</td>
                  <td className="text-right">{pesos(c.tarjeta)}</td>
                  <td className="text-right">{pesos(c.transferencia)}</td>
                  <td className="text-right">{pesos(c.esperado)}</td>
                  <td className="text-right">{c.contado != null ? pesos(c.contado) : "—"}</td>
                  <td className={`text-right font-semibold ${dif == null ? "" : dif <= -1 ? "text-red-700" : dif >= 1 ? "text-amber-700" : "text-emerald-700"}`}>
                    {dif == null ? "—" : Math.abs(dif) < 1 ? "Cuadró" : `${dif > 0 ? "+" : "−"}${pesos(Math.abs(dif))}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
