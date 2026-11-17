import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { puede, requerirInterno } from "@/lib/equipo";
import { estadoCuenta, puntosDe } from "@/lib/clientes";
import { ligaWhatsApp } from "@/lib/pedidos";
import { NOMBRE_INTERNO, type EstadoPedido } from "@/lib/estados";
import { Esqueleto } from "@/components/interno/Esqueleto";
import { Indicador, pesos } from "@/components/interno/Indicadores";
import { campo, etiqueta } from "@/components/ui";
import { NavegacionInterna } from "../../Navegacion";
import { agregarContacto, ajustarPuntos, guardarCliente, guardarCredito, quitarContacto } from "../acciones";

const caja = "rounded-[20px] bg-white p-5";

export default function Ficha(props: PageProps<"/interno/clientes/[id]">) {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="clientes" />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-6">
        <Link href="/interno/clientes" className="text-[14px] text-azul">‹ Clientes</Link>
        <Suspense fallback={<Esqueleto />}><Contenido params={props.params} /></Suspense>
      </main>
    </div>
  );
}

type Cliente = {
  id: string; nombre: string; tipo: string; razon_social: string | null; rfc: string | null; regimen_fiscal: string | null; codigo_postal_fiscal: string | null; uso_cfdi: string | null;
  telefono: string | null; correo: string | null; direccion_fiscal: string | null; direccion_oficina: string | null; preferencia_contacto: string; horario_contacto: string | null;
  acepta_promociones: boolean; notas: string | null; creado_en: Date; credito_activo: boolean; limite_credito: number | null; dias_credito: number | null;
  lista_precio_id: string | null; codigo_recomendado: string | null; recomendado_por: string | null; recomendado_nombre: string | null; anios: number; meses: number;
};

async function Contenido({ params }: { params: PageProps<"/interno/clientes/[id]">["params"] }) {
  await connection();
  const yo = await requerirInterno("operador");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [c] = await sql<Cliente[]>`
    select c.*, c.limite_credito::float limite_credito, r.nombre recomendado_nombre,
           extract(year from age(now(), c.creado_en))::int anios, (extract(year from age(now(), c.creado_en)) * 12 + extract(month from age(now(), c.creado_en)))::int meses
    from clientes c left join clientes r on r.id = c.recomendado_por where c.id = ${id}`;
  if (!c) notFound();
  const [cuenta, puntos, contactos, direcciones, pedidos, listas, recomendados, movPuntos, resumen] = await Promise.all([
    estadoCuenta(id), puntosDe(id),
    sql<{ id: string; nombre: string; puesto: string | null; telefono: string | null; correo: string | null; preferencia: string }[]>`select * from cliente_contactos where cliente_id = ${id} order by principal desc, nombre`,
    sql<{ id: string; alias: string; tipo: string; direccion: string; municipio: string | null; entidad: string | null; recibe_nombre: string | null }[]>`
      select d.id, d.alias, d.tipo::text tipo, d.direccion, d.municipio, d.entidad, d.recibe_nombre from direcciones d join cuentas cu on cu.id = d.cuenta_id
      where cu.cliente_id = ${id} and d.activa order by d.creado_en desc`,
    sql<{ id: string; folio: string; fecha: string; canal: string; estado: EstadoPedido; total: number; a_credito: boolean }[]>`
      select id, folio, to_char(creado_en at time zone 'America/Mexico_City', 'YYYY-MM-DD') fecha, canal::text canal, estado, total::float total, a_credito
      from pedidos where cliente_id = ${id} order by creado_en desc limit 50`,
    sql<{ id: string; nombre: string }[]>`select id, nombre from listas_precio where activa order by nombre`,
    sql<{ id: string; nombre: string }[]>`select id, nombre from clientes where recomendado_por = ${id} order by creado_en desc`,
    sql<{ fecha: string; puntos: number; motivo: string; nota: string | null }[]>`
      select to_char(creado_en at time zone 'America/Mexico_City', 'YYYY-MM-DD') fecha, puntos, motivo, nota from movimientos_puntos where cliente_id = ${id} order by creado_en desc limit 10`,
    sql<{ comprado: number; pedidos: number; ticket: number | null; dias_desde: number | null }[]>`
      select coalesce(sum(total) filter (where estado in ('entregado', 'entregado_con_faltantes')), 0)::float comprado, count(*) filter (where estado <> 'cancelado')::int pedidos,
             (avg(total) filter (where estado in ('entregado', 'entregado_con_faltantes')))::float ticket,
             extract(day from now() - max(creado_en))::int dias_desde
      from pedidos where cliente_id = ${id}`,
  ]);
  const r = resumen[0];
  const { anios, meses } = c;
  const tel = c.telefono?.replace(/\D/g, "");

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">{c.nombre}</h1>
          <p className="text-[14px] text-secundario">{c.razon_social ?? (c.tipo === "empresa" ? "Empresa" : "Persona")} · cliente desde hace {anios >= 1 ? `${anios} año${anios === 1 ? "" : "s"}` : `${meses} mes${meses === 1 ? "" : "es"}`} · prefiere {c.preferencia_contacto}{c.horario_contacto && ` (${c.horario_contacto})`}</p>
        </div>
        <div className="flex gap-2">
          {tel && <a href={ligaWhatsApp(tel, `Hola ${c.nombre}, te escribimos de Tuval.`)} target="_blank" className="rounded-full bg-azul px-4 py-2 text-[14px] font-semibold text-white">WhatsApp</a>}
          {tel && <a href={`tel:${tel}`} className="rounded-full border border-azul px-4 py-2 text-[14px] font-semibold text-azul">Llamar</a>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Indicador etiqueta="Comprado" valor={pesos(r.comprado)} nota={`${r.pedidos} pedidos`} />
        <Indicador etiqueta="Ticket promedio" valor={r.ticket ? pesos(r.ticket) : "—"} />
        <Indicador etiqueta="Última compra" valor={r.dias_desde != null ? `hace ${r.dias_desde} d` : "—"} />
        <Indicador etiqueta="Saldo a crédito" valor={pesos(cuenta.saldo)} nota={cuenta.vencido ? `${pesos(cuenta.vencido)} vencido` : cuenta.limite != null ? `disponible ${pesos(cuenta.disponible ?? 0)}` : "sin crédito"} />
        <Indicador etiqueta="Puntos" valor={String(puntos)} nota={c.codigo_recomendado ? `código ${c.codigo_recomendado}` : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <form action={guardarCliente} className={`${caja} grid gap-2 sm:grid-cols-2`}>
          <h2 className="font-semibold sm:col-span-2">Datos y contacto</h2>
          <input type="hidden" name="id" value={c.id} />
          <div className="sm:col-span-2"><label className={etiqueta} htmlFor="nombre">Nombre</label><input id="nombre" name="nombre" defaultValue={c.nombre} className={campo} /></div>
          <div><label className={etiqueta} htmlFor="telefono">Teléfono</label><input id="telefono" name="telefono" defaultValue={c.telefono ?? ""} className={campo} /></div>
          <div><label className={etiqueta} htmlFor="correo">Correo</label><input id="correo" name="correo" type="email" defaultValue={c.correo ?? ""} className={campo} /></div>
          <div><label className={etiqueta} htmlFor="preferencia_contacto">Prefiere</label>
            <select id="preferencia_contacto" name="preferencia_contacto" defaultValue={c.preferencia_contacto} className={campo}><option value="whatsapp">WhatsApp</option><option value="llamada">Llamada</option><option value="correo">Correo</option></select></div>
          <div><label className={etiqueta} htmlFor="horario_contacto">Horario</label><input id="horario_contacto" name="horario_contacto" defaultValue={c.horario_contacto ?? ""} placeholder="Ej. 9 a 14 h" className={campo} /></div>
          <div className="sm:col-span-2"><label className={etiqueta} htmlFor="direccion_oficina">Dirección de oficina</label><input id="direccion_oficina" name="direccion_oficina" defaultValue={c.direccion_oficina ?? ""} className={campo} /></div>
          <h3 className="pt-2 font-semibold sm:col-span-2">Datos fiscales</h3>
          <div className="sm:col-span-2"><label className={etiqueta} htmlFor="razon_social">Razón social</label><input id="razon_social" name="razon_social" defaultValue={c.razon_social ?? ""} className={campo} /></div>
          <div><label className={etiqueta} htmlFor="rfc">RFC</label><input id="rfc" name="rfc" defaultValue={c.rfc ?? ""} className={campo} /></div>
          <div><label className={etiqueta} htmlFor="regimen_fiscal">Régimen</label><input id="regimen_fiscal" name="regimen_fiscal" defaultValue={c.regimen_fiscal ?? ""} className={campo} /></div>
          <div><label className={etiqueta} htmlFor="codigo_postal_fiscal">C.P. fiscal</label><input id="codigo_postal_fiscal" name="codigo_postal_fiscal" defaultValue={c.codigo_postal_fiscal ?? ""} className={campo} /></div>
          <div><label className={etiqueta} htmlFor="uso_cfdi">Uso de CFDI</label><input id="uso_cfdi" name="uso_cfdi" defaultValue={c.uso_cfdi ?? ""} className={campo} /></div>
          <div className="sm:col-span-2"><label className={etiqueta} htmlFor="direccion_fiscal">Domicilio fiscal</label><input id="direccion_fiscal" name="direccion_fiscal" defaultValue={c.direccion_fiscal ?? ""} className={campo} /></div>
          <div className="sm:col-span-2"><label className={etiqueta} htmlFor="notas">Notas</label><textarea id="notas" name="notas" defaultValue={c.notas ?? ""} rows={2} className="w-full rounded-xl border border-linea p-3" /></div>
          <label className="flex items-center gap-2 text-[14px] sm:col-span-2"><input type="checkbox" name="acepta_promociones" defaultChecked={c.acepta_promociones} /> Acepta recibir promociones</label>
          <button className="rounded-full bg-azul px-4 py-2 font-semibold text-white sm:col-span-2">Guardar</button>
        </form>

        <div className="space-y-4">
          <section className={caja}>
            <h2 className="mb-2 font-semibold">Estado de cuenta</h2>
            {cuenta.cargos.length === 0 ? <p className="text-[14px] text-secundario">Sin saldo pendiente.</p> : (
              <ul className="divide-y divide-linea text-[14px]">
                {cuenta.cargos.map((x) => (
                  <li key={x.id} className="flex justify-between py-1.5"><span><Link href={`/interno/pedidos/${x.id}`} className="text-azul">{x.folio}</Link> · {x.fecha} · vence {x.vence ?? "—"}</span>
                    <span className={`tabular-nums ${x.vencido ? "font-semibold text-red-700" : ""}`}>{pesos(x.saldo)}</span></li>
                ))}
              </ul>
            )}
            {puede(yo.rol, "admin") ? (
              <form action={guardarCredito} className="mt-3 grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="id" value={c.id} />
                <label className="flex items-center gap-2 text-[14px] sm:col-span-2"><input type="checkbox" name="credito_activo" defaultChecked={c.credito_activo} /> Crédito autorizado</label>
                <input name="limite_credito" inputMode="decimal" defaultValue={c.limite_credito ?? ""} placeholder="Límite $" className={campo} />
                <input name="dias_credito" inputMode="numeric" defaultValue={c.dias_credito ?? ""} placeholder="Días de crédito" className={campo} />
                <select name="lista_precio_id" defaultValue={c.lista_precio_id ?? ""} className={`${campo} sm:col-span-2`}><option value="">Lista: Público</option>{listas.map((l) => <option key={l.id} value={l.id}>Lista: {l.nombre}</option>)}</select>
                <button className="rounded-full border border-azul px-4 py-2 font-semibold text-azul sm:col-span-2">Guardar crédito y lista</button>
              </form>
            ) : <p className="mt-2 text-[13px] text-secundario">Crédito: {c.credito_activo ? `${pesos(c.limite_credito ?? 0)} a ${c.dias_credito ?? 0} días` : "no autorizado"}.</p>}
          </section>

          <section className={caja}>
            <h2 className="mb-2 font-semibold">Contactos</h2>
            <ul className="divide-y divide-linea text-[14px]">
              {contactos.map((k) => (
                <li key={k.id} className="flex items-center justify-between py-1.5">
                  <span>{k.nombre}{k.puesto && ` · ${k.puesto}`} · {k.telefono ?? k.correo ?? "—"} · prefiere {k.preferencia}</span>
                  <form action={quitarContacto}><input type="hidden" name="id" value={k.id} /><input type="hidden" name="cliente_id" value={c.id} /><button className="text-[12px] text-secundario">Quitar</button></form>
                </li>
              ))}
            </ul>
            <form action={agregarContacto} className="mt-2 grid gap-2 sm:grid-cols-2">
              <input type="hidden" name="cliente_id" value={c.id} />
              <input name="nombre" required placeholder="Nombre" className={campo} />
              <input name="puesto" placeholder="Puesto (compras, residente…)" className={campo} />
              <input name="telefono" placeholder="Teléfono" className={campo} />
              <select name="preferencia" className={campo}><option value="whatsapp">WhatsApp</option><option value="llamada">Llamada</option><option value="correo">Correo</option></select>
              <button className="rounded-full border border-azul px-4 py-2 font-semibold text-azul sm:col-span-2">Agregar contacto</button>
            </form>
          </section>

          <section className={caja}>
            <h2 className="mb-2 font-semibold">Direcciones de entrega</h2>
            {direcciones.length === 0 ? <p className="text-[14px] text-secundario">Las guarda el cliente desde su cuenta en la tienda.</p> : (
              <ul className="divide-y divide-linea text-[14px]">{direcciones.map((d) => <li key={d.id} className="py-1.5"><strong>{d.alias}</strong> ({d.tipo}) · {d.direccion}{d.municipio && `, ${d.municipio}`} · recibe {d.recibe_nombre ?? "—"}</li>)}</ul>
            )}
          </section>

          <section className={caja}>
            <h2 className="mb-2 font-semibold">Lealtad y recomendados</h2>
            <p className="text-[14px]">Código para recomendar: <strong>{c.codigo_recomendado ?? "—"}</strong>{c.recomendado_nombre && <> · Lo recomendó <Link href={`/interno/clientes/${c.recomendado_por}`} className="text-azul">{c.recomendado_nombre}</Link></>}</p>
            {recomendados.length > 0 && <p className="text-[14px] text-secundario">Ha recomendado a: {recomendados.map((x) => x.nombre).join(", ")}</p>}
            <ul className="mt-2 text-[13px] text-secundario">{movPuntos.map((m, i) => <li key={i}>{m.fecha} · {m.puntos > 0 ? "+" : ""}{m.puntos} · {m.motivo}{m.nota && ` · ${m.nota}`}</li>)}</ul>
            {puede(yo.rol, "admin") && (
              <form action={ajustarPuntos} className="mt-2 flex gap-2"><input type="hidden" name="id" value={c.id} /><input name="puntos" inputMode="numeric" placeholder="± puntos" className="h-9 w-24 rounded-lg border border-linea px-2" /><input name="nota" placeholder="Motivo" className="h-9 flex-1 rounded-lg border border-linea px-2" /><button className="text-azul">Ajustar</button></form>
            )}
          </section>
        </div>
      </div>

      <section className={caja}>
        <h2 className="mb-2 font-semibold">Historial de compras</h2>
        {pedidos.length === 0 ? <p className="text-[14px] text-secundario">Sin pedidos.</p> : (
          <ul className="divide-y divide-linea text-[14px]">
            {pedidos.map((p) => (
              <li key={p.id} className="flex justify-between py-1.5">
                <span><Link href={p.canal === "mostrador" ? `/interno/mostrador/ticket/${p.id}` : `/interno/pedidos/${p.id}`} className="text-azul">{p.folio}</Link> · {p.fecha} · {p.canal === "mostrador" ? "mostrador" : "en línea"} · {NOMBRE_INTERNO[p.estado]}{p.a_credito && " · crédito"}</span>
                <span className="tabular-nums">{pesos(p.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
