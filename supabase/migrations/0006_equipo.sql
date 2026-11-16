-- Tuval · inicio de sesión del equipo interno

create type rol_interno as enum ('admin', 'operador');

create table usuarios_internos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  correo text not null unique,               -- en minúsculas
  hash_contrasena text not null,             -- scrypt: sal:hash (hex)
  rol rol_interno not null default 'operador',
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  ultimo_acceso timestamptz
);

create table sesiones_internas (
  token_hash text primary key,               -- sha256 del token de la cookie
  usuario_id uuid not null references usuarios_internos(id) on delete cascade,
  creado_en timestamptz not null default now(),
  expira_en timestamptz not null
);

-- Invitaciones de un solo uso: quien la abre pone su nombre, correo y contraseña.
create table invitaciones_internas (
  token_hash text primary key,
  rol rol_interno not null,
  creada_por uuid references usuarios_internos(id),
  expira_en timestamptz not null,
  usada_en timestamptz,
  usuario_id uuid references usuarios_internos(id)
);

-- Para frenar intentos repetidos de adivinar contraseñas.
create table intentos_acceso (
  id bigint generated always as identity primary key,
  correo text not null,
  exitoso boolean not null,
  creado_en timestamptz not null default now()
);
create index intentos_acceso_correo on intentos_acceso (correo, creado_en desc);

-- Mismas reglas de seguridad que el resto (0005).
alter table usuarios_internos enable row level security;
alter table sesiones_internas enable row level security;
alter table invitaciones_internas enable row level security;
alter table intentos_acceso enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on usuarios_internos, sesiones_internas, invitaciones_internas, intentos_acceso from anon, authenticated;
    revoke all on all sequences in schema public from anon, authenticated;
  end if;
end $$;
