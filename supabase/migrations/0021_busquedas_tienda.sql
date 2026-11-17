-- Búsquedas del buscador "¿Dónde está?" (celular del cliente, tablet de recepción o de vendedor) para medir uso
-- y detectar lo que piden y no tenemos.
alter type origen_solicitud add value if not exists 'buscador_tienda';

create table if not exists busquedas_tienda (
  id bigint generated always as identity primary key,
  texto text not null,
  usada text,
  resultados int not null,
  con_existencia int not null default 0,
  origen text not null default 'web' check (origen in ('web', 'letrero', 'recepcion', 'vendedor')),
  creado_en timestamptz not null default now()
);
create index if not exists busquedas_tienda_creado on busquedas_tienda (creado_en desc);

alter table busquedas_tienda enable row level security;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on busquedas_tienda from anon, authenticated; end if;
end $$;
