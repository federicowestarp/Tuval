import { Esqueleto } from "@/components/interno/Esqueleto";
import { AvisoRecorridoServidor } from "../recorrido/estado";
import { AvisoFaltantes } from "@/components/interno/AvisoFaltantes";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { puede, requerirInterno } from "@/lib/equipo";
import { sucursal } from "@/lib/inventario";
import { efectivoVentasEnCaja, parametros } from "@/lib/caja";
import { clasesBoton } from "@/components/ui";
import { NavegacionInterna } from "../Navegacion";
import { etiquetasDesactualizadas } from "@/lib/etiquetas-db";
import { PuntoDeVenta } from "./PuntoDeVenta";
import type { ProductoInventario } from "./InventarioFocos";
import { AperturaTurno, CambiarUsuario, RetiroParcial, type CajaParaAbrir } from "./Turno";

export default function Mostrador() {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="mostrador" />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-6">
        <Suspense fallback={null}><AvisoRecorridoServidor /></Suspense>
        <Suspense fallback={null}><AvisoFaltantes /></Suspense>
        <Suspense fallback={null}><AvisoEtiquetas /></Suspense>
        <Suspense fallback={<Esqueleto />}><Contenido /></Suspense>
      </main>
    </div>
  );
}

async function Contenido() {
  await connection();
  const yo = await requerirInterno("mostrador");
  const s = await sucursal();
  const conPin = await sql<{ id: string; nombre: string }[]>`
    select id, nombre from usuarios_internos where activo and pin_hash is not null and rol in ('mostrador', 'supervisor', 'admin', 'operador') and id <> ${yo.id} order by nombre`;
  const cambiar = conPin.length > 0 && <CambiarUsuario usuarios={conPin} />;
  const [turno] = await sql<{ id: string; estado: string; registradora_id: string; caja: string; abierta_en: Date }[]>`
    select c.id, c.estado, c.registradora_id, r.nombre caja, c.abierta_en
    from cajas c join cajas_registradoras r on r.id = c.registradora_id
    where c.abierta_por = ${yo.id} and c.cerrada_en is null order by c.abierta_en desc limit 1`;

  // Sin turno: apertura (con sobre sellado o recepción de cambio de turno si aplica).
  if (!turno) {
    const cajas = await sql<CajaParaAbrir[]>`
      select r.id, r.nombre,
             (select u.nombre from cajas c join usuarios_internos u on u.id = c.cerrada_por
              where c.registradora_id = r.id and c.cerrada_en > now() - interval '3 hours' and c.cerrada_por <> ${yo.id}
                and exists (select 1 from conteos_caja cc where cc.turno_id = c.id and cc.tipo = 'fondo_siguiente')
                and not exists (select 1 from cajas n where n.recibido_de = c.id)
              order by c.cerrada_en desc limit 1) "recibeDe",
             (select u.nombre from cajas c join usuarios_internos u on u.id = c.abierta_por where c.registradora_id = r.id and c.cerrada_en is null limit 1) "ocupadaPor"
      from cajas_registradoras r where r.activa and r.almacen_id = ${s.id} order by r.nombre`;
    return (
      <>
        <div className="flex justify-end gap-2"><span className="self-center text-[14px] text-secundario">Estás como {yo.nombre}</span>{cambiar}</div>
        <AperturaTurno cajas={cajas} />
        {puede(yo.rol, "supervisor") && <p className="text-center text-[14px]"><Link href="/interno/caja" className="text-azul">Ir a supervisión de caja ›</Link></p>}
      </>
    );
  }

  if (turno.estado === "pendiente_autorizacion") {
    return (
      <section className="mx-auto max-w-xl space-y-2 rounded-[20px] bg-white p-8 text-center">
        <p className="font-display text-2xl font-semibold">Apertura pendiente de autorización del supervisor</p>
        <div className="flex justify-center">{cambiar}</div>
        <p className="text-secundario">No puedes cobrar hasta que el supervisor la autorice.</p>
      </section>
    );
  }

  const [ventas, inventario, categorias, terminales, ef, p] = await Promise.all([
    sql<{ id: string; folio: string; hora: string; comprobante: string; pendiente: boolean }[]>`
      select p.id, p.folio, to_char(p.creado_en at time zone 'America/Mexico_City', 'HH24:MI') hora, p.comprobante, (g.estado = 'pendiente') pendiente
      from pedidos p join pagos g on g.pedido_id = p.id where g.caja_id = ${turno.id} order by p.creado_en desc limit 15`,
    sql<ProductoInventario[]>`
      select p.id, p.sku, p.nombre, p.unidad, pr.precio::float precio, coalesce(e.cantidad, 0)::float existencia, p.codigo_barras,
             p.costo_promedio::float costo, p.categoria_id, e.minimo::float minimo, p.imagen_url
      from productos p
      left join precios pr on pr.producto_id = p.id and pr.lista_id = (select id from listas_precio where nombre = 'Público')
      left join existencias e on e.producto_id = p.id and e.almacen_id = ${s.id}
      where p.activo order by p.nombre`,
    sql<{ id: string; nombre: string }[]>`select id, nombre from categorias order by orden, nombre`,
    sql<{ id: string; nombre: string }[]>`
      select t.id, t.nombre from caja_terminales ct join terminales t on t.id = ct.terminal_id where ct.registradora_id = ${turno.registradora_id} and t.activa order by t.nombre`,
    efectivoVentasEnCaja(turno.id),
    parametros(),
  ]);
  // Cierre ciego: al cajero solo se le avisa que hay que retirar, nunca el monto.
  const retiroRequerido = ef.enCaja > p.umbral_retiro;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-2xl font-semibold">Mostrador · {turno.caja}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] text-secundario">{yo.nombre}</span>
          <Link href="/interno/mostrador/cierre" className={clasesBoton("secundario", "chico")}>Cerrar turno</Link>
          {cambiar}
          {puede(yo.rol, "supervisor") && <Link href="/interno/caja" className="text-[14px] text-azul">Supervisión ›</Link>}
        </div>
      </div>
      {retiroRequerido && <p className="rounded-[20px] bg-amber-100 p-4 font-semibold text-amber-900">Retiro parcial requerido: retira el efectivo dejando solo el fondo de cambio.</p>}
      <PuntoDeVenta inventario={inventario} categorias={categorias} terminales={terminales} />
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-[20px] bg-white p-5">
          <h2 className="mb-2 font-semibold">Tickets de este turno</h2>
          {ventas.length === 0 ? <p className="text-[14px] text-secundario">Aún no hay ventas.</p> : (
            <ul className="divide-y divide-linea text-[14px]">
              {ventas.map((v) => (
                <li key={v.id} className="flex items-center justify-between py-2">
                  <span>{v.hora} · {v.folio} · {v.comprobante}{v.pendiente && <span className="ml-2 rounded-full bg-amber-100 px-2 text-[12px] text-amber-900">pendiente de pago</span>}</span>
                  <Link href={`/interno/mostrador/ticket/${v.id}`} target="_blank" className="text-azul">Ticket</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <RetiroParcial />
      </div>
    </>
  );
}

/** Aviso al cajero: etiquetas de anaquel con precio desactualizado. */
async function AvisoEtiquetas() {
  await connection();
  await requerirInterno("mostrador");
  const n = (await etiquetasDesactualizadas()).length;
  if (!n) return null;
  return (
    <a href="/interno/etiquetas?cambios=1" className="flex items-center justify-between gap-2 rounded-[20px] bg-amber-50 p-3 text-[14px] ring-1 ring-amber-200">
      <span><strong>{n} etiqueta{n === 1 ? "" : "s"} de anaquel</strong> con precio que cambió. Reimprímelas para que el anaquel y la caja cobren igual.</span>
      <span className="shrink-0 font-semibold text-amber-800">Reimprimir →</span>
    </a>
  );
}
