export type Categoria = "tuberia" | "conexiones" | "valvulas" | "equipos" | "electrico" | "herramienta";

export const CATEGORIAS: { id: Categoria; nombre: string }[] = [
  { id: "tuberia", nombre: "Tubería" },
  { id: "conexiones", nombre: "Conexiones" },
  { id: "valvulas", nombre: "Válvulas" },
  { id: "equipos", nombre: "Equipos y bombas" },
  { id: "electrico", nombre: "Eléctrico" },
  { id: "herramienta", nombre: "Herramienta" },
];

export const esCategoria = (v: unknown): v is Categoria => CATEGORIAS.some((c) => c.id === v);
