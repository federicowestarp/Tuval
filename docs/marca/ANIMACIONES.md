# Tuval: animaciones para la app

> **Para Claude Code:** este archivo complementa `BRAND.md` y `APP.md`. La referencia visual funcionando está en `animaciones-referencia.html` (ábrela en el navegador). Principio: **minimalista, sencillo, fácil de usar**. La animación explica lo que pasa; nunca decora ni retrasa al usuario.

## Idea

El símbolo de Tuval es un **anillo de avance**: el corte de un tubo que se cierra hasta un punto cian. En la app, ese mismo anillo es el lenguaje de movimiento: **traza, gira, avanza y confirma**. No se usan otros spinners, barras ni íconos de carga.

## Geometría del anillo (SVG)

```html
<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
  <!-- anillo: arco de 285° que empieza a las 3 en punto y avanza en sentido horario -->
  <circle cx="32" cy="32" r="21" fill="none" stroke="#0B2E5C" stroke-width="11"
          stroke-linecap="round" stroke-dasharray="104.46 200"/>
  <!-- punto cian al final del arco -->
  <circle cx="37.44" cy="11.72" r="6.5" fill="#2BB3D9"/>
</svg>
```

- Radio 21, grosor 11, extremos redondos.
- Arco completo de marca: **285° = 104.46** de longitud (circunferencia 131.95).
- Para un avance `p` (0 a 1): `stroke-dasharray = 104.46 * p` y el punto se dibuja en `(53, 32)` dentro de un grupo con `rotate(285 * p, 32, 32)`.
- Sobre fondo azul: anillo blanco y punto cian. Sobre fondo claro: anillo azul y punto cian.

## Tokens de movimiento

| Token | Valor | Uso |
|---|---|---|
| `ease-out` | `cubic-bezier(.2,.8,.2,1)` | Casi todo: entradas y avances |
| `ease-linear` | `linear` | Solo el giro de carga |
| `dur-fast` | 250 ms | Palomitas, cambios de estado pequeños |
| `dur-base` | 600 ms | Avance de pedido, trazos en botones |
| `dur-slow` | 700 ms | Trazo del logo en el arranque |
| `spin` | 1.1 s por vuelta | Cargando |
| `pulse` | 1.8 s, escala 1 → 1.3 | Latido del punto |

## Animaciones

### 1. Aparición del logo (arranque de la app)
1. El anillo se traza de 0 a 104.46 en **700 ms** (`ease-out`).
2. El punto cian aparece (radio 0 → 6.5) en **300 ms**.
3. Las letras de «Tuval» entran una por una: opacidad 0 → 1 y 12 px hacia arriba, **400 ms** cada una, con 60 ms de diferencia.
4. Total aproximado: 1.3 s. Si la app ya cargó, se puede saltar al tocar.

### 2. Cargando
- El anillo de marca completo gira 360° cada **1.1 s**, lineal.
- Tamaños: 24 px en botones y listas, 48 px en pantallas completas.
- Si la carga dura menos de 300 ms, no se muestra.

### 3. Estatus del pedido
- Pasos: **Recibido (25 %) → Surtido (50 %) → En ruta (75 %) → Entregado (100 %)**.
- Al cambiar de paso, el anillo avanza de su valor actual al nuevo en **600 ms** (`ease-out`), con el punto girando junto con el extremo.
- Fondo del anillo en gris `#E3E1DC` para que se vea cuánto falta.
- En «Entregado» el anillo queda **idéntico al logo** (arco de 285° con su punto cian, que **nunca se quita**) y aparece una palomita azul al centro (**250–300 ms**). El pedido completo es la marca completa.
- Siempre acompañado del nombre del paso en texto: el estado nunca depende solo de la animación.
- Mismo componente en: detalle del pedido, lista de pedidos (24 px), notificación y pantalla de la sucursal.

### 4. Botón «Pedir»
- Al tocar: el texto cambia a «Enviando…» y un anillo blanco de 24 px se traza dentro del botón en **600 ms**.
- Al confirmar el servidor: aparece una palomita cian (**250 ms**) y el texto dice «¡Pedido!».
- Regresa al estado normal a los **2 s**.
- Si falla: el anillo se detiene, el botón vuelve a «Pedir ahora» y se muestra el error en texto. No sacudir ni usar rojo intermitente.

### 5. Latido del punto
- El punto cian escala 1 → 1.3 → 1 en **1.8 s**, en bucle.
- Solo en: pantalla de arranque mientras carga y notificación de «Tu pedido llegó». Nunca en más de un lugar a la vez.

### 6. Actualizar (jalar hacia abajo)
- En listas que se actualizan: pedidos, catálogo, existencias.
- Mientras el usuario jala, el anillo se dibuja **en proporción al jalón** (0 a 104.46), con el punto cian siguiendo el extremo.
- Al llegar al umbral y soltar: el anillo completo gira como en «Cargando» hasta que llegan los datos.
- Al terminar, la lista regresa a su lugar en **300 ms** (`ease-out`) y el anillo desaparece.
- Si se suelta antes del umbral, el anillo regresa a cero sin cargar.

## Reglas

- **Respetar «reducir movimiento»** del sistema (`prefers-reduced-motion` en web, `AccessibilityInfo.isReduceMotionEnabled` en React Native, `UIAccessibility.isReduceMotionEnabled` en iOS): mostrar el estado final sin animar.
- Máximo una animación protagonista por pantalla.
- Ninguna animación bloquea un toque: el usuario siempre puede seguir.
- Animar solo `transform`, `opacity` y `stroke-dasharray`, para que corra fluido en teléfonos de gama media.
- Etiquetar el anillo para lectores de pantalla («Pedido en ruta, 75 %»).

## Datos pendientes (no inventar)

Textos finales de notificaciones, sonidos (si los hay) y tiempos reales de cada paso del pedido.
