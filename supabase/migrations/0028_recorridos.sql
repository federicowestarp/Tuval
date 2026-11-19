-- Recorrido de tienda (como el "sliding"): cada cierto tiempo alguien del equipo recorre la tienda con una lista corta.
create table if not exists recorridos_tienda (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios_internos(id),
  iniciado_en timestamptz not null default now(),
  terminado_en timestamptz,
  puntos jsonb not null default '[]',
  problemas int not null default 0
);
create index if not exists recorridos_tienda_fecha on recorridos_tienda (iniciado_en desc);
alter table recorridos_tienda enable row level security;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on recorridos_tienda from anon, authenticated; end if;
end $$;
insert into parametros_operacion (clave, valor, descripcion, supuesto) values
  ('recorrido_cada_min', 30, 'Minutos entre recorridos de tienda', true)
on conflict (clave) do nothing;
