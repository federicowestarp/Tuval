import { borrarDatosPrueba, cargarDatosPrueba } from "./acciones";

/** Aviso y botones para cargar o borrar los datos inventados de prueba. */
export function DatosPrueba({ hay }: { hay: boolean }) {
  return hay ? (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-cian/15 p-4 text-[14px]">
      <p><strong>Estás viendo datos de prueba inventados</strong> (folios PR- y PM-, vehículos y personal “prueba”). Bórralos antes de operar en serio.</p>
      <form action={borrarDatosPrueba}><button className="rounded-full bg-azul px-4 py-2 font-semibold text-white">Borrar datos de prueba</button></form>
    </div>
  ) : (
    <form action={cargarDatosPrueba} className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-white p-4 text-[14px]">
      <p className="text-secundario">¿Quieres ver el tablero lleno? Carga 30 días de datos inventados; se borran con un botón.</p>
      <button className="rounded-full border border-azul px-4 py-2 font-semibold text-azul">Cargar datos de prueba</button>
    </form>
  );
}
