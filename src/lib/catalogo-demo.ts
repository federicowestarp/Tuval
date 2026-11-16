/**
 * Catálogo de DEMOSTRACIÓN. Sin precios ni SKU reales: se reemplaza por el
 * catálogo del proveedor (Emmsa) cuando tengamos su lista.
 */
export type Categoria = "tuberia" | "conexiones" | "valvulas" | "equipos" | "electrico" | "herramienta";

export const CATEGORIAS: { id: Categoria; nombre: string }[] = [
  { id: "tuberia", nombre: "Tubería" },
  { id: "conexiones", nombre: "Conexiones" },
  { id: "valvulas", nombre: "Válvulas" },
  { id: "equipos", nombre: "Equipos y bombas" },
  { id: "electrico", nombre: "Eléctrico" },
  { id: "herramienta", nombre: "Herramienta" },
];

export type ProductoDemo = {
  id: string;
  nombre: string;
  categoria: Categoria;
  atributos: Record<string, string>;
};

export const PRODUCTOS_DEMO: ProductoDemo[] = [
  { id: "demo-1", nombre: "Cople PVC hidráulico", categoria: "conexiones", atributos: { Medida: '1/2"', Material: "PVC" } },
  { id: "demo-2", nombre: "Válvula de esfera", categoria: "valvulas", atributos: { Medida: '3/4"' } },
  { id: "demo-3", nombre: "Tubería PPR", categoria: "tuberia", atributos: { Medida: '1"', Tramo: "4 m", Material: "PPR" } },
  { id: "demo-4", nombre: "Codo 90° PVC hidráulico", categoria: "conexiones", atributos: { Medida: '1/2"', Material: "PVC" } },
  { id: "demo-5", nombre: "Bomba periférica", categoria: "equipos", atributos: { Potencia: "[HP]", Voltaje: "127 V" } },
  { id: "demo-6", nombre: "Cable THW", categoria: "electrico", atributos: { Calibre: "[AWG]" } },
  { id: "demo-7", nombre: "Cinta para rosca", categoria: "herramienta", atributos: { Uso: "Agua fría y caliente" } },
  { id: "demo-8", nombre: "Tubo conduit", categoria: "electrico", atributos: { Medida: '1/2"' } },
];

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Búsqueda por nombre, categoría o atributo (p. ej. "cople 1/2"). */
export function buscar(q: string, categoria?: string): ProductoDemo[] {
  const terminos = normalizar(q).split(/\s+/).filter(Boolean);
  return PRODUCTOS_DEMO.filter((p) => {
    if (categoria && p.categoria !== categoria) return false;
    const texto = normalizar([p.nombre, p.categoria, ...Object.values(p.atributos)].join(" "));
    return terminos.every((t) => texto.includes(t));
  });
}
