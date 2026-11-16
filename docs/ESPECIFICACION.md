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

Estados: `recibido → comprado_proveedor → surtido → en_ruta → entregado` (+ `entregado_con_faltantes`, `cancelado`).

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

**Opinión:** es el mejor gancho comercial para constructoras (no inmovilizan capital y no paran la obra), pero el riesgo lo absorbe Tuval: capital inmovilizado, merma y robo en obra, y material que sobra al cerrar la obra. Funciona si el contrato y la app cierran esos huecos. **Recomendación:** pilotearlo primero en una obra de PurAqua, y hasta que haya inventario propio (fase 3).

Reglas propuestas (recomendación, por validar con abogado y contador):
- Contrato de consignación: el cliente es **custodio** del inventario; diferencias en conteo se le cobran.
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
- Hora de corte del día y zonas de entrega en Puebla.
- Pasarela de pago y PAC elegidos.
- Métrica externa que valida la idea (pedidos/semana de clientes que no sean PurAqua, ticket, margen).
- Razón social y RFC de Tuval para facturar.
