-- 0019 · Clientes (ficha, crédito, estado de cuenta), listas de precios por margen, demanda desde mostrador,
-- proceso de pedidos con Emmsa (solicitud, orden de compra, factura), entrega con firma, lealtad y recomendados,
-- capacidad de vehículos e inventario físico con tarjetas de doble conteo.

-- Demanda registrada en mostrador
alter type origen_solicitud add value if not exists 'mostrador';
alter table solicitudes_producto
  add column if not exists cliente_id uuid references clientes(id),
  add column if not exists registrado_por uuid references usuarios_internos(id);

-- Ficha de cliente
alter table clientes
  add column if not exists telefono text,
  add column if not exists correo text,
  add column if not exists direccion_fiscal text,
  add column if not exists direccion_oficina text,
  add column if not exists preferencia_contacto text not null default 'whatsapp' check (preferencia_contacto in ('whatsapp', 'llamada', 'correo')),
  add column if not exists horario_contacto text,
  add column if not exists acepta_promociones boolean not null default true,
  add column if not exists notas text,
  add column if not exists credito_activo boolean not null default false,
  add column if not exists codigo_recomendado text unique,
  add column if not exists recomendado_por uuid references clientes(id),
  add column if not exists recompensa_recomendado_en timestamptz,
  add column if not exists activo boolean not null default true;
create index if not exists clientes_telefono on clientes (telefono);
create table if not exists cliente_contactos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  nombre text not null, puesto text, telefono text, correo text,
  preferencia text not null default 'whatsapp' check (preferencia in ('whatsapp', 'llamada', 'correo')),
  principal boolean not null default false,
  creado_en timestamptz not null default now()
);

-- Listas de precios por margen (precio = costo ÷ (1 − margen)); un precio "fijo" no se recalcula.
alter table listas_precio
  add column if not exists margen_base numeric(6,4) check (margen_base is null or (margen_base >= 0 and margen_base < 0.95)),
  add column if not exists descripcion text,
  add column if not exists activa boolean not null default true;
insert into listas_precio (nombre, descripcion) values
  ('Plomero / Contratista', 'Clientes de oficio con compra recurrente'),
  ('Obra / Constructora', 'Constructoras y obras con volumen')
on conflict (nombre) do nothing;
create table if not exists margenes_lista (
  lista_id uuid references listas_precio(id) on delete cascade,
  categoria_id text references categorias(id),
  margen numeric(6,4) not null check (margen >= 0 and margen < 0.95),
  primary key (lista_id, categoria_id)
);
alter table precios
  add column if not exists fijo boolean not null default false,
  add column if not exists actualizado_en timestamptz not null default now();

-- Proceso de pedidos con el proveedor
alter table proveedores add column if not exists whatsapp text;
alter table pedidos
  add column if not exists aprobado_en timestamptz,
  add column if not exists aprobado_por text check (aprobado_por in ('pago', 'credito', 'manual'));
alter table ordenes_compra
  add column if not exists pedido_id uuid references pedidos(id),
  add column if not exists enviada_en timestamptz,
  add column if not exists total numeric(12,2),
  add column if not exists factura_archivo_id uuid references archivos(id),
  add column if not exists factura_folio text,
  add column if not exists factura_total numeric(12,2),
  add column if not exists conciliada_en timestamptz,
  add column if not exists diferencias jsonb;
create sequence if not exists folio_oc_seq;
alter table entregas
  add column if not exists firma_archivo_id uuid references archivos(id),
  add column if not exists checklist jsonb;

-- Lealtad y recomendados (puntos en un libro de movimientos; el saldo se suma)
create table if not exists movimientos_puntos (
  id bigint generated always as identity primary key,
  cliente_id uuid not null references clientes(id),
  pedido_id uuid references pedidos(id) on delete set null,
  puntos int not null,
  motivo text not null check (motivo in ('compra', 'canje', 'recomendado', 'bienvenida', 'ajuste')),
  nota text,
  creado_por uuid references usuarios_internos(id),
  creado_en timestamptz not null default now()
);
create index if not exists movimientos_puntos_cliente on movimientos_puntos (cliente_id);
insert into parametros_operacion (clave, valor, descripcion) values
  ('puntos_por_cada_100', 1, 'Puntos de lealtad por cada $100 comprados'),
  ('valor_punto', 1, 'Valor en pesos de cada punto al canjear'),
  ('puntos_recomienda', 200, 'Puntos para quien recomienda, cuando el recomendado hace su primera compra'),
  ('puntos_recomendado', 100, 'Puntos de bienvenida para el cliente recomendado en su primera compra'),
  ('compra_minima_recomendado', 1000, 'Compra mínima del recomendado para dar los puntos'),
  ('capacidad_moto_piezas', 20, 'Piezas máximas que lleva una moto (sin tubería en tramo)')
on conflict (clave) do nothing;

-- Vehículos: capacidad aproximada en piezas
alter table vehiculos add column if not exists capacidad_piezas int;
alter table productos add column if not exists peso_kg numeric(8,3);

-- Inventario físico con tarjetas (folio consecutivo, dos conteos ciegos, tercero si no coinciden)
create table if not exists inventarios_fisicos (
  id uuid primary key default gen_random_uuid(),
  almacen_id uuid not null references almacenes(id),
  nombre text not null,
  estado text not null default 'abierto' check (estado in ('abierto', 'cerrado')),
  creado_por uuid references usuarios_internos(id),
  creado_en timestamptz not null default now(),
  cerrado_en timestamptz
);
create table if not exists tarjetas_inventario (
  id uuid primary key default gen_random_uuid(),
  inventario_id uuid not null references inventarios_fisicos(id) on delete cascade,
  folio int not null,
  producto_id uuid not null references productos(id),
  ubicacion text,
  conteo1 numeric, contador1 uuid references usuarios_internos(id), conteo1_en timestamptz,
  conteo2 numeric, contador2 uuid references usuarios_internos(id), conteo2_en timestamptz,
  conteo3 numeric, contador3 uuid references usuarios_internos(id), conteo3_en timestamptz,
  sistema numeric,
  final numeric,
  unique (inventario_id, folio)
);

do $$
declare t text;
begin
  foreach t in array array['cliente_contactos', 'margenes_lista', 'movimientos_puntos', 'inventarios_fisicos', 'tarjetas_inventario'] loop
    execute format('alter table %I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on %I from anon, authenticated', t); end if;
  end loop;
end $$;
