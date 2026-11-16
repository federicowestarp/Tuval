import { Suspense } from "react";
import { Encabezado } from "@/components/Encabezado";
import { cuentaActual } from "@/lib/sesion";
import { direccionesDe } from "@/lib/direcciones";
import { haySucursales } from "@/lib/pedidos";
import { FormularioPedido } from "./FormularioPedido";

export default function Carrito() {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <header className="bg-azul"><Encabezado /></header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="font-display text-3xl font-bold">Tu pedido</h1>
        <Suspense fallback={<p className="mt-6 text-sm text-acero">Cargando…</p>}>
          <Contenido />
        </Suspense>
      </main>
    </div>
  );
}

async function Contenido() {
  const cuenta = await cuentaActual();
  const [direcciones, sucursales] = await Promise.all([cuenta ? direccionesDe(cuenta.id) : [], haySucursales()]);
  return (
    <FormularioPedido
      direcciones={direcciones}
      haySucursal={sucursales}
      nombre={cuenta?.nombre ?? ""}
      telefono={cuenta?.telefono ?? ""}
    />
  );
}
