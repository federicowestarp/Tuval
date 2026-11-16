# Tuval: kit de marca para desarrollar la app (versión 2)

> **Para Claude Code / desarrolladores:** este archivo, `APP.md`, `tokens.json`, `tokens.css` y la carpeta `logos/` son la fuente de verdad de Tuval. Úsalos tal cual: no inventes colores, fuentes ni logos. El PDF `Manual_de_marca_Tuval.pdf` es la referencia visual completa. Los datos entre corchetes (`[PRECIO]`, `[HORA]`, etc.) no existen todavía: déjalos como campos configurables y no inventes valores.

## 0. Principio rector

**Minimalista, sencillo, fácil de entender y de usar.** Gran UI y UX por encima de todo. Referencias de estilo: Apple y Rivian. Ante la duda, quita elementos, agranda el texto importante y deja más espacio.

- Una idea y una acción principal por pantalla.
- El producto es el héroe: foto limpia sobre fondo claro.
- Un solo acento de color.
- Espacio generoso, esquinas suaves.

## 1. Qué es Tuval

Cadena mexicana que vende **tubería, conexiones, válvulas, equipos (bombas e hidráulicos) y material eléctrico básico**. Tres canales:

1. **Sucursales:** lo de mayor rotación disponible hoy. Lo demás se envía a domicilio u obra.
2. **Tuval Obra:** suministro a obra con bodega temporal dentro de la obra, inventario controlado y entregas programadas.
3. **tuval.mx:** tienda en línea con envíos a todo México.

Clientes: plomeros, instaladores, contratistas, constructoras, compras y mantenimiento, hoteles, clubes y empresas.

## 2. Eslogan e idea de marca

- **Eslogan:** «Tubería, equipos y eléctrico. Todo, a tiempo.» En títulos grandes, la segunda frase va en gris (`secondary`).
- **Alternos:** «Todo para instalar, a tiempo y a tu obra.» · «Tubería, equipos y eléctrico, directo a tu obra.»
- **Extras de campaña:** *Tuvalor* (Tuval = tu valor: ahorras y recibes a tiempo, tu obra gana valor) y «En Tuval, tú vales» (con acento; no usar «porque tú lo vales»).
- **Llamado a la acción:** «Pídelo en Tuval».
- **Lealtad:** **Club Tuval**.

## 3. Tono de voz

Técnico, confiable y ágil. Frases cortas. Tú al plomero; usted en documentos formales.

| Sí | No |
|---|---|
| «Tu pedido sale hoy antes de las [HORA].» | «¡¡Los mejores precios del universo!!» |
| «¿Te faltó una pieza? Te la mandamos hoy.» | «Estimado cliente, le informamos que…» (en la app) |

## 4. Color

| Token | HEX | Uso | Proporción |
|---|---|---|---|
| `white` | `#FFFFFF` | Fondo principal | 45% |
| `stone` (Piedra) | `#F4F2EE` | Fondo cálido de marca, héroes | 25% |
| `mist` (Niebla) | `#F5F5F7` | Tarjetas y superficies | 10% |
| `ink` (Tinta) | `#1D1D1F` | **Solo texto** | 10% |
| `secondary` | `#6E6E73` | Texto secundario | — |
| `primary` (Azul Tuval) | `#0B2E5C` | Logo, botón principal, acentos | 8% |
| `accent` (Cian flujo) | `#2BB3D9` | Punto del símbolo y estados | 2% |
| `onAccent` | `#071E3D` | Texto sobre cian | — |
| `border` | `#E3E1DC` | Bordes de 1 px | — |

**Reglas:**
- **Sin fondos negros.** El negro solo existe como color de texto.
- Texto sobre cian: siempre `onAccent`, nunca blanco.
- Los estados nunca se distinguen solo por color: siempre con texto o ícono.

## 5. Tipografía

Gratuitas (Google Fonts, licencia OFL).

| Uso | Fuente | Peso | Tamaño | Tracking |
|---|---|---|---|---|
| Hero | Inter Tight | 600 | 64–96 px (web), 32–40 px (app) | −4% |
| Título | Inter Tight | 600 | 32–48 px (web), 24–28 px (app) | −3% |
| Subtítulo | Inter Tight | 600 | 20–24 px | −2% |
| Precio | Inter Tight | 600 | 22–28 px | −2% |
| Texto | Inter | 400 / 500 | 16–17 px | 0 |
| Nota / SKU | Inter | 400 | 13 px | 0 |

## 6. Logo y símbolo

**Símbolo: anillo de avance.** El corte de un tubo (o cable) que se cierra hasta un punto cian: el pedido completo y a tiempo. Un trazo de grosor constante con extremos redondos; abertura siempre arriba a la derecha; punto siempre cian (salvo versión a una tinta).

Archivos en `logos/` (texto convertido a trazos, no requieren fuente):
- `tuval-horizontal-color.svg`: uso principal (símbolo azul + punto cian, nombre en tinta).
- `tuval-horizontal-azul.svg`: todo en azul.
- `tuval-horizontal-negativo.svg`: sobre azul.
- `tuval-horizontal-negro.svg`: una tinta.
- `tuval-vertical-color.svg`: espacios cuadrados.
- `tuval-icono-app.svg`: ícono de app y favicon (fondo azul, anillo blanco, punto cian).
- `tuval-simbolo-azul.svg`, `tuval-simbolo-blanco.svg`, `tuval-simbolo-negro.svg`.

**Reglas:** no deformar, rotar ni recolorear; área de respeto igual al alto del símbolo; mínimo 24 px de alto (debajo, solo el símbolo). Los primeros meses, el símbolo siempre acompañado del nombre.

**El símbolo también es interfaz:** el mismo anillo se usa como indicador de avance del pedido (ver `APP.md`).

## 7. Forma, espacio e iconos

- **Radios:** campos 12 px, tarjetas 20 px, paneles 28 px, botones y chips 999 px.
- **Espaciado:** múltiplos de 4 (4, 8, 12, 16, 24, 32, 48, 64, 96). Márgenes generosos.
- **Sombras:** ninguna o casi ninguna; prefiere borde de 1 px `border` o cambio de fondo.
- **Iconos:** de línea, trazo 2 px a 24 px, puntas redondeadas (por ejemplo Lucide). Categorías: Tubería, Conexiones, Válvulas, Equipos y bombas, Eléctrico, Herramienta.
- **Área táctil mínima:** 44 × 44 px.

## 8. Componentes base

- **Barra superior:** fondo blanco, logo horizontal a color, borde inferior de 1 px. Sin bloques de color.
- **Botón principal:** fondo `primary`, texto blanco, píldora. Uno solo por pantalla.
- **Botón secundario:** texto `primary` con «›», sin fondo.
- **Chip de estado:** «Disponible hoy» (fondo `accent`, texto `onAccent`), «En ruta», «Entrega programada» (borde `primary`).
- **Tarjeta de producto:** fondo `mist`, imagen sobre blanco, categoría en `secondary` 13 px, nombre Inter Tight 600, precio Inter Tight 600 grande y un solo chip.
- **Seguimiento de pedido:** anillo de avance + pasos «Recibido → Surtido → En ruta → Entregado», cada uno con texto.

## 9. Funcionalidad de la app

Ver **`APP.md`**: usuarios, 12 módulos por fase, conexión con la tienda física y decisiones pendientes.

## 10. Datos pendientes (no inventar)

Precios, SKU, inventario, sucursales y horarios, teléfonos y WhatsApp, zona y hora de corte de envío, métodos de pago, políticas de entrega, reglas de crédito y de Club Tuval.
