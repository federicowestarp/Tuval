"use server";

import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { IVA, productosPorId } from "@/lib/catalogo";
import { calcularPromesa } from "@/lib/corte";
import { obtenerOCrearCuenta, tokenAleatorio } from "@/lib/sesion";
import type { Direccion } from "@/lib/direcciones";

export type EstadoFormulario = { error?: string; campos?: Record<string, string> };

const RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function json<T>(fd: FormData, k: string): T[] {
  try {
    const v = JSON.parse(texto(fd, k) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export async function crearPedido(_prev: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const campos = Object.fromEntries(
    [...fd.entries()].filter(([k]) => !["lineas", "especiales", "adjuntos"].includes(k)).map(([k, v]) => [k, String(v)]),
  );
  const falla = (error: string): EstadoFormulario => ({ error, campos });

  // Del carrito solo se confía en ids y cantidades; nombre y precio se leen de la base.
  const lineas = json<{ id: string; cantidad: number }>(fd, "lineas")
    .map((l) => ({ id: String(l.id), cantidad: Math.floor(Number(l.cantidad)) }))
    .filter((l) => UUID.test(l.id) && l.cantidad > 0 && l.cantidad <= 10000);
  const especiales = json<{ descripcion: string; cantidad: number }>(fd, "especiales")
    .map((e) => ({ descripcion: String(e.descripcion).trim().slice(0, 300), cantidad: Math.floor(Number(e.cantidad)) }))
    .filter((e) => e.descripcion.length > 1 && e.cantidad > 0 && e.cantidad <= 10000)
    .slice(0, 100);
  const adjuntos = json<string>(fd, "adjuntos").map(String).filter((id) => UUID.test(id)).slice(0, 10);

  if (lineas.length + especiales.length + adjuntos.length === 0) return falla("Tu carrito está vacío.");

  const nombre = texto(fd, "nombre");
  const telefono = texto(fd, "telefono").replace(/\D/g, "");
  const modo = texto(fd, "modo");
  const comprobante = texto(fd, "comprobante");
  if (nombre.length < 3) return falla("Escribe tu nombre.");
  if (telefono.length !== 10) return falla("Tu celular debe tener 10 dígitos.");
  if (modo === "recoger") {
    const [s] = await sql`select 1 from almacenes where tipo = 'sucursal' and activo limit 1`;
    if (!s) return falla("Todavía no tenemos sucursal para recoger. Elige envío.");
  } else if (modo !== "envio") return falla("Elige envío o recoger.");
  if (comprobante !== "factura" && comprobante !== "nota") return falla("Elige factura o nota.");

  let fiscal: { rfc: string; razon: string; regimen: string; cp: string; uso: string } | null = null;
  if (comprobante === "factura") {
    fiscal = {
      rfc: texto(fd, "rfc").toUpperCase(),
      razon: texto(fd, "razon_social"),
      regimen: texto(fd, "regimen_fiscal"),
      cp: texto(fd, "cp_fiscal"),
      uso: texto(fd, "uso_cfdi"),
    };
    if (!RFC.test(fiscal.rfc)) return falla("Revisa el RFC.");
    if (fiscal.razon.length < 3) return falla("Escribe la razón social tal como aparece en tu constancia.");
    if (!/^\d{5}$/.test(fiscal.cp)) return falla("El código postal fiscal debe tener 5 dígitos.");
    if (!fiscal.regimen || !fiscal.uso) return falla("Elige régimen fiscal y uso del CFDI.");
  }

  const cuenta = await obtenerOCrearCuenta();

  let dir: Direccion | null = null;
  if (modo === "envio") {
    const id = texto(fd, "direccion_id");
    if (!UUID.test(id)) return falla("Elige o agrega la dirección de entrega.");
    [dir] = await sql<Direccion[]>`
      select * from direcciones where id = ${id} and cuenta_id = ${cuenta.id} and activa`;
    if (!dir) return falla("Elige o agrega la dirección de entrega.");
  }

  const productos = new Map((await productosPorId(lineas.map((l) => l.id))).map((p) => [p.id, p]));
  const partidas = lineas.filter((l) => productos.has(l.id));
  const subtotal = partidas.reduce((s, l) => s + (productos.get(l.id)!.precio ?? 0) * l.cantidad, 0);
  const iva = Math.round(subtotal * IVA * 100) / 100;
  const promesa = dir ? calcularPromesa(dir.zona) : null;

  const pedidoId = await sql.begin(async (tx) => {
    await tx`update cuentas set nombre = ${nombre}, telefono = ${telefono} where id = ${cuenta.id}`;
    const [cliente] = await tx<{ id: string }[]>`
      insert into clientes (tipo, nombre, rfc, razon_social, regimen_fiscal, codigo_postal_fiscal, uso_cfdi)
      values (${fiscal && fiscal.rfc.length === 12 ? "empresa" : "persona"}, ${nombre},
              ${fiscal?.rfc ?? null}, ${fiscal?.razon ?? null}, ${fiscal?.regimen ?? null}, ${fiscal?.cp ?? null}, ${fiscal?.uso ?? null})
      returning id`;
    const tipoEntrega = !dir ? "recoger" : dir.tipo === "obra" ? "obra" : "domicilio";
    const [pedido] = await tx<{ id: string }[]>`
      insert into pedidos (folio, canal, cliente_id, cuenta_id, tipo_entrega, direccion_id, direccion_entrega, zona, entidad, lat, lng,
                           foto_fachada_id, recibe_nombre, recibe_telefono, preferencia_contacto, comprobante,
                           entrega_fecha, entrega_ventana, contacto_nombre, contacto_telefono,
                           sin_recepcion_solicitada, notas, subtotal, iva, total, token_receptor)
      values ('TV-' || lpad(nextval('folio_pedido_seq')::text, 6, '0'), 'web', ${cliente.id}, ${cuenta.id}, ${tipoEntrega},
              ${dir?.id ?? null}, ${dir ? [dir.direccion, [dir.municipio, dir.entidad].filter(Boolean).join(", "), dir.indicaciones].filter(Boolean).join(" · ") : null},
              ${dir?.zona ?? null}, ${dir?.entidad ?? null}, ${dir?.lat ?? null}, ${dir?.lng ?? null}, ${dir?.foto_archivo_id ?? null},
              ${dir?.recibe_nombre ?? nombre}, ${dir?.recibe_telefono ?? telefono}, ${dir?.preferencia_contacto ?? "whatsapp"},
              ${comprobante}, ${promesa?.fecha ?? null}, ${promesa?.ventana ?? null}, ${nombre}, ${telefono},
              ${!!dir && dir.tipo === "obra" && dir.permite_sin_recepcion}, ${texto(fd, "notas") || null},
              ${subtotal}, ${iva}, ${subtotal + iva}, ${tokenAleatorio()})
      returning id`;
    for (const l of partidas) {
      await tx`
        insert into pedido_partidas (pedido_id, producto_id, cantidad, precio_unitario, costo_unitario)
        values (${pedido.id}, ${l.id}, ${l.cantidad}, ${productos.get(l.id)!.precio},
                (select min(costo) from productos_proveedor where producto_id = ${l.id}))`;
    }
    for (const e of especiales) {
      await tx`
        insert into solicitudes_producto (descripcion, cantidad, origen, cuenta_id, pedido_id)
        values (${e.descripcion}, ${e.cantidad}, 'cliente_fuera_catalogo', ${cuenta.id}, ${pedido.id})`;
    }
    for (const a of adjuntos) {
      await tx`
        insert into pedido_archivos (pedido_id, archivo_id, descripcion)
        select ${pedido.id}, id, 'Lista del cliente' from archivos where id = ${a} and cuenta_id = ${cuenta.id}`;
    }
    await tx`insert into pedido_eventos (pedido_id, estado, nota) values (${pedido.id}, 'recibido', 'Pedido en línea')`;
    return pedido.id;
  });

  redirect(`/pedido/${pedidoId}?nuevo=1`);
}
