-- De dónde vino cada producto (p. ej. 'purAqua-prueba', 'emmsa', 'manual') para poder limpiarlo o filtrarlo.
alter table productos add column if not exists origen text;
alter table productos add column if not exists marca_texto text;
create index if not exists productos_origen on productos (origen);

-- Ruta del día por chofer y entregas con evidencia.
alter table entregas add column if not exists recibio_telefono text;
alter table entregas add column if not exists notas text;
create unique index if not exists rutas_chofer_fecha on rutas (chofer_id, fecha);
alter table posiciones_ruta add column if not exists precision_m double precision;

-- Leads de la página de Internet (Tuval Obra y contacto).
create table if not exists contactos_web (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,                      -- 'obra' | 'contacto'
  nombre text not null,
  empresa text,
  telefono text not null,
  correo text,
  mensaje text,
  atendido boolean not null default false,
  creado_en timestamptz not null default now()
);
alter table contactos_web enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on contactos_web from anon, authenticated;
  end if;
end $$;
