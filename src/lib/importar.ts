import type { Categoria } from "@/lib/categorias";

/**
 * Normaliza un renglón de catálogo (CSV de PurAqua, Emmsa u hoja propia) al formato de Tuval.
 * Acepta encabezados en español o los de PurAqua (sku, name, category, unit, cost, stock…).
 */
export type ProductoImportado = {
  sku: string;
  nombre: string;
  categoria: Categoria | "por_clasificar";
  unidad: string;
  marca: string | null;
  proveedor: string | null;
  costo: number | null;
  precio: number | null;
  existencia: number | null;
  satClave: string | null;
  satUnidad: string | null;
  atributos: Record<string, string>;
};

const num = (s?: string) => {
  if (!s) return null;
  const n = Number(s.replace(/[$\s]/g, "").replace(/,(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Por palabras del nombre primero (más preciso), luego por la categoría de origen. */
export function categoriaTuval(nombre: string, categoriaOrigen = ""): ProductoImportado["categoria"] {
  const n = ` ${sinAcentos(nombre)} `;
  if (/\bvalv|\bcheck\b|\bllave de paso|\bcompuerta/.test(n)) return "valvulas";
  if (/\b(tubo|tuberia|tramo)\b/.test(n) && !/\bconduit\b/.test(n)) return "tuberia";
  if (/\b(cable|contacto|apagador|breaker|interruptor|centro de carga|conduit|clavija|foco|reflector|lampara|luminaria|transformador|arrancador|contactor|timer|termomagnetic)/.test(n)) return "electrico";
  if (/\b(codo|cople|tee|te|reduccion|reductor|adaptador|tapon|tapa|brida|tuerca|niple|union|bushing|conector|abrazadera|yee)\b/.test(n)) return "conexiones";
  if (/\b(bomba|motor|filtro|calentador|clorador|hidroneumatico|tinaco|cisterna|presurizador|robot|aspiradora)\b/.test(n)) return "equipos";
  if (/\b(cinta|pegamento|cemento|limpiador|llave|pinza|cortador|segueta|teflon|sellador)\b/.test(n)) return "herramienta";
  const c = sinAcentos(categoriaOrigen);
  if (/tuberia|conexion/.test(c)) return "conexiones";
  if (/bombeo|filtracion|calefaccion|limpieza|automatizacion|refaccion|equipo/.test(c)) return "equipos";
  if (/iluminacion|electric/.test(c)) return "electrico";
  if (/valvul/.test(c)) return "valvulas";
  if (/herramient/.test(c)) return "herramienta";
  return "por_clasificar";
}

export function normalizarRenglon(r: Record<string, string>): ProductoImportado | null {
  const g = (...k: string[]) => k.map((x) => r[x]).find((v) => v != null && v !== "") ?? "";
  const nombre = g("nombre", "name", "descripcion", "producto");
  if (nombre.length < 2) return null;
  const sku = (g("sku", "codigo", "code", "clave") || nombre).toUpperCase().replace(/\s+/g, "-").replace(/[^A-Z0-9-]/g, "").slice(0, 40);
  const unidadOrigen = sinAcentos(g("unidad", "unit") || "pieza");
  const unidad = /^(m|mt|mts|mto|metro)/.test(unidadOrigen) ? "metro" : /tramo/.test(unidadOrigen) ? "tramo" : /rollo/.test(unidadOrigen) ? "rollo" : /^(kg|kilo)/.test(unidadOrigen) ? "kg" : /^(l|lt|litro)/.test(unidadOrigen) ? "litro" : "pieza";
  const marca = g("marca", "brand") || null;
  const modelo = g("modelo", "model");
  const atributos: Record<string, string> = {};
  if (marca) atributos.Marca = marca;
  if (modelo) atributos.Modelo = modelo;
  const precio = num(g("precio", "price", "precio_venta"));
  return {
    sku: sku || `SIN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    nombre: nombre.slice(0, 200),
    categoria: categoriaTuval(nombre, g("categoria", "category")),
    unidad,
    marca,
    proveedor: g("proveedor", "supplier") || null,
    costo: num(g("costo", "cost")),
    precio: precio != null && precio > 0 ? precio : null,
    existencia: num(g("existencia", "stock", "inventario")),
    satClave: /^\d{8}$/.test(g("sat_clave", "sat_product_code")) ? g("sat_clave", "sat_product_code") : null,
    satUnidad: /^[A-Z0-9]{2,3}$/.test(g("sat_unidad", "sat_unit_code")) ? g("sat_unidad", "sat_unit_code") : null,
    atributos,
  };
}
