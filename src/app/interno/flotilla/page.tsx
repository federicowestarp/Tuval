import { Esqueleto } from "@/components/interno/Esqueleto";
import { Suspense } from "react";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { campo, clasesBoton } from "@/components/ui";
import { pesos } from "@/components/interno/Indicadores";
import { NavegacionInterna } from "../Navegacion";
import { agregarEmpleado, agregarVehiculo, darDeBaja, ligarRastreador } from "./acciones";

export default function Flotilla() {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="flotilla" />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">
        <h1 className="font-display text-2xl font-semibold">Flotilla y personal</h1>
        <Suspense fallback={<Esqueleto />}><Contenido /></Suspense>
      </main>
    </div>
  );
}

async function Contenido() {
  await connection();
  await requerirInterno("admin");
  const [vehiculos, empleados] = await Promise.all([
    sql<{ id: string; nombre: string; tipo: string; placas: string | null; rastreador_id: string | null; ultima: string | null }[]>`
      select v.id, v.nombre, v.tipo, v.placas, v.rastreador_id,
             (select to_char(max(registrada_en) at time zone 'America/Mexico_City', 'DD/MM HH24:MI') from posiciones_vehiculo where vehiculo_id = v.id) ultima
      from vehiculos v where v.activo order by v.nombre`,
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
          {vehiculos.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span>{v.nombre} <span className="text-[13px] text-secundario">· {v.tipo}{v.placas && ` · ${v.placas}`}{v.ultima ? ` · GPS: última señal ${v.ultima}` : v.rastreador_id ? " · GPS sin señal aún" : ""}</span></span>
              <span className="flex items-center gap-3">
                <form action={ligarRastreador} className="flex gap-1">
                  <input type="hidden" name="id" value={v.id} />
                  <input name="rastreador_id" defaultValue={v.rastreador_id ?? ""} placeholder="ID del GPS o celular" className="h-8 w-36 rounded-lg border border-linea px-2 text-[13px]" />
                  <button className="text-[13px] text-azul">Guardar</button>
                </form>
                {baja(v.id, "vehiculos")}
              </span>
            </li>
          ))}
        </ul>
        <form action={agregarVehiculo} className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
          <input name="nombre" placeholder="Nombre (ej. Camioneta 1)" className={campo} required />
          <select name="tipo" className={campo}><option value="camioneta">Camioneta</option><option value="moto">Moto</option><option value="camion">Camión</option><option value="auto">Auto</option></select>
          <input name="placas" placeholder="Placas" className={campo} />
          <input name="rastreador_id" placeholder="ID del GPS o celular (opcional)" className={campo} />
          <button className={clasesBoton("principal", "normal")}>Agregar</button>
        </form>
      </section>
      <section className="space-y-2 rounded-[20px] bg-white p-5 text-[14px]">
        <h2 className="text-[16px] font-semibold">Celular del chofer como GPS (gratis, aun con el teléfono bloqueado)</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>En el celular del chofer instala <strong>Traccar Client</strong> (gratis en Play Store y App Store).</li>
          <li>En la app, en <em>Identificador del dispositivo</em> escribe un nombre corto, p. ej. <code>camioneta1</code>, y ponlo igual arriba en “ID del GPS o celular” del vehículo.</li>
          <li>En <em>URL del servidor</em> pon: {process.env.RASTREO_TOKEN
            ? <code className="break-all rounded bg-niebla px-1">https://www.tuval.mx/api/rastreo?token={process.env.RASTREO_TOKEN}</code>
            : <span className="font-semibold text-red-700">falta crear la variable RASTREO_TOKEN en Vercel (Settings → Environment Variables) y volver a publicar.</span>}</li>
          <li>Precisión alta, frecuencia 30 s, y permite ubicación “Siempre” y sin ahorro de batería para la app.</li>
        </ol>
        <p className="text-secundario">Las posiciones se ligan al vehículo, cuentan los km en el Tablero y el cliente ve el camión en su seguimiento.</p>
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
