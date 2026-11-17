import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { interpretarLinea } from "@/lib/lista";

/**
 * Convierte una lista dictada o escrita como la dice el cliente ("tres coples de media", "una pichancha de una
 * pulgada", "cable del 12, un rollo") en renglones con cantidad y términos de búsqueda en lenguaje de catálogo.
 * La IA solo normaliza el texto (pocos tokens); la búsqueda en el catálogo la hace la app.
 * Sin ANTHROPIC_API_KEY usa el intérprete local de listas.
 */
export const RenglonLista = z.object({
  cantidad: z.number().describe("Cantidad pedida; 1 si no se dijo"),
  unidad: z.string().nullable().describe("pieza, tramo, metro, rollo, kg… o null"),
  dicho: z.string().describe("Lo que dijo el cliente para este renglón, tal cual"),
  descripcion: z.string().describe("Nombre técnico normalizado del producto, con medida y material si se mencionan"),
  busqueda: z.array(z.string()).describe("2 a 4 variantes cortas de búsqueda, de la más específica a la más general"),
});
export type RenglonLista = z.infer<typeof RenglonLista>;
const Salida = z.object({ renglones: z.array(RenglonLista) });

const SISTEMA = `Eres el mostrador de Tuval, distribuidora de tubería, conexiones, válvulas, bombas, equipos de alberca y material eléctrico en México.
Recibes la lista que dicta o escribe un cliente (plomero, electricista, constructora) y la conviertes en renglones.
Reglas:
- Un renglón por producto. Cantidad en número ("un par" = 2, "media docena" = 6). Si no hay cantidad, 1.
- Medidas en pulgadas como en catálogo: "media" = 1/2, "tres cuartos" = 3/4, "una pulgada" = 1, "pulgada y media" = 1 1/2, "dos" = 2.
- Traduce términos de obra al nombre técnico: cople = cople/copla; pichancha = válvula de pie; llave de paso = válvula de paso/bola;
  tuerca unión = tuerca unión; bushing / reducción = reducción bushing; niple; codo de 90 / de 45; tee / te; tapón; adaptador macho/hembra;
  chalupa = caja de conexiones; mufa; apagador; contacto; cable del 12 = cable THW calibre 12; poliducto; tinaco; flotador; teflón = cinta teflón;
  pegamento = cemento/adhesivo PVC; tubo hidráulico = tubo PVC hidráulico; cédula 40/80; CPVC; galvanizado; cobre.
- "busqueda": variantes cortas para buscar en el catálogo (sin artículos ni cantidades), de específica a general. Ej.: ["cople pvc 1/2", "cople 1/2", "cople"].
- No inventes productos que el cliente no pidió. Ignora saludos y relleno.`;

let cliente: Anthropic | null = null;

export async function normalizarLista(texto: string): Promise<{ renglones: RenglonLista[]; conIA: boolean }> {
  const limpio = texto.trim().slice(0, 4000);
  if (!limpio) return { renglones: [], conIA: false };
  if (!process.env.ANTHROPIC_API_KEY) return { renglones: local(limpio), conIA: false };
  try {
    cliente ??= new Anthropic();
    // Si el modelo declina por política, el servidor reintenta solo con el modelo de respaldo (fallbacks "default").
    const r = await cliente.beta.messages.parse({
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(Salida) },
      system: [{ type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: limpio }],
    });
    if (r.stop_reason === "refusal" || !r.parsed_output) return { renglones: local(limpio), conIA: false };
    return { renglones: r.parsed_output.renglones.filter((x) => x.descripcion.trim()), conIA: true };
  } catch (e) {
    if (e instanceof Anthropic.APIError) console.error(`Claude ${e.status}: ${e.message}`);
    else console.error(e);
    return { renglones: local(limpio), conIA: false };
  }
}

/** Respaldo sin IA: separa por renglones o comas y usa el intérprete de listas de la tienda. */
function local(texto: string): RenglonLista[] {
  return texto.split(/\n|,|;| y (?=\d|un |una |dos |tres )/i).map((s) => s.trim()).filter(Boolean).flatMap((s) => {
    const l = interpretarLinea(s);
    return l ? [{ cantidad: l.cantidad, unidad: null, dicho: s, descripcion: l.descripcion, busqueda: [l.descripcion] }] : [];
  });
}
