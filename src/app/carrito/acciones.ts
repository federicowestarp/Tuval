"use server";

import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { IVA, productosPorId } from "@/lib/catalogo";
import { calcularPromesa, ZONAS, type Zona } from "@/lib/corte";

export type EstadoFormulario = { error?: string; campos?: Record<string, string> };

const RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
const texto = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function crearPedido(_prev: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const campos = Object.fromEntries([...fd.entries()].filter(([k]) => k !== "lineas").map(([k, v]) => [k, String(v)]));
  const falla = (error: string): EstadoFormulario => ({ error, campos });

  // Carrito: solo se confía en id y cantidad; nombre y precio se leen de la base.
  let lineas: { id: string; cantidad: number }[];
  try {
    lineas = (JSON.parse(texto(fd, "lineas")) as { id: string; cantidad: number }[])
      .map((l) => ({ id: String(l.id), cantidad: Math.floor(Number(l.cantidad)) }))
      .filter((l) => /^[0-9a-f-]{36}$/i.test(l.id) && l.cantidad > 0 && l.cantidad <= 10000);
  } catch {
    return falla("No pudimos leer tu carrito. Recarga la página.");
  }
  if (lineas.length === 0) return falla("Tu carrito está vacío.");

  const nombre = texto(fd, "nombre");
  const telefono = texto(fd, "telefono").replace(/\D/g, "");
  const zona = texto(fd, "zona") as Zona;
  const tipoEntrega = texto(fd, "tipo_entrega");
  const direccion = texto(fd, "direccion");
  const comprobante = texto(fd, "comprobante");
  const sinRecepcion = fd.get("sin_recepcion") === "on";
  const notas = texto(fd, "notas");

  if (nombre.length < 3) return falla("Escribe tu nombre.");
  if (telefono.length !== 10) return falla("El teléfono debe tener 10 dígitos.");
  if (!ZONAS.some((z) => z.id === zona)) return falla("Elige la zona de entrega.");
  if (tipoEntrega !== "domicilio" && tipoEntrega !== "obra") return falla("Elige si es domicilio u obra.");
  if (direccion.length < 10) return falla("Escribe la dirección completa de entrega.");
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

  const productos = new Map((await productosPorId(lineas.map((l) => l.id))).map((p) => [p.id, p]));
  const partidas = lineas.filter((l) => productos.has(l.id));
  if (partidas.length === 0) return falla("Los productos de tu carrito ya no están disponibles.");

  const subtotal = partidas.reduce((s, l) => s + (productos.get(l.id)!.precio ?? 0) * l.cantidad, 0);
  const iva = Math.round(subtotal * IVA * 100) / 100;
  const promesa = calcularPromesa(zona);

  const pedidoId = await sql.begin(async (tx) => {
    const [cliente] = await tx<{ id: string }[]>`
      insert into clientes (tipo, nombre, rfc, razon_social, regimen_fiscal, codigo_postal_fiscal, uso_cfdi)
      values (${fiscal && fiscal.rfc.length === 12 ? "empresa" : "persona"}, ${nombre},
              ${fiscal?.rfc ?? null}, ${fiscal?.razon ?? null}, ${fiscal?.regimen ?? null}, ${fiscal?.cp ?? null}, ${fiscal?.uso ?? null})
      returning id`;
    const [pedido] = await tx<{ id: string }[]>`
      insert into pedidos (folio, canal, cliente_id, tipo_entrega, direccion_entrega, comprobante, zona,
                           entrega_fecha, entrega_ventana, contacto_nombre, contacto_telefono,
                           sin_recepcion_solicitada, notas, subtotal, iva, total)
      values ('TV-' || lpad(nextval('folio_pedido_seq')::text, 6, '0'), 'web', ${cliente.id}, ${tipoEntrega}, ${direccion},
              ${comprobante}, ${zona}, ${promesa.fecha}, ${promesa.ventana}, ${nombre}, ${telefono},
              ${sinRecepcion}, ${notas || null}, ${subtotal}, ${iva}, ${subtotal + iva})
      returning id`;
    for (const l of partidas) {
      await tx`
        insert into pedido_partidas (pedido_id, producto_id, cantidad, precio_unitario, costo_unitario)
        values (${pedido.id}, ${l.id}, ${l.cantidad}, ${productos.get(l.id)!.precio},
                (select min(costo) from productos_proveedor where producto_id = ${l.id}))`;
    }
    await tx`insert into pedido_eventos (pedido_id, estado, nota) values (${pedido.id}, 'recibido', 'Pedido en línea')`;
    return pedido.id;
  });

  redirect(`/pedido/${pedidoId}?nuevo=1`);
}
