-- Tuval · cuentas con direcciones, acceso de quien recibe, pedido desde lista,
-- registro de demanda no surtida y cotizaciones de proveedor.

-- ───────────── Cuentas de cliente (sesión por dispositivo; verificación por WhatsApp pendiente) ─────────────
create table cuentas (
  id uuid primary key default gen_random_uuid(),
  nombre text,
  telefono text,
  cliente_id uuid references clientes(id),
  creado_en timestamptz not null default now()
);
create table sesiones (
  token_hash text primary key,                -- sha256 del token de la cookie
  cuenta_id uuid not null references cuentas(id) on delete cascade,
  creado_en timestamptz not null default now()
);

-- ───────────── Archivos (fotos de fachada, listas en foto/PDF, fotos de entrega) ─────────────
-- MVP: en Postgres. Pasar a Supabase Storage cuando crezca el volumen.
create table archivos (
  id uuid primary key default gen_random_uuid(),
  mime text not null,
  nombre text,
  bytes int not null,
  datos bytea not null,
  cuenta_id uuid references cuentas(id),
  creado_en timestamptz not null default now()
);

-- ───────────── Direcciones guardadas ─────────────
create type tipo_direccion as enum ('obra', 'particular');
create type preferencia_contacto as enum ('whatsapp', 'telefono');

create table direcciones (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references cuentas(id) on delete cascade,
  tipo tipo_direccion not null,
  alias text not null,                        -- "Obra Torre Angelópolis", "Casa"
  direccion text not null,
  zona zona_entrega not null,
  lat double precision,
  lng double precision,
  foto_archivo_id uuid references archivos(id),
  recibe_nombre text not null,
  recibe_telefono text not null,
  preferencia_contacto preferencia_contacto not null default 'whatsapp',
  permite_sin_recepcion boolean not null default false,
  indicaciones text,
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);

alter table pedidos
  add column cuenta_id uuid references cuentas(id),
  add column direccion_id uuid references direcciones(id),
  add column recibe_nombre text,
  add column recibe_telefono text,
  add column preferencia_contacto preferencia_contacto,
  add column lat double precision,
  add column lng double precision,
  add column foto_fachada_id uuid references archivos(id),
  add column token_receptor text unique,      -- acceso para quien recibe
  add column confirmado_en timestamptz,       -- precios y existencias confirmados al cliente
  add column recepcion_confirmada_en timestamptz;

alter table pedidos alter column entrega_fecha drop not null;

create table pedido_archivos (
  pedido_id uuid references pedidos(id) on delete cascade,
  archivo_id uuid references archivos(id),
  descripcion text,
  primary key (pedido_id, archivo_id)
);

-- ───────────── Demanda no surtida: lo que piden y no tenemos ─────────────
create type origen_solicitud as enum ('cliente_fuera_catalogo', 'proveedor_sin_existencia', 'lista_cliente', 'interno');
create type estado_solicitud as enum ('nueva', 'buscando', 'conseguida', 'agregada_catalogo', 'no_conseguible');

create table solicitudes_producto (
  id uuid primary key default gen_random_uuid(),
  descripcion text not null,
  cantidad numeric,
  unidad text,
  origen origen_solicitud not null,
  estado estado_solicitud not null default 'nueva',
  cuenta_id uuid references cuentas(id),
  pedido_id uuid references pedidos(id),
  producto_id uuid references productos(id),  -- si era de catálogo pero no hubo existencia
  proveedor_alterno text,
  notas text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index solicitudes_estado on solicitudes_producto (estado, creado_en desc);

-- ───────────── Cotizaciones de proveedor (Emmsa) para confirmar pedidos ─────────────
create table cotizaciones_proveedor (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid not null references proveedores(id),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  folio_proveedor text,
  texto_original text,                        -- lo pegado desde Excel/correo, para auditoría
  archivo_id uuid references archivos(id),
  cargada_en timestamptz not null default now()
);
create table cotizacion_partidas (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references cotizaciones_proveedor(id) on delete cascade,
  codigo_proveedor text,
  descripcion text,
  cantidad numeric,
  precio_unitario numeric(12,2),              -- costo del proveedor, sin IVA
  disponible boolean,
  tiempo_entrega text,
  pedido_partida_id uuid references pedido_partidas(id)
);
