-- 0017 · Planeación de rutas: asignar pedidos listos a un chofer, ordenar por hora límite y cercanía, liga a Google Maps.

create table if not exists parametros_operacion (
  clave text primary key,
  valor numeric not null,
  descripcion text not null,
  supuesto boolean not null default true,   -- valor inicial por confirmar con Dirección
  actualizado_por uuid references usuarios_internos(id),
  actualizado_en timestamptz not null default now()
);
insert into parametros_operacion (clave, valor, descripcion) values
  ('hora_limite_manana', 14, 'Hora límite de entrega "mañana" (hora del día, 24 h)'),
  ('hora_limite_tarde', 19, 'Hora límite de entrega "tarde" (hora del día, 24 h)'),
  ('hora_salida', 9, 'Hora de salida del chofer por defecto'),
  ('velocidad_kmh', 25, 'Velocidad promedio en ciudad (km/h) para estimar traslados'),
  ('factor_calle', 1.35, 'Factor de distancia por calles vs línea recta'),
  ('minutos_parada', 15, 'Minutos promedio por entrega'),
  ('minutos_recoleccion', 30, 'Minutos promedio de recolección en bodega')
on conflict (clave) do nothing;

alter table rutas
  add column if not exists origen_almacen_id uuid references almacenes(id),
  add column if not exists salida_planeada timestamptz,
  add column if not exists planeada_en timestamptz,
  add column if not exists planeada_por uuid references usuarios_internos(id),
  add column if not exists km_estimados numeric(8,1),
  add column if not exists minutos_estimados int;

alter table entregas
  add column if not exists eta timestamptz,
  add column if not exists hora_limite timestamptz,
  add column if not exists km_tramo numeric(8,1);

alter table parametros_operacion enable row level security;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on parametros_operacion from anon, authenticated; end if;
end $$;
