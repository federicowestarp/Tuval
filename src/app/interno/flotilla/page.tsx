import { Suspense } from "react";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { campo, clasesBoton } from "@/components/ui";
import { pesos } from "@/components/interno/Indicadores";
import { NavegacionInterna } from "../Navegacion";
import { agregarEmpleado, agregarVehiculo, darDeBaja } from "./acciones";

export default function Flotilla() {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="flotilla" />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">
        <h1 className="font-display text-2xl font-semibold">Flotilla y personal</h1>
        <Suspense fallback={<p className="text-sm text-secundario">Cargando…</p>}><Contenido /></Suspense>
      </main>
    </div>
  );
}

async function Contenido() {
  await connection();
  await requerirInterno("admin");
  const [vehiculos, empleados] = await Promise.all([
    sql<{ id: string; nombre: string; tipo: string; placas: string | null }[]>`select id, nombre, tipo, placas from vehiculos where activo order by nombre`,
    sql<{ id: string; nombre: string; puesto: string | null; sueldo: number | null; periodicidad: string }[]>`select id, nombre, puesto, sueldo::float sueldo, periodicidad from empleados where activo order by nombre`,
  ]);
  const baja = (id: string, tabla: string) => (
    <form action={darDeBaja}><input type="hidden" name="id" value={id} /><input type="hidden" name="tabla" value={tabla} /><button className="text-[13px] text-secundario hover:text-azul">Dar de baja</button></form>
  );
  return (
    <>
      <section className="space-y-3 rounded-[20px] bg-white p-5">
        <h2 className="font-semibold">Vehículos</h2>
        <ul className="divide-y divide-linea text-[15px]">
          {vehiculos.map((v) => <li key={v.id} className="flex items-center justify-between py-2.5"><span>{v.nombre} <span className="text-[13px] text-secundario">· {v.tipo}{v.placas && ` · ${v.placas}`}</span></span>{baja(v.id, "vehiculos")}</li>)}
        </ul>
        <form action={agregarVehiculo} className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <input name="nombre" placeholder="Nombre (ej. Camioneta 1)" className={campo} required />
          <select name="tipo" className={campo}><option value="camioneta">Camioneta</option><option value="moto">Moto</option><option value="camion">Camión</option><option value="auto">Auto</option></select>
          <input name="placas" placeholder="Placas" className={campo} />
          <button className={clasesBoton("principal", "normal")}>Agregar</button>
        </form>
      </section>
      <section className="space-y-3 rounded-[20px] bg-white p-5">
        <h2 className="font-semibold">Personal (nómina)</h2>
        <ul className="divide-y divide-linea text-[15px]">
          {empleados.map((e) => <li key={e.id} className="flex items-center justify-between py-2.5"><span>{e.nombre} <span className="text-[13px] text-secundario">· {e.puesto ?? "sin puesto"}{e.sueldo != null && ` · ${pesos(e.sueldo)} ${e.periodicidad}`}</span></span>{baja(e.id, "empleados")}</li>)}
        </ul>
        <form action={agregarEmpleado} className="grid gap-2 sm:grid-cols-2">
          <input name="nombre" placeholder="Nombre" className={campo} required />
          <input name="puesto" placeholder="Puesto (chofer, almacén…)" className={campo} />
          <input name="sueldo" placeholder="Sueldo por periodo" inputMode="decimal" className={campo} />
          <select name="periodicidad" className={campo}><option value="quincenal">Quincenal</option><option value="semanal">Semanal</option><option value="mensual">Mensual</option></select>
          <div><button className={clasesBoton("principal", "normal")}>Agregar persona</button></div>
        </form>
        <p className="text-[13px] text-secundario">Los pagos de nómina se registran en Gastos → categoría Nómina, ligados a la persona.</p>
      </section>
    </>
  );
}
