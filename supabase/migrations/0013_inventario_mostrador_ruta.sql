-- 0013 · Inventario de sucursal, punto de venta (mostrador), captura de tiempos por perfil,
-- odómetro y combustible, rastreador GPS de vehículos y datos de prueba borrables.

alter type rol_interno add value if not exists 'mostrador';

-- Sucursal (la primera). Las coordenadas se capturan después; no se inventan.
insert into almacenes (nombre, tipo)
select 'Sucursal', 'sucursal' where not exists (select 1 from almacenes where tipo = 'sucursal');

-- Inventario: la existencia siempre se puede recalcular desde movimientos_inventario.
alter table existencias add column if not exists actualizado_en timestamptz not null default now();
alter table movimientos_inventario
  add column if not exists costo_unitario numeric(12,2),
  add column if not exists nota text,
  add column if not exists pedido_id uuid references pedidos(id) on delete set null;
create index if not exists movimientos_producto on movimientos_inventario (producto_id, creado_en desc);
alter table productos add column if not exists costo_promedio numeric(12,2);
create unique index if not exists productos_codigo_barras on productos (codigo_barras) where codigo_barras is not null;

-- Caja del mostrador (apertura con fondo, cierre con efectivo contado).
create table if not exists cajas (
  id uuid primary key default gen_random_uuid(),
  almacen_id uuid not null references almacenes(id),
  abierta_por uuid not null references usuarios_internos(id),
  abierta_en timestamptz not null default now(),
  fondo numeric(12,2) not null default 0,
  cerrada_por uuid references usuarios_internos(id),
  cerrada_en timestamptz,
  efectivo_contado numeric(12,2),
  notas text
);
alter table pagos add column if not exists caja_id uuid references cajas(id);
alter table pagos add column if not exists recibido numeric(12,2);   -- efectivo entregado por el cliente (para el cambio)

-- Tiempos por etapa que captura el operador.
alter table pedidos
  add column if not exists cotizacion_solicitada_en timestamptz,
  add column if not exists aceptado_en timestamptz,
  add column if not exists vendedor_id uuid references usuarios_internos(id);

-- Paradas del chofer: llegada y salida en proveedor/sucursal (recolección) y con el cliente (entrega).
create table if not exists paradas_ruta (
  id uuid primary key default gen_random_uuid(),
  ruta_id uuid not null references rutas(id) on delete cascade,
  tipo text not null check (tipo in ('recoleccion', 'entrega')),
  almacen_id uuid references almacenes(id),
  pedido_id uuid references pedidos(id) on delete cascade,
  llegada_en timestamptz not null default now(),
  salida_en timestamptz,
  lat double precision, lng double precision
);
create index if not exists paradas_ruta_ruta on paradas_ruta (ruta_id, llegada_en);
create table if not exists parada_pedidos (
  parada_id uuid references paradas_ruta(id) on delete cascade,
  pedido_id uuid references pedidos(id) on delete cascade,
  primary key (parada_id, pedido_id)
);

-- Odómetro al iniciar y terminar ruta; combustible con litros y odómetro.
alter table rutas
  add column if not exists odometro_inicio int,
  add column if not exists odometro_fin int,
  add column if not exists foto_odometro_inicio uuid references archivos(id),
  add column if not exists foto_odometro_fin uuid references archivos(id);
alter table gastos
  add column if not exists litros numeric(8,2),
  add column if not exists odometro int;

-- Rastreador GPS instalado en el vehículo (identificador del equipo, p. ej. IMEI).
alter table vehiculos add column if not exists rastreador_id text unique;
create table if not exists posiciones_vehiculo (
  id bigint generated always as identity primary key,
  vehiculo_id uuid not null references vehiculos(id) on delete cascade,
  lat double precision not null, lng double precision not null,
  velocidad_kmh double precision,
  registrada_en timestamptz not null,
  recibida_en timestamptz not null default now()
);
create index if not exists posiciones_vehiculo_v on posiciones_vehiculo (vehiculo_id, registrada_en);

-- Registro de lo que se cargó como dato de prueba, para poder borrarlo completo.
create table if not exists datos_prueba (
  tabla text not null,
  id text not null,
  primary key (tabla, id)
);

do $$
declare t text;
begin
  foreach t in array array['cajas', 'paradas_ruta', 'parada_pedidos', 'posiciones_vehiculo', 'datos_prueba'] loop
    execute format('alter table %I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on %I from anon, authenticated', t);
    end if;
  end loop;
end $$;
