/**
 * Reglas de corte (docs/ESPECIFICACION.md §3). Zona horaria: America/Mexico_City.
 * Solo se promete día y ventana (mañana/tarde); las horas exactas se publican
 * cuando midamos el horario del chofer.
 *
 *  Puebla   L–V: hasta 8:00 → hoy mañana · 8:00–12:00 → hoy tarde · después → siguiente día hábil mañana
 *           Sáb: hasta 10:00 → hoy · después → siguiente día hábil mañana
 *  Atlixco / Tlaxcala: hasta 17:00 (sábado 12:00, Emmsa cierra 13:00) → siguiente día hábil mañana
 *           (Emmsa confirma existencias la tarde anterior)
 *           después de 17:00 → el día hábil posterior
 *  Domingo no hay entregas. Días hábiles de entrega: lunes a sábado.
 */
export type Zona = "puebla" | "atlixco" | "tlaxcala" | "otro";
export type Ventana = "manana" | "tarde";
export type Promesa = { fecha: string; ventana: Ventana };

export const ZONAS: { id: Zona; nombre: string }[] = [
  { id: "puebla", nombre: "Ciudad de Puebla" },
  { id: "atlixco", nombre: "Atlixco" },
  { id: "tlaxcala", nombre: "Tlaxcala" },
  { id: "otro", nombre: "Otro lugar" },
];

export const ESTADOS = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua", "Ciudad de México",
  "Coahuila", "Colima", "Durango", "Estado de México", "Guanajuato", "Guerrero", "Hidalgo", "Jalisco", "Michoacán",
  "Morelos", "Nayarit", "Nuevo León", "Oaxaca", "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa",
  "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas",
] as const;

/**
 * Zonas con entrega propia y hora de corte. Todo lo demás = "otro": se cotiza fecha y costo de envío.
 * Municipios de la zona metropolitana de Puebla incluidos: SUPUESTO por validar con Fede.
 */
const MUNICIPIOS_PUEBLA = ["puebla", "san andres cholula", "san pedro cholula", "cuautlancingo"];
const sinAcentos = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function zonaDe(entidad: string, municipio: string): Zona {
  const e = sinAcentos(entidad), m = sinAcentos(municipio).replace(/^(heroica )?(puebla de zaragoza)$/, "puebla");
  if (e === "puebla" && MUNICIPIOS_PUEBLA.includes(m)) return "puebla";
  if (e === "puebla" && m === "atlixco") return "atlixco";
  if (e === "tlaxcala" && (m === "tlaxcala" || m === "tlaxcala de xicohtencatl")) return "tlaxcala";
  return "otro";
}

const TZ = "America/Mexico_City";

/** Fecha y hora local de México a partir de un instante. */
function local(ahora: Date) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
    }).formatToParts(ahora).map((p) => [p.type, p.value]),
  );
  const fecha = `${partes.year}-${partes.month}-${partes.day}`;
  const minutos = Number(partes.hour) * 60 + Number(partes.minute);
  return { fecha, minutos };
}

function sumarDias(fecha: string, n: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const diaSemana = (fecha: string) => new Date(`${fecha}T12:00:00Z`).getUTCDay(); // 0 = domingo

function siguienteHabil(fecha: string): string {
  let f = sumarDias(fecha, 1);
  while (diaSemana(f) === 0) f = sumarDias(f, 1);
  return f;
}

/** null = fuera de las zonas con entrega propia: fecha y costo se confirman al cotizar. */
export function calcularPromesa(zona: Zona, ahora: Date = new Date()): Promesa | null {
  if (zona === "otro") return null;
  const { fecha, minutos } = local(ahora);
  const dia = diaSemana(fecha);

  if (zona === "puebla") {
    if (dia === 0) return { fecha: siguienteHabil(fecha), ventana: "manana" };
    if (dia === 6) {
      return minutos < 10 * 60 ? { fecha, ventana: "manana" } : { fecha: siguienteHabil(fecha), ventana: "manana" };
    }
    if (minutos < 8 * 60) return { fecha, ventana: "manana" };
    if (minutos < 12 * 60) return { fecha, ventana: "tarde" };
    return { fecha: siguienteHabil(fecha), ventana: "manana" };
  }

  // Foráneas
  const corteForaneo = dia === 6 ? 12 * 60 : 17 * 60;
  const base = dia !== 0 && minutos < corteForaneo ? fecha : siguienteHabil(fecha);
  return { fecha: siguienteHabil(base), ventana: "manana" };
}

export function describirPromesa(p: { fecha: string; ventana: Ventana }, hoy: string = local(new Date()).fecha): string {
  const ventana = p.ventana === "manana" ? "por la mañana" : "por la tarde";
  if (p.fecha === hoy) return `Llega hoy ${ventana}`;
  if (p.fecha === sumarDias(hoy, 1)) return `Llega mañana ${ventana}`;
  const texto = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(`${p.fecha}T12:00:00Z`));
  return `Llega el ${texto} ${ventana}`;
}
