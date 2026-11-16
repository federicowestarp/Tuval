-- Tuval · esquema inicial (v0.1)
-- Un solo inventario para todos los canales. Diseñado para fase 1 (surtido desde
-- proveedor) y preparado para inventario propio, sucursales y Tuval Obra.


-- ───────────── Almacenes y ubicaciones ─────────────
create type tipo_almacen as enum ('cedis', 'sucursal', 'obra', 'camion', 'proveedor');

create table almacenes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo tipo_almacen not null,
  direccion text,
  lat double precision,
  lng double precision,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- Ubicación física dentro de un almacén. Formato del manual: P2-A3-04.
create table ubicaciones (
  id uuid primary key default gen_random_uuid(),
  almacen_id uuid not null references almacenes(id),
  codigo text not null,               -- P2-A3-04
  pasillo text, anaquel text, nivel text,
  unique (almacen_id, codigo)
);

-- ───────────── Catálogo ─────────────
create table categorias (
  id text primary key,                -- tuberia, conexiones, valvulas, equipos, electrico, herramienta
  nombre text not null,
  orden int not null default 0
);

create table productos (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  nombre text not null,
  descripcion text,
  categoria_id text not null references categorias(id),
  marca text,
  atributos jsonb not null default '{}',   -- {"diametro":"1/2\"","material":"PVC","cedula":"40"}
  unidad text not null default 'pieza',    -- pieza, tramo, metro, rollo
  codigo_barras text,
  sat_clave_prod_serv text,               -- CFDI 4.0
  sat_clave_unidad text,
  envio_nacional boolean not null default false,
  imagen_url text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
create index productos_busqueda on productos using gin (to_tsvector('spanish', nombre || ' ' || coalesce(descripcion, '')));
create index productos_atributos on productos using gin (atributos);

-- Kits: "Tinaco y bomba", "Baño completo"
create table kits (id uuid primary key default gen_random_uuid(), nombre text not null, descripcion text);
create table kit_partidas (
  kit_id uuid references kits(id) on delete cascade,
  producto_id uuid references productos(id),
  cantidad numeric not null,
  primary key (kit_id, producto_id)
);

-- ───────────── Proveedores (fase 1: Emmsa) ─────────────
create table proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  rfc text,
  almacen_id uuid references almacenes(id),   -- almacén virtual tipo 'proveedor'
  dias_credito int,
  contacto text
);

create table productos_proveedor (
  producto_id uuid references productos(id),
  proveedor_id uuid references proveedores(id),
  sku_proveedor text,
  costo numeric(12,2),
  existencia_reportada numeric,               -- si el proveedor la comparte
  tiempo_surtido_horas int,
  actualizado_en timestamptz not null default now(),
  primary key (producto_id, proveedor_id)
);

-- ───────────── Precios ─────────────
create table listas_precio (id uuid primary key default gen_random_uuid(), nombre text not null unique);
create table precios (
  lista_id uuid references listas_precio(id),
  producto_id uuid references productos(id),
  precio numeric(12,2) not null,              -- sin IVA
  vigente_desde timestamptz not null default now(),
  primary key (lista_id, producto_id)
);

-- ───────────── Inventario (libro de movimientos) ─────────────
create table existencias (
  producto_id uuid references productos(id),
  almacen_id uuid references almacenes(id),
  ubicacion_id uuid references ubicaciones(id),
  cantidad numeric not null default 0,
  minimo numeric, maximo numeric,
  primary key (producto_id, almacen_id)
);

create type tipo_movimiento as enum ('entrada_compra', 'salida_venta', 'traspaso', 'ajuste_conteo', 'retiro_obra', 'devolucion');

create table movimientos_inventario (
  id bigint generated always as identity primary key,
  producto_id uuid not null references productos(id),
  almacen_origen uuid references almacenes(id),
  almacen_destino uuid references almacenes(id),
  cantidad numeric not null,
  tipo tipo_movimiento not null,
  referencia text,                            -- folio de pedido, OC, vale
  usuario_id uuid,
  escaneado boolean not null default false,
  creado_en timestamptz not null default now()
);

-- ───────────── Clientes ─────────────
create type tipo_cliente as enum ('persona', 'empresa');

create table clientes (
  id uuid primary key default gen_random_uuid(),
  tipo tipo_cliente not null,
  nombre text not null,
  rfc text, razon_social text, regimen_fiscal text, codigo_postal_fiscal text, uso_cfdi text,
  lista_precio_id uuid references listas_precio(id),
  limite_credito numeric(12,2) not null default 0,
  dias_credito int not null default 0,
  parte_relacionada boolean not null default false,   -- PurAqua
  creado_en timestamptz not null default now()
);

create type rol_cliente as enum ('comprador', 'residente', 'autorizador', 'administrador');
create table usuarios_cliente (
  usuario_id uuid not null,                   -- auth.users
  cliente_id uuid not null references clientes(id),
  rol rol_cliente not null,
  limite_por_pedido numeric(12,2),
  primary key (usuario_id, cliente_id)
);

create table obras (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  nombre text not null,
  direccion text not null,
  lat double precision, lng double precision,
  instrucciones_entrega text,
  permite_entrega_sin_recepcion boolean not null default false,
  almacen_id uuid references almacenes(id),   -- bodega Tuval Obra si existe
  activa boolean not null default true
);

-- Personas autorizadas a retirar en bodega de obra
create table autorizados_obra (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id),
  nombre text not null,
  telefono text,
  foto_url text,
  usuario_id uuid,                            -- si usa la app
  qr_token text unique,                       -- QR personal para retiro directo
  limite_qr_diario numeric(12,2) not null default 0,  -- monto que puede retirar sin confirmación
  categorias_qr text[],                       -- null = todas
  activo boolean not null default true
);

-- ───────────── Pedidos ─────────────
create type canal_pedido as enum ('web', 'app', 'whatsapp', 'kiosco', 'mostrador', 'obra');
create type tipo_entrega as enum ('domicilio', 'obra', 'recoger');
create type estado_pedido as enum ('recibido', 'comprado_proveedor', 'surtido', 'en_ruta', 'entregado', 'entregado_con_faltantes', 'cancelado');
create type comprobante as enum ('factura', 'nota');

create table pedidos (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  canal canal_pedido not null,
  cliente_id uuid references clientes(id),
  usuario_id uuid,
  obra_id uuid references obras(id),
  tipo_entrega tipo_entrega not null,
  direccion_entrega text,
  almacen_surtido uuid references almacenes(id),
  estado estado_pedido not null default 'recibido',
  comprobante comprobante not null,
  a_credito boolean not null default false,
  orden_compra_cliente text,
  autorizado_por uuid,
  entrega_estimada_desde timestamptz,
  entrega_estimada_hasta timestamptz,
  subtotal numeric(12,2) not null default 0,
  iva numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  costo_envio numeric(12,2),                  -- para medir margen real
  creado_en timestamptz not null default now()
);

create table pedido_partidas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  producto_id uuid not null references productos(id),
  cantidad numeric not null,
  precio_unitario numeric(12,2) not null,
  costo_unitario numeric(12,2),
  cantidad_surtida numeric not null default 0,
  cantidad_recibida numeric                    -- confirmada por el cliente
);

create table pedido_eventos (
  id bigint generated always as identity primary key,
  pedido_id uuid not null references pedidos(id) on delete cascade,
  estado estado_pedido not null,
  nota text,
  usuario_id uuid,
  creado_en timestamptz not null default now()
);

-- ───────────── Compras a proveedor (fase 1) ─────────────
create type estado_oc as enum ('borrador', 'enviada', 'recolectada_parcial', 'recolectada', 'cancelada');
create table ordenes_compra (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  proveedor_id uuid not null references proveedores(id),
  estado estado_oc not null default 'borrador',
  creado_en timestamptz not null default now()
);
create table orden_compra_partidas (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references ordenes_compra(id) on delete cascade,
  pedido_partida_id uuid references pedido_partidas(id),
  producto_id uuid not null references productos(id),
  cantidad numeric not null,
  costo_unitario numeric(12,2),
  cantidad_recibida numeric not null default 0
);

-- ───────────── Entregas ─────────────
create type estado_entrega as enum ('programada', 'en_ruta', 'entregada', 'fallida');
create table rutas (
  id uuid primary key default gen_random_uuid(),
  chofer_id uuid not null,
  fecha date not null,
  vehiculo text,
  iniciada_en timestamptz, terminada_en timestamptz
);
create table entregas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id),
  ruta_id uuid references rutas(id),
  orden_en_ruta int,
  estado estado_entrega not null default 'programada',
  sin_recepcion boolean not null default false,
  recibio_nombre text,
  firma_url text,
  entregada_en timestamptz,
  lat double precision, lng double precision
);
create table entrega_fotos (
  id uuid primary key default gen_random_uuid(),
  entrega_id uuid not null references entregas(id) on delete cascade,
  url text not null,
  lat double precision, lng double precision,
  tomada_en timestamptz not null default now()
);
-- Posición del chofer para seguimiento en vivo
create table posiciones_ruta (
  id bigint generated always as identity primary key,
  ruta_id uuid not null references rutas(id),
  lat double precision not null, lng double precision not null,
  registrada_en timestamptz not null default now()
);
-- Faltantes reportados por el cliente al recibir
create table reportes_faltante (
  id uuid primary key default gen_random_uuid(),
  pedido_partida_id uuid not null references pedido_partidas(id),
  cantidad_faltante numeric not null,
  comentario text, foto_url text,
  reportado_por uuid,
  resuelto boolean not null default false,
  creado_en timestamptz not null default now()
);

-- ───────────── Tuval Obra (consignación, fase 3) ─────────────
create type origen_vale as enum ('solicitud_app', 'qr');
create type estado_vale as enum ('solicitado', 'confirmado', 'entregado', 'rechazado');

-- Retiro en bodega de obra. Lo entrega el bodeguero Tuval en sitio.
--  · solicitud_app: alguien pide en la app → autorizador del cliente confirma → bodeguero entrega.
--  · qr: autorizado muestra su QR → bodeguero escanea QR y productos → entrega directa si cabe en su límite diario.
create table vales_salida (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  obra_id uuid not null references obras(id),
  autorizado_id uuid not null references autorizados_obra(id),
  origen origen_vale not null,
  estado estado_vale not null default 'solicitado',
  confirmado_por uuid,                        -- autorizador del cliente (solicitud_app o excedente de QR)
  confirmado_en timestamptz,
  entregado_por uuid,                         -- bodeguero Tuval
  entregado_en timestamptz,
  firma_url text,
  partida_obra text,                          -- consumo por partida
  pedido_id uuid references pedidos(id),      -- se agrupa en pedido para facturar por periodo
  creado_en timestamptz not null default now()
);
create table vale_partidas (
  vale_id uuid references vales_salida(id) on delete cascade,
  producto_id uuid references productos(id),
  cantidad numeric not null,
  primary key (vale_id, producto_id)
);
create table conteos (
  id uuid primary key default gen_random_uuid(),
  almacen_id uuid not null references almacenes(id),
  realizado_por uuid, firmado_por text,
  creado_en timestamptz not null default now()
);
create table conteo_partidas (
  conteo_id uuid references conteos(id) on delete cascade,
  producto_id uuid references productos(id),
  sistema numeric not null, contado numeric not null,
  primary key (conteo_id, producto_id)
);

-- ───────────── Facturación y pagos ─────────────
create type estado_cfdi as enum ('pendiente', 'timbrada', 'cancelada', 'error');
create table facturas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references pedidos(id),
  cliente_id uuid references clientes(id),
  uuid_sat text unique,
  serie text, folio text,
  metodo_pago text,                           -- PUE / PPD
  forma_pago text,
  total numeric(12,2) not null,
  estado estado_cfdi not null default 'pendiente',
  es_global boolean not null default false,   -- factura global de notas
  xml_url text, pdf_url text,
  creado_en timestamptz not null default now()
);
create table pagos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id),
  pedido_id uuid references pedidos(id),
  monto numeric(12,2) not null,
  forma text not null,                        -- tarjeta, spei, efectivo, credito
  referencia_pasarela text,
  complemento_pago_uuid text,                 -- REP para PPD
  pagado_en timestamptz not null default now()
);

-- Datos base
insert into categorias (id, nombre, orden) values
  ('tuberia', 'Tubería', 1), ('conexiones', 'Conexiones', 2), ('valvulas', 'Válvulas', 3),
  ('equipos', 'Equipos y bombas', 4), ('electrico', 'Eléctrico', 5), ('herramienta', 'Herramienta', 6);

-- Pendiente: políticas RLS por rol (cliente, chofer, almacén, admin) antes de producción.
