# Tuval: ideas para la app

> **Para Claude Code:** lee primero `BRAND.md` (identidad visual y tono). Principio rector: **minimalista, sencillo, fácil de entender y usar; gran UI y UX** (referencias: Apple y Rivian). Este archivo describe **qué** debe hacer la app. Es una propuesta del dueño del negocio para arrancar: el alcance final lo decide él. Los datos entre corchetes (`[HORA]`, `[PRECIO]`, etc.) no existen todavía; déjalos configurables y no inventes valores.

## Principio

Una sola app y un solo inventario para los tres canales (sucursal, Tuval Obra, en línea). Lo que el cliente ve en la app es lo mismo que ve en la tienda, en el kiosco y en WhatsApp.

## Usuarios

| Usuario | Qué necesita |
|---|---|
| Plomero e instalador | Rapidez: buscar, pedir por WhatsApp, recoger sin fila y sumar puntos en Club Tuval. |
| Contratista y compras | Control: cotizaciones, autorizaciones, crédito, factura y entregas a obra. |
| Equipo Tuval (interno) | Orden: surtir, rutear y saber qué hay en cada sucursal y obra. |

## Módulos

F1 = lanzamiento (MVP). F2 = segunda etapa.

| # | Módulo | Qué hace | Fase |
|---|---|---|---|
| 1 | Catálogo y búsqueda | Por producto, medida, material, SKU o escaneando el QR del anaquel. Filtros técnicos (diámetro, cédula, presión, voltaje). | F1 |
| 2 | Disponibilidad y pasillo infinito | Existencia por sucursal y CEDIS. Lo que no está en tienda se pide igual con envío. | F1 |
| 3 | Entrega a elegir | Recoger en mostrador o locker con código, a domicilio o a obra. Hora de corte del envío del día: `[HORA]`. | F1 |
| 4 | WhatsApp conectado | El pedido por WhatsApp entra al mismo carrito y al mismo seguimiento. | F1 |
| 5 | Seguimiento en vivo | Anillo de avance (el símbolo de la marca) + Recibido → Surtido → En ruta → Entregado. Alimenta también la pantalla de estatus en tienda. | F1 |
| 6 | Repetir pedido y listas | Repetir con un toque; listas guardadas por obra o por tipo de instalación. | F1 |
| 7 | Cotización y factura | Cotización formal en PDF, conversión a pedido y CFDI. | F1 |
| 8 | Cuenta empresa (B2B) | Varios usuarios con roles (comprador, residente, autoriza), límites, órdenes de compra, crédito y estado de cuenta. | F1–F2 |
| 9 | Tuval Obra | Inventario de la bodega en obra, vales de salida por residente, reposición por mínimo, entregas programadas y consumo por partida. | F2 |
| 10 | Club Tuval | Puntos por compra, niveles y beneficios; referidos y perfil de técnico verificado. Reglas: `[POR DEFINIR]`. | F2 |
| 11 | Herramientas técnicas | Selector de bomba, calculadora de materiales y kits armados («Baño completo», «Tinaco y bomba») con fichas y videos. | F2 |
| 12 | App interna | Surtido con escáner y códigos de ubicación (formato `P2-A3-04`: pasillo-anaquel-posición), conteos de inventario, rutas y prueba de entrega con foto y firma. | F1 |

## Conexión con la tienda física

- Cada anaquel y producto lleva un **QR** que abre su ficha en la app con el precio vigente.
- Cada producto tiene un **código de ubicación** visible en la etiqueta, la app interna y el kiosco.
- El **kiosco** de pasillo infinito es la misma app en modo tienda.
- En fase 2, las etiquetas electrónicas de precio (ESL) pueden encender un LED para ubicar productos; deja el campo de ubicación preparado para eso.

## Recomendación de arranque

Montar el MVP sobre una plataforma de e-commerce existente con funciones B2B, conectada al ERP y a WhatsApp Business API. Desarrollar a la medida solo lo que diferencia: Tuval Obra, el cotizador y Club Tuval.

**Trade-off:** sale mucho más rápido y con menos inversión inicial, pero depende de las reglas y comisiones de la plataforma. Hay que elegir una con API abierta para no quedar atrapado.

## Decisiones pendientes (no inventar)

ERP · plataforma de e-commerce · pasarela de pago · reparto propio o de terceros · zonas y hora de corte · reglas de crédito · reglas de Club Tuval · precios, SKU, sucursales y horarios.
