"use server";

import { refrescar } from "@/lib/refrescar";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { esCategoria } from "@/lib/categorias";

const ESTADOS = ["nueva", "buscando", "conseguida", "agregada_catalogo", "no_conseguible"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ids = (fd: FormData) => String(fd.get("ids") ?? "").split(",").filter((x) => UUID.test(x));

/** Actualiza todas las solicitudes del grupo (misma pieza pedida varias veces). */
export async function actualizarSolicitud(fd: FormData) {
  await requerirInterno("operador");
  const grupo = ids(fd);
  const estado = String(fd.get("estado"));
  if (!ESTADOS.includes(estado)) throw new Error("Estado inválido");
  await sql`
    update solicitudes_producto
    set estado = ${estado}, proveedor_alterno = ${String(fd.get("proveedor_alterno") ?? "").trim() || null},
        notas = ${String(fd.get("notas") ?? "").trim() || null}, actualizado_en = now()
    where id = any(${grupo}::uuid[])`;
  refrescar("/interno/demanda");
}

export type ResultadoAlta = { error?: string; mensaje?: string };

/**
 * Da de alta en catálogo lo que pidió el cliente. Si la solicitud viene de un pedido sin confirmar,
 * se agrega como partida a ese pedido.
 */
export async function darDeAlta(_prev: ResultadoAlta, fd: FormData): Promise<ResultadoAlta> {
  await requerirInterno("operador");
  const grupo = ids(fd);
  if (grupo.length === 0) return { error: "Solicitud no encontrada." };
  const nombre = String(fd.get("nombre") ?? "").trim();
  const sku = String(fd.get("sku") ?? "").trim().toUpperCase();
  const categoria = String(fd.get("categoria"));
  const precioTxt = String(fd.get("precio") ?? "").replace(/[$,\s]/g, "");
  const precio = precioTxt ? Number(precioTxt) : null;
  if (nombre.length < 3) return { error: "Escribe el nombre del producto." };
  if (!/^[A-Z0-9-]{3,30}$/.test(sku)) return { error: "SKU: 3 a 30 letras, números o guiones." };
  if (!esCategoria(categoria)) return { error: "Elige categoría." };
  if (precio != null && !(precio > 0)) return { error: "Precio inválido." };

  const solicitudes = await sql<{ id: string; pedido_id: string | null; cantidad: number | null; abierto: boolean }[]>`
    select s.id, s.pedido_id, s.cantidad,
           (p.id is not null and p.confirmado_en is null and p.estado = 'recibido') as abierto
    from solicitudes_producto s left join pedidos p on p.id = s.pedido_id where s.id = any(${grupo}::uuid[])`;
  if (solicitudes.length === 0) return { error: "Solicitud no encontrada." };
  const [existe] = await sql`select 1 from productos where sku = ${sku}`;
  if (existe) return { error: "Ese SKU ya existe." };

  await sql.begin(async (tx) => {
    const [prod] = await tx<{ id: string }[]>`
      insert into productos (sku, nombre, categoria_id) values (${sku}, ${nombre}, ${categoria}) returning id`;
    if (precio != null) {
      await tx`insert into precios (lista_id, producto_id, precio) select id, ${prod.id}, ${precio} from listas_precio where nombre = 'Público'`;
    }
    await tx`update solicitudes_producto set estado = 'agregada_catalogo', producto_id = ${prod.id}, actualizado_en = now() where id = any(${grupo}::uuid[])`;
    // Pedidos que siguen sin confirmar: la pieza entra como partida para cotizarla con el resto.
    for (const s of solicitudes.filter((x) => x.abierto)) {
      await tx`
        insert into pedido_partidas (pedido_id, producto_id, cantidad, precio_unitario)
        values (${s.pedido_id}, ${prod.id}, ${s.cantidad ?? 1}, ${precio})`;
    }
  });
  refrescar("/interno/demanda");
  const agregados = solicitudes.filter((x) => x.abierto).length;
  return { mensaje: agregados ? `Alta hecha y agregado a ${agregados} pedido(s) por confirmar.` : "Alta hecha en catálogo." };
}

/**
 * Avisar al cliente que ya conseguimos lo que buscaba: abre WhatsApp con el mensaje escrito y queda marcado como avisado.
 */
export async function avisarCliente(id: string): Promise<{ url?: string; error?: string }> {
  await requerirInterno("mostrador");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "No válido." };
  const [s] = await sql<{ descripcion: string; telefono: string | null; nombre: string | null }[]>`
    select s.descripcion, coalesce(s.contacto_telefono, p.contacto_telefono, cu.telefono) telefono, coalesce(p.contacto_nombre, cl.nombre, cu.nombre) nombre
    from solicitudes_producto s left join pedidos p on p.id = s.pedido_id left join cuentas cu on cu.id = s.cuenta_id left join clientes cl on cl.id = s.cliente_id
    where s.id = ${id}`;
  if (!s?.telefono) return { error: "No dejó celular." };
  await sql`update solicitudes_producto set avisado_en = now() where id = ${id}`;
  refrescar("/interno/demanda");
  const hola = s.nombre && !/^cliente /i.test(s.nombre) ? `Hola ${s.nombre.split(" ")[0]}` : "Hola";
  const mensaje = `${hola}, de Tuval. Ya tenemos lo que buscabas: ${s.descripcion}. ¿Te lo apartamos o te lo enviamos?`;
  return { url: `https://wa.me/52${s.telefono.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(mensaje)}` };
}
