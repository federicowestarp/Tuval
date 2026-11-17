import { Suspense } from "react";
import { BarraFlotante, EspacioBarra } from "@/components/marco/BarraFlotante";
import { BarraProvisional } from "@/components/marco/BarraProvisional";
import { puede, usuarioInterno, type Minimo } from "@/lib/equipo";
import { salir } from "./sesion-acciones";

type Seccion = "tablero" | "pedidos" | "demanda" | "contactos" | "catalogo" | "equipo" | "chofer" | "gastos" | "flotilla" | "mostrador" | "inventario";
const SECCIONES: { id: Seccion; texto: string; href: string; minimo?: Minimo }[] = [
  { id: "tablero", texto: "Tablero", href: "/interno/tablero", minimo: "admin" },
  { id: "pedidos", texto: "Pedidos", href: "/interno/pedidos", minimo: "operador" },
  { id: "demanda", texto: "Demanda", href: "/interno/demanda", minimo: "operador" },
  { id: "contactos", texto: "Contactos", href: "/interno/contactos", minimo: "operador" },
  { id: "mostrador", texto: "Mostrador", href: "/interno/mostrador", minimo: "mostrador" },
  { id: "inventario", texto: "Inventario", href: "/interno/inventario", minimo: "mostrador" },
  { id: "chofer", texto: "Ruta", href: "/interno/chofer" },
  { id: "gastos", texto: "Gastos", href: "/interno/gastos", minimo: "admin" },
  { id: "flotilla", texto: "Flotilla", href: "/interno/flotilla", minimo: "admin" },
  { id: "catalogo", texto: "Catálogo", href: "/interno/catalogo", minimo: "admin" },
  { id: "equipo", texto: "Equipo", href: "/interno/equipo", minimo: "admin" },
];

async function Barra({ actual }: { actual: Seccion }) {
  const u = await usuarioInterno();
  const secciones = u ? SECCIONES.filter((s) => puede(u.rol, s.minimo)) : [];
  const aqui = SECCIONES.find((s) => s.id === actual);
  return (
    <BarraFlotante
      inicio="/interno"
      titulo={aqui?.texto}
      enlaces={secciones.map((s) => ({ href: s.href, texto: s.texto }))}
      pieMenu={u && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{u.nombre} · {u.rol}</span>
          <form action={salir}><button className="font-semibold text-tinta hover:text-azul">Cerrar sesión</button></form>
        </div>
      )}
    />
  );
}

/** Barra flotante del panel: sección actual a la vista y menú a pantalla completa con lo que permite el rol. */
export function NavegacionInterna({ actual }: { actual: Seccion }) {
  return (
    <>
      <Suspense fallback={<BarraProvisional inicio="/interno" titulo={SECCIONES.find((s) => s.id === actual)?.texto} />}>
        <Barra actual={actual} />
      </Suspense>
      <EspacioBarra />
    </>
  );
}
