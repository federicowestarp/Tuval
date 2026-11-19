/**
 * Recorrido de tienda: lista corta que alguien del equipo revisa cada cierto tiempo (parámetro recorrido_cada_min).
 * Los puntos son una propuesta inicial; se ajustan aquí.
 */
export const PUNTOS_RECORRIDO = [
  { id: "anaqueles", titulo: "Anaqueles", detalle: "Piezas en su lugar y al frente, sin huecos. Si falta algo, anótalo para resurtir." },
  { id: "etiquetas", titulo: "Etiquetas de precio", detalle: "Visibles, en su lugar y sin daños." },
  { id: "pasillos", titulo: "Pasillos y piso", detalle: "Libres de cajas o tramos atravesados, limpios y sin riesgos." },
  { id: "caja", titulo: "Caja y mostrador", detalle: "Ordenados; bolsas y papel de ticket abastecidos." },
  { id: "exhibicion", titulo: "Exhibición y mesas", detalle: "Equipos de muestra completos y mesas de atención limpias." },
  { id: "valor", titulo: "Piezas chicas de valor", detalle: "Las que están junto a caja, completas y a la vista." },
  { id: "bano", titulo: "Baño", detalle: "Limpio, con papel y jabón." },
  { id: "tablets", titulo: "Tablets y quiosco", detalle: "Con carga y en la pantalla del buscador." },
  { id: "clientes", titulo: "Clientes", detalle: "Saluda a quien esté buscando y ofrece ayuda o el buscador “¿Dónde está?”." },
] as const;

export type PuntoRegistrado = { id: string; ok: boolean; nota?: string };
