import { ventaDelDia } from "@/lib/venta-dia";
import { Barras, pesos } from "./Indicadores";

/** Tarjeta "Venta de hoy" con desglose por tipo (Admin y Supervisor). */
export async function VentaDelDia() {
  const v = await ventaDelDia();
  return (
    <section className="grid gap-3 rounded-[20px] bg-white p-5 md:grid-cols-[14rem_1fr]">
      <div>
        <p className="text-[13px] text-secundario">Venta de hoy</p>
        <p className="font-display text-[34px] font-semibold tabular-nums">{pesos(v.total)}</p>
        {v.pendienteTransferencia > 0 && <p className="text-[13px] text-amber-800">+ {pesos(v.pendienteTransferencia)} en transferencias pendientes</p>}
      </div>
      <Barras filas={v.porTipo.map((x) => ({ etiqueta: x.tipo, valor: x.monto, texto: pesos(x.monto), detalle: x.cobros ? `${x.cobros} cobros` : undefined }))} vacio="Aún no hay ventas hoy." />
    </section>
  );
}
