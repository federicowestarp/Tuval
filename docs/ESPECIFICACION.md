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
| D17 | El cliente guarda **varias direcciones** marcadas como **obra** o **particular**, con ubicación en mapa, foto de fachada/entrada (opcional), quién recibe, su teléfono y si prefiere **WhatsApp o llamada**. Al pedir solo elige **envío** (a una dirección guardada) o **recoger en sucursal** (desactivado hasta tener sucursal). | nov 2026 |
| D18 | **Acceso de entrega para quien recibe** (residente de obra): liga propia, sin precios, con seguimiento y confirmación partida por partida; lo que falte queda como reporte de faltante. | nov 2026 |
| D19 | Para **confirmar** un pedido se carga la **cotización de Emmsa** (precios, disponibilidad, tiempo) y se compara contra nuestro precio, existencias y promesa; después se confirma al cliente. | nov 2026 |
| D20 | **Nada de lo que pidan se pierde:** lo que no está en catálogo o no se consigue se registra como **demanda** para buscar proveedor o darlo de alta en catálogo. | nov 2026 |
| D21 | El cliente puede **pedir con una lista**: escrita (se busca en catálogo renglón por renglón), o **foto/PDF** adjunta que el equipo captura. | nov 2026 |
| D22 | El número de WhatsApp de Tuval es el **número oficial**: se piden y mandan listas/fotos por ahí y llegan al mismo sistema. Plataforma recomendada: **WhatsApp Cloud API de Meta**, integrada directo a la app (pendiente de alta). | nov 2026 |
| D23 | Cuentas que no se pierden: acceso con **celular (código por WhatsApp) o correo** (pendiente de conectar con Supabase Auth). | nov 2026 |
| D24 | Diseño minimalista (referencia de estilo: Apple y Rivian) sobre la identidad Tuval; **página de Internet** en `/` y tienda en `/tienda`. | nov 2026 |
| D25 | Cotizaciones de Emmsa se suben en **PDF** y se leen automáticamente (`src/lib/emmsa.ts`), validando que la suma cuadre con el subtotal. | nov 2026 |
| D27 | **Equipo Tuval con inicio de sesión**: correo y contraseña (scrypt), sesiones de 7 días, roles administrador/operador, alta por invitación de un solo uso (24 h), bloqueo de 15 min tras 5 intentos fallidos. Panel en `/interno/*`. | nov 2026 |
| D28 | Catálogo de **prueba con el inventario de PurAqua** (origen `puraqua-prueba`), importado por CSV; se puede quitar de la tienda con un clic. Existencias en almacén tipo proveedor: no se anuncia "Disponible hoy". | nov 2026 |
| D29 | **App del chofer** (rol chofer): ruta del día, salir a entregar, ubicación cada minuto visible para el cliente, entrega con foto y ubicación obligatorias. | nov 2026 |
| D30 | **Página de Internet**: inicio, tienda, ficha de producto (destino de QR), Tuval Obra con formulario, sitemap, robots, vista previa al compartir e instalable como app. | nov 2026 |
| D31 | **Pedidos desde cualquier estado.** La dirección pide estado y municipio; la página ya no menciona zonas. Las zonas con entrega propia y corte (Puebla zona metropolitana, Atlixco, Tlaxcala) se calculan del municipio; fuera de ellas, fecha y costo de envío se confirman al cotizar. El panel muestra la demanda por estado (90 días). Municipios de la zona metropolitana de Puebla: supuesto por validar. | nov 2026 |
| D32 | **admin.tuval.mx** muestra solo el panel interno; las páginas públicas se redirigen a www.tuval.mx. | nov 2026 |
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

### Confirmación del pedido (interno)
1. Pedido entra "por confirmar". El cliente ve "Estamos confirmando precios y existencias".
2. En `/interno/pedidos/[id]` se pega la cotización de Emmsa desde Excel (código | descripción | cantidad | precio | disponible | tiempo). Se empareja con las partidas por código de Emmsa, SKU o descripción; lo que no empate se asigna a mano.
3. Tabla de comparación: existencia propia, costo Emmsa, disponibilidad y tiempo, nuestra lista, precio de venta y **margen** (en rojo si vendemos a costo o abajo).
4. Lo que Emmsa no tiene viene pre-marcado como "no se consigue": al confirmar se quita del pedido y queda en Demanda.
5. Confirmar fija precios y total; el costo de Emmsa se guarda en `productos_proveedor` (así se arma la lista de costos con el uso).
6. Botón de WhatsApp con el mensaje de confirmación (total, promesa, lo que seguimos buscando y liga de seguimiento).

### Demanda no surtida (`/interno/demanda`)
Agrupada por descripción: cuántas veces y cuántos clientes lo han pedido. Estados: nueva → buscando → conseguida → en catálogo / no se consigue. Se anota quién lo vende y notas. "Dar de alta en catálogo" crea el producto y, si el pedido de origen sigue sin confirmar, lo agrega como partida.

### Tablero, gastos y flotilla (`/interno/tablero`, solo admin)
- **Pedidos:** recibidos, cotizaciones de proveedor cargadas, confirmados, entregados, cancelados por motivo (cancelar exige motivo: Sin existencia, Cliente canceló, Precio no aceptado, Fuera de cobertura, Duplicado, Otro + nota) y abiertos por etapa.
- **Tiempos (mediana):** pedido → cotización cargada → confirmado (existencias) → comprado → surtido → en ruta → entregado. Salen de los eventos que ya registra el sistema; no se capturan a mano.
- **Rutas:** por chofer y día, vehículo, entregas, horas y km sumando los puntos GPS del chofer (aproximado: depende de que el teléfono mande ubicación).
- **Ingresos y gastos:** ventas = pedidos confirmados con IVA; costo = cotizaciones del proveedor; cobrado = cobros registrados en cada pedido; gastos en `/interno/gastos` (con comprobante, ligados a vehículo o persona).
- **Flotilla y nómina:** `/interno/flotilla` da de alta vehículos y personal; el chofer elige vehículo al iniciar ruta; la nómina pagada se registra como gasto de categoría Nómina.

### Sucursal: mostrador e inventario (`/interno/mostrador`, `/interno/inventario`; rol Mostrador, Operador o Admin)
- **Un solo inventario.** Cada cambio es un movimiento en el libro (`movimientos_inventario`): entrada de compra, venta, traspaso, ajuste por conteo. La existencia siempre se puede recalcular del libro.
- **Mostrador:** abrir caja con fondo → escanear (lector USB = teclado + Enter) o buscar → cobrar en efectivo (con cambio), tarjeta (autorización de la terminal) o transferencia → ticket de 80 mm → corte de caja con efectivo contado vs esperado. La venta queda como pedido `MO-` (canal mostrador, entregado) y descuenta la sucursal.
- Un código de barras que no existe se liga al producto al escanearlo la primera vez.
- Se puede vender sin existencia en sistema: queda en negativo y aparece en Inventario para revisar (no frena al cliente en mostrador).
- **Inventario:** existencias con mínimo, recibir mercancía (actualiza costo promedio y costo del proveedor), conteo cíclico con ajuste automático, movimientos.
- Pedido en línea con existencia en sucursal: botón "Surtir desde sucursal" (no se compra a Emmsa).
- Factura en mostrador: se capturan datos fiscales y queda **pendiente de timbrar** hasta contratar PAC.

### Captura por perfil para medir tiempos
- **Operador:** "Ya pedí cotización al proveedor" → carga cotización → confirma → "Cliente aceptó" (o se marca solo al cobrar o comprar).
- **Chofer:** odómetro (y foto opcional) al iniciar y terminar ruta; "Llegué" / "Recogí, ya salgo" en la bodega (espera en proveedor); "Llegué con el cliente" antes de entregar (traslado y espera en obra); carga de gasolina con litros, odómetro y foto del ticket (km/L).
- **Rastreador GPS (opcional):** IMEI en Flotilla; posiciones entran por `POST /api/rastreo` (flespi HTTP stream o Traccar forward) con `Authorization: Bearer RASTREO_TOKEN`.

### Datos de prueba
Botón en el Tablero: carga 30 días inventados (folios PR-/PM-, vehículos y personal "prueba"; a productos sin precio se les inventa uno solo en esos pedidos). Todo queda anotado en `datos_prueba` y se borra completo con otro botón.

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
- Verificación de la cuenta por código de WhatsApp para entrar desde otro dispositivo (hoy la cuenta vive en la cookie del dispositivo).
- Captura asistida de listas en foto/PDF con IA (costo por uso; cotizar antes de activarla). Hoy la captura es manual.
- Mover archivos (fotos, PDFs) de Postgres a Supabase Storage cuando crezca el volumen.
- Coordenadas de los almacenes de Emmsa (de las ligas de Google Maps) para calcular rutas.
- Si Emmsa puede compartir existencias por archivo o sistema, y con qué frecuencia.
- Costo y condiciones del servicio a domicilio de Emmsa.
- Horario del chofer.
- Umbral de consumo mensual para abrir una bodega en obra.
- Pasarela de pago y PAC elegidos (mientras tanto el total y el pago se confirman por WhatsApp).
- Inicio de sesión de clientes con celular (código por WhatsApp) o correo.
- Razón social y RFC de Tuval para facturar.
