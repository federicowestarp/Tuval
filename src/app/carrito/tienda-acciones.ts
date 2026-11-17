"use server";

import { randomInt } from "node:crypto";
import { sql } from "@/lib/db";
import { cuentaActual, obtenerOCrearCuenta } from "@/lib/sesion";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Sin letras/números que se confunden al dictarlos (0/O, 1/I).
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Cliente en la tienda: guarda su carrito y le da un código/QR para enseñarlo en caja. */
export async function carritoParaCaja(lineas: { id: string; cantidad: number }[], telefono?: string): Promise<{ codigo?: string; error?: string }> {
  const validas = (lineas ?? []).filter((l) => UUID.test(l.id) && Number(l.cantidad) > 0).slice(0, 100)
    .map((l) => ({ id: l.id, cantidad: Math.min(Number(l.cantidad), 9999) }));
  if (validas.length === 0) return { error: "Tu carrito no tiene productos del catálogo." };
  const tel = String(telefono ?? "").replace(/\D/g, "").slice(-10);
  if (telefono && tel.length !== 10) return { error: "Escribe tu celular a 10 dígitos." };
  // Con celular: se guarda en su cuenta (se confirma en persona en caja y ahí queda dado de alta con sus puntos).
  const cuenta = tel ? await obtenerOCrearCuenta() : await cuentaActual();
  if (cuenta && tel) await sql`update cuentas set telefono = ${tel}, telefono_verificado_en = case when telefono = ${tel} then telefono_verificado_en end where id = ${cuenta.id}`;
  for (let intento = 0; intento < 5; intento++) {
    const codigo = Array.from({ length: 6 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
    const [r] = await sql<{ codigo: string }[]>`
      insert into carritos_tienda (codigo, lineas, cuenta_id) values (${codigo}, ${sql.json(validas)}, ${cuenta?.id ?? null})
      on conflict (codigo) do nothing returning codigo`;
    if (r) return { codigo: r.codigo };
  }
  return { error: "No se pudo generar el código, intenta de nuevo." };
}
