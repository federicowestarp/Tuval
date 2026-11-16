import { Suspense } from "react";
import { Marco } from "@/components/marco/Marco";
import { Titulo } from "@/components/ui";
import { cuentaActual } from "@/lib/sesion";
import { direccionesDe } from "@/lib/direcciones";
import { haySucursales } from "@/lib/pedidos";
import { FormularioPedido } from "./FormularioPedido";

export default function Carrito() {
  return (
    <Marco pie={false}>
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <Titulo>Tu pedido.</Titulo>
        <Suspense fallback={<div className="h-40 animate-pulse rounded-[20px] bg-niebla" />}>
          <Contenido />
        </Suspense>
      </main>
    </Marco>
  );
}

async function Contenido() {
  const cuenta = await cuentaActual();
  const [direcciones, sucursales] = await Promise.all([cuenta ? direccionesDe(cuenta.id) : [], haySucursales()]);
  return <FormularioPedido direcciones={direcciones} haySucursal={sucursales} nombre={cuenta?.nombre ?? ""} telefono={cuenta?.telefono ?? ""} />;
}
