# Tuval · Especificación de la app (v0.1)

Documento vivo. Distingue **decisión** (tomada por Fede), **recomendación** (propuesta, por validar) y **pendiente** (falta un dato; no se inventa).

## 1. Decisiones tomadas

| # | Decisión | Fecha |
|---|---|---|
| D1 | Una sola app y un solo inventario para todos los canales. No se usa plataforma de e-commerce aparte. | nov 2026 |
| D2 | Arranque: **venta en línea**, surtiendo a los clientes directo desde **Emmsa** (proveedor). Se acepta tardar más en surtir para validar la idea antes de tener inventario propio. | nov 2026 |
| D3 | Tuval Obra: el material en la bodega de obra es **de Tuval** y **solo se cobra lo que se retira** (consignación). Idea a desarrollar. | nov 2026 |
| D4 | Entregas locales con **chofer propio**; tercero solo si el volumen lo exige. | nov 2026 |
| D5 | Catálogo inicial estimado: **~1,500 productos**. | nov 2026 |
| D6 | Ciudad inicial: **Puebla**. | nov 2026 |
| D7 | Desarrollo: Fede + Claude. | nov 2026 |
| D8 | **PurAqua** es el cliente principal inicial. | nov 2026 |
| D9 | Identidad visual: Manual de marca Tuval v1 (colores, Space Grotesk + Inter, sellos, íconos). | nov 2026 |
| D10 | Emmsa: distribuidor mayorista, crédito a 30 días, horario L–V 8:00–18:00 y S 9:00–13:00, mucho inventario de entrega inmediata. Se le pedirá compartir existencias. | nov 2026 |
| D11 | Zonas de entrega: ciudad de Puebla, Atlixco y Tlaxcala. | nov 2026 |
| D12 | Señal de potencial: ~2 pedidos diarios (ver métrica en §3). | nov 2026 |
| D14 | Emmsa tiene dos almacenes: **Bodega ciudad** (C. 25 Sur 1902 B, Sta Cruz los Ángeles, 72400 Puebla · 222 295 9451) y **Corredor Industrial La Ciénega** (Calle L 7b, 72225 Puebla · 222 141 9800), que respalda lo que no haya en la de ciudad. Preparan un pedido en ~20–30 min según tamaño (estimado de Fede). Tienen servicio a domicilio: opción para pedidos grandes. | nov 2026 |
| D15 | Foráneas (Atlixco, Tlaxcala): pedidos hasta las **17:00**; se confirman existencias con Emmsa esa tarde y salen en la ruta de la mañana siguiente. | nov 2026 |
| D16 | El cliente **no ve** "comprado a proveedor": ve **"Preparando pedido"**. El estado de compra es solo interno. | nov 2026 |
| D13 | Tuval Obra: **bodeguero de Tuval en sitio** entrega a personas autorizadas; retiro por pedido confirmado en la app o con **QR personal** dentro de un límite autorizado. | nov 2026 |

## 2. Riesgos que hay que vigilar

1. **Promesa vs. modelo de surtido.** La marca promete "Todo, a tiempo" y "Te lo mandamos hoy". Surtiendo desde Emmsa no controlamos existencia ni tiempos. Mientras no haya inventario propio, la app solo muestra **"Entrega programada"** con fecha estimada realista; "Disponible hoy" y "Te lo mandamos hoy" se activan por producto cuando exista inventario propio.
2. **Validación sesgada.** PurAqua valida la *operación* (flujo de pedido, entrega, factura, app), pero **no valida demanda**: compra porque es empresa del mismo dueño. Para validar la idea hacen falta clientes externos (plomeros y al menos una constructora). Recomendación: fijar desde el inicio qué métrica externa confirma la idea (pendiente definir con Fede).
3. **Partes relacionadas (Tuval ↔ PurAqua).** Precios entre empresas del mismo dueño deben ser de mercado y bien documentados. Revisar con el contador antes de facturar.
4. **Margen en surtido directo.** Revender lo comprado a Emmsa + flete propio deja margen estrecho. La app registra costo de proveedor, precio de venta y costo de entrega por pedido para medirlo desde el día uno.
5. **Envío nacional (manual: "todo México").** Tubería en tramos no viaja por paquetería. Cada producto lleva bandera `envio_nacional`; fase 1 solo Puebla.
6. **Entrega sin recepción.** La foto solo protege si el contrato con el cliente la acepta como prueba de entrega.

## 3. Fase 1 · Venta en línea con surtido desde Emmsa

### Flujo del pedido
1. Cliente (plomero o empresa) busca y pide en la web/app (PWA). Elige entrega a domicilio, a obra o recoger.
2. Elige **factura (CFDI)** o **nota**.
3. Pago: tarjeta/SPEI, o crédito si es cuenta empresa autorizada (PurAqua).
4. El pedido genera automáticamente una **orden de compra a Emmsa** (agrupable por corte horario).
5. Chofer Tuval recoge en Emmsa → escanea lo recibido contra la orden (faltantes de proveedor quedan registrados).
6. Ruta de entrega: el cliente ve el seguimiento en vivo.
7. Entrega: foto + ubicación; firma opcional; **entrega sin recepción** si la obra lo tiene autorizado.
8. Cliente confirma partida por partida y reporta faltantes.

### Horario de corte (recomendación, por validar)

| Ola | Pedidos | Zona | Entrega |
|---|---|---|---|
| Mañana | del día anterior después del corte y hasta las 8:00 | Puebla | mismo día antes de mediodía* |
| Tarde | 8:00 a 12:00 L–V | Puebla | mismo día por la tarde* |
| Foráneas | hasta las 17:00 (sábado 12:00) | Atlixco y Tlaxcala | siguiente día hábil por la mañana |
| Sábado | hasta las 10:00 | Puebla | mismo día |

Implementado en `src/lib/corte.ts` con pruebas en `tests/corte.test.ts`. La app solo promete día y "mañana/tarde"; horas exactas cuando se mida el horario del chofer.

\* Las horas exactas dependen de dos datos pendientes: cuánto tarda Emmsa en preparar un pedido y el horario del chofer. No se publican hasta medirlos.

Dos recolecciones en Emmsa al día (aprox. 9:00 y 12:30); las foráneas se recogen en la primera. Si falta algo en Bodega ciudad, Emmsa lo surte desde La Ciénega (más tiempo: el pedido puede pasar a la siguiente recolección). Pedidos grandes: evaluar que Emmsa entregue directo; cuando el volumen lo justifique, días fijos o tercero.

### Métrica de validación (recomendación)
"2 pedidos diarios" contado así: **pedidos de clientes que no sean PurAqua**, promedio de días hábiles, **sostenido 4 semanas seguidas**, con margen bruto positivo después del costo de entrega. PurAqua se mide aparte.

Estados internos: `recibido → comprado_proveedor → surtido → en_ruta → entregado` (+ `entregado_con_faltantes`, `cancelado`).
El cliente ve: **Pedido recibido → Preparando pedido → En ruta → Entregado** (`src/lib/estados.ts`).

### Recomendación: bodega propia cerca de Emmsa
Cuando haya volumen, una bodega pequeña cerca de Bodega ciudad permite tener lo de alta rotación propio ("Disponible hoy") y consolidar recolecciones. Decisión pendiente hasta ver los datos de las primeras semanas.

### Módulos fase 1
- Catálogo con atributos técnicos (diámetro, cédula, material, presión, voltaje, calibre), búsqueda por medida.
- Importador de lista de precios/catálogo de Emmsa (formato pendiente).
- Carrito, checkout, factura/nota, pago.
- Cuentas empresa: usuarios con rol (comprador, residente, autorizador), obras, crédito.
- Órdenes de compra a proveedor.
- App de chofer (misma PWA, rol chofer): ruta, foto, ubicación.
- Seguimiento de pedido y confirmación de recepción.
- Panel interno: pedidos del día, compras pendientes, entregas.

## 4. Tuval Obra · consignación (opinión y reglas propuestas)

**Modelo decidido (D13):** bodeguero Tuval en la obra. Dos formas de retiro:
1. **Pedido en la app:** el residente o comprador pide → el autorizador del cliente confirma → el bodeguero surte, escanea y entrega; el que recibe firma en la tableta.
2. **QR personal:** el autorizado muestra su QR → el bodeguero escanea QR y productos → si el monto del día cabe en su límite (y en las categorías permitidas), se entrega sin confirmación; si se pasa, el autorizador confirma desde su celular.

Consecuencia: con bodeguero propio **la custodia es de Tuval**, no del cliente. Ganas control (nadie saca sin escaneo), pero la merma es tuya y el sueldo del bodeguero es costo fijo por obra. Recomendación: solo abrir bodega en obras con consumo suficiente para pagar al bodeguero (umbral pendiente) y contenedor cerrado fuera de su horario.

**Opinión:** es el mejor gancho comercial para constructoras (no inmovilizan capital y no paran la obra), pero el riesgo lo absorbe Tuval: capital inmovilizado, merma y robo en obra, y material que sobra al cerrar la obra. Funciona si el contrato y la app cierran esos huecos. **Recomendación:** pilotearlo primero en una obra de PurAqua, y hasta que haya inventario propio (fase 3).

Reglas propuestas (recomendación, por validar con abogado y contador):
- Contrato de consignación: el cliente responde por lo que sus autorizados retiran con QR o firma; la custodia física es del bodeguero Tuval.
- Solo **personas autorizadas** por el cliente retiran (lista en la app, con foto/código).
- Cada retiro = **vale de salida** digital (quién, qué, cuándo, partida de obra), escaneado.
- Facturación de lo retirado por periodo (semanal o quincenal), no por retiro.
- **Conteo cíclico** periódico con acta firmada.
- Reposición automática por mínimos.
- Al cierre de obra: devolución del sobrante en un plazo fijo; lo no devuelto se factura.
- Pendiente: monto máximo de consignación por obra y seguro del contenedor.

## 5. Fases

| Fase | Contenido |
|---|---|
| 1 | Venta en línea + surtido desde Emmsa + entrega propia + factura/nota + cuenta PurAqua |
| 2 | Inventario propio (CEDIS/sucursal), surtido con escáner y ubicaciones (P2-A3-04), "Disponible hoy", kiosco y WhatsApp |
| 3 | Tuval Obra (consignación), crédito a constructoras externas |
| 4 | Varias sucursales, asignación automática de surtido, Club Tuval, lockers, mapa de anaqueles |

## 6. Tecnología (recomendación)

- **Next.js + TypeScript**, una sola PWA (web, celular, tableta, kiosco) con vistas por rol.
- **Supabase** (Postgres, autenticación, tiempo real para seguimiento, almacenamiento para fotos de entrega).
- **Tailwind** con los tokens del manual de marca.
- Integraciones: PAC para CFDI 4.0, pasarela de pago mexicana, mapas, WhatsApp Business API (fase 2).
- Costo: servicios con plan gratuito o de pago por uso al inicio. **Precios por cotizar** al elegir proveedor; no se asumen cifras.

Fiscal a considerar desde el diseño: factura global para ventas con nota; complemento de pago (REP) para ventas a crédito (PPD).

## 7. Pendientes (no inventar)

- ¿Qué es exactamente Emmsa para Tuval (distribuidor/mayorista)? ¿Entrega lista de precios/catálogo? ¿En qué formato (Excel, PDF, API)? ¿Comparte existencias?
- Condiciones con Emmsa: crédito, horarios de recolección, tiempo de surtido.
- Coordenadas de los almacenes de Emmsa (de las ligas de Google Maps) para calcular rutas.
- Si Emmsa puede compartir existencias por archivo o sistema, y con qué frecuencia.
- Costo y condiciones del servicio a domicilio de Emmsa.
- Horario del chofer.
- Umbral de consumo mensual para abrir una bodega en obra.
- Pasarela de pago y PAC elegidos (mientras tanto el total y el pago se confirman por WhatsApp).
- Inicio de sesión para panel interno y clientes (el panel `/interno/pedidos` no tiene autenticación todavía).
- Razón social y RFC de Tuval para facturar.
