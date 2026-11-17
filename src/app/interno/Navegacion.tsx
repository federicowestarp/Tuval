import { Suspense } from "react";
import { BarraFlotante, EspacioBarra } from "@/components/marco/BarraFlotante";
import { BarraProvisional } from "@/components/marco/BarraProvisional";
import { puede, usuarioInterno, type Minimo } from "@/lib/equipo";
import { salir } from "./sesion-acciones";

type Seccion = "tablero" | "pedidos" | "demanda" | "contactos" | "catalogo" | "equipo" | "chofer" | "gastos" | "flotilla" | "mostrador" | "inventario" | "cortes";
const AREAS = ["Dirección", "Pedidos en línea", "Sucursal", "Reparto"] as const;
const SECCIONES: { id: Seccion; texto: string; href: string; area: (typeof AREAS)[number]; minimo?: Minimo }[] = [
  { id: "tablero", texto: "Tablero", href: "/interno/tablero", area: "Dirección", minimo: "admin" },
  { id: "gastos", texto: "Gastos", href: "/interno/gastos", area: "Dirección", minimo: "admin" },
  { id: "catalogo", texto: "Catálogo", href: "/interno/catalogo", area: "Dirección", minimo: "admin" },
  { id: "equipo", texto: "Equipo", href: "/interno/equipo", area: "Dirección", minimo: "admin" },
  { id: "pedidos", texto: "Pedidos", href: "/interno/pedidos", area: "Pedidos en línea", minimo: "operador" },
  { id: "demanda", texto: "Demanda", href: "/interno/demanda", area: "Pedidos en línea", minimo: "operador" },
  { id: "contactos", texto: "Contactos", href: "/interno/contactos", area: "Pedidos en línea", minimo: "operador" },
  { id: "mostrador", texto: "Mostrador", href: "/interno/mostrador", area: "Sucursal", minimo: "mostrador" },
  { id: "cortes", texto: "Cortes de caja", href: "/interno/mostrador/cortes", area: "Sucursal", minimo: "mostrador" },
  { id: "inventario", texto: "Inventario", href: "/interno/inventario", area: "Sucursal", minimo: "mostrador" },
  { id: "chofer", texto: "Ruta del día", href: "/interno/chofer", area: "Reparto" },
  { id: "flotilla", texto: "Flotilla y personal", href: "/interno/flotilla", area: "Reparto", minimo: "admin" },
];

async function Barra({ actual }: { actual: Seccion }) {
  const u = await usuarioInterno();
  const secciones = u ? SECCIONES.filter((s) => puede(u.rol, s.minimo)) : [];
  const aqui = SECCIONES.find((s) => s.id === actual);
  return (
    <BarraFlotante
      inicio="/interno"
      titulo={aqui?.texto}
      grupos={AREAS.map((area) => ({ titulo: area, enlaces: secciones.filter((s) => s.area === area).map((s) => ({ href: s.href, texto: s.texto })) })).filter((g) => g.enlaces.length > 0)}
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
