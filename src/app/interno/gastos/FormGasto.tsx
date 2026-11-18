"use client";

import { ElegirArchivo } from "@/components/ElegirArchivo";
import { useActionState, useState } from "react";
import { campo, clasesBoton, etiqueta } from "@/components/ui";
import { registrarGasto, type EstadoGasto } from "./acciones";

const NOMBRES: Record<string, string> = {
  combustible: "Combustible", mantenimiento: "Mantenimiento", seguro: "Seguro", casetas: "Casetas", nomina: "Nómina",
  renta: "Renta", servicios: "Servicios (luz, agua, internet)", marketing: "Marketing", compras: "Compras", otros: "Otros",
};

type Opcion = { id: string; nombre: string };

export function FormGasto({ vehiculos, empleados, hoy }: { vehiculos: Opcion[]; empleados: Opcion[]; hoy: string }) {
  const [e, accion, enviando] = useActionState<EstadoGasto, FormData>(registrarGasto, {});
  const [cat, setCat] = useState("combustible");
  const deVehiculo = ["combustible", "mantenimiento", "seguro", "casetas"].includes(cat);
  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className={etiqueta} htmlFor="categoria">Categoría</label>
        <select id="categoria" name="categoria" value={cat} onChange={(x) => setCat(x.target.value)} className={campo}>
          {Object.entries(NOMBRES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div><label className={etiqueta} htmlFor="fecha">Fecha</label><input id="fecha" name="fecha" type="date" defaultValue={hoy} className={campo} /></div>
      <div className="sm:col-span-2"><label className={etiqueta} htmlFor="concepto">Concepto</label><input id="concepto" name="concepto" className={campo} placeholder={cat === "nomina" ? "Quincena 1–15 nov" : "Ej. Gasolina 40 L"} required /></div>
      <div><label className={etiqueta} htmlFor="monto">Monto total (con IVA)</label><input id="monto" name="monto" inputMode="decimal" className={campo} required /></div>
      <div>
        <label className={etiqueta} htmlFor="forma_pago">Forma de pago</label>
        <select id="forma_pago" name="forma_pago" className={campo}><option value="">—</option><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option></select>
      </div>
      {(deVehiculo || cat === "otros") && (
        <div>
          <label className={etiqueta} htmlFor="vehiculo_id">Vehículo</label>
          <select id="vehiculo_id" name="vehiculo_id" className={campo}><option value="">Ninguno</option>{vehiculos.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}</select>
        </div>
      )}
      {cat === "nomina" && (
        <div>
          <label className={etiqueta} htmlFor="empleado_id">Persona</label>
          <select id="empleado_id" name="empleado_id" className={campo} required><option value="">Elige…</option>{empleados.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select>
        </div>
      )}
      <div className="sm:col-span-2"><ElegirArchivo name="comprobante" accept="image/*,application/pdf" texto="Comprobante" ayuda="Foto o PDF, opcional" /></div>
      {e.error && <p role="alert" className="font-semibold text-red-700 sm:col-span-2">{e.error}</p>}
      {e.ok && !e.error && <p className="text-[14px] font-semibold text-azul sm:col-span-2">Gasto guardado.</p>}
      <div className="sm:col-span-2"><button disabled={enviando} className={clasesBoton("principal", "normal")}>{enviando ? "Guardando…" : "Guardar gasto"}</button></div>
    </form>
  );
}
