import { createHash } from "node:crypto";
import { sql } from "@/lib/db";
import { usuarioInterno } from "@/lib/equipo";
import { cuentaActual } from "@/lib/sesion";

/**
 * Qué guardar en el teléfono para usar la app sin señal, según quién eres.
 * `dueno` cambia cuando cambia la sesión: si otra persona entra en el mismo equipo, se borra lo guardado del anterior.
 */
const PUBLICAS = ["/", "/tienda", "/carrito", "/lista", "/donde", "/sin-conexion"];
const POR_ROL: Record<string, string[]> = {
  chofer: ["/interno/chofer"],
  mostrador: ["/interno/mostrador", "/interno/vender", "/interno/recorrido", "/interno/chequeo", "/interno/surtido", "/interno/plano", "/interno/inventario", "/interno/inventario-fisico"],
  supervisor: ["/interno/caja", "/interno/mostrador", "/interno/vender", "/interno/recorrido", "/interno/chequeo", "/interno/surtido", "/interno/plano", "/interno/inventario", "/interno/inventario-fisico"],
  operador: ["/interno/pedidos", "/interno/demanda", "/interno/rutas", "/interno/inventario", "/interno/inventario-fisico", "/interno/surtido", "/interno/plano", "/interno/mostrador"],
  admin: ["/interno/tablero", "/interno/pedidos", "/interno/demanda", "/interno/rutas", "/interno/inventario", "/interno/inventario-fisico", "/interno/caja", "/interno/recorrido"],
};

export async function GET() {
  const [yo, cuenta] = await Promise.all([usuarioInterno(), cuentaActual()]);
  const urls = [...PUBLICAS];
  if (cuenta) {
    urls.push("/cuenta", "/cuenta/pedidos");
    const activos = await sql<{ id: string }[]>`
      select id from pedidos where cuenta_id = ${cuenta.id} and estado not in ('entregado', 'entregado_con_faltantes', 'cancelado')
      order by creado_en desc limit 10`;
    urls.push(...activos.map((p) => `/pedido/${p.id}`));
  }
  if (yo) {
    urls.push(...(POR_ROL[yo.rol] ?? []));
    if (yo.rol === "operador" || yo.rol === "admin") {
      const abiertos = await sql<{ id: string }[]>`
        select id from pedidos where estado not in ('entregado', 'entregado_con_faltantes', 'cancelado') order by creado_en desc limit 15`;
      urls.push(...abiertos.map((p) => `/interno/pedidos/${p.id}`));
    }
  }
  const dueno = createHash("sha256").update(`${yo?.id ?? "-"}|${cuenta?.id ?? "-"}`).digest("hex").slice(0, 16);
  return Response.json(
    { dueno, usuario: yo ? { id: yo.id, rol: yo.rol } : null, urls: [...new Set(urls)] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
