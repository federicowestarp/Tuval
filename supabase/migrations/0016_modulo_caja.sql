-- 0016 · Módulo de caja: apertura y cierre ciegos, conteo por denominación, retiros, sobres de fondo,
-- terminales, transferencias pendientes, incidentes, parámetros y bitácora.
-- Nota de nombres: la tabla existente `cajas` es el TURNO (una apertura-cierre); la caja física es `cajas_registradoras`.

alter type rol_interno add value if not exists 'supervisor';

create table if not exists cajas_registradoras (
  id uuid primary key default gen_random_uuid(),
  almacen_id uuid not null references almacenes(id),
  nombre text not null,
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);
insert into cajas_registradoras (almacen_id, nombre)
select id, 'Caja 1' from almacenes where tipo = 'sucursal' and not exists (select 1 from cajas_registradoras);

create table if not exists terminales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  proveedor text,
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);
create table if not exists caja_terminales (
  registradora_id uuid references cajas_registradoras(id) on delete cascade,
  terminal_id uuid references terminales(id) on delete cascade,
  primary key (registradora_id, terminal_id)
);

-- Turno
alter table cajas
  add column if not exists registradora_id uuid references cajas_registradoras(id),
  add column if not exists estado text not null default 'abierto'
    check (estado in ('pendiente_autorizacion', 'abierto', 'cerrado', 'conciliado', 'con_incidente')),
  add column if not exists cierre_de_dia boolean not null default false,
  add column if not exists autorizada_por uuid references usuarios_internos(id),
  add column if not exists autorizada_en timestamptz,
  add column if not exists recibido_de uuid references cajas(id);
update cajas set estado = 'conciliado' where cerrada_en is not null and estado = 'abierto';
update cajas c set registradora_id = (select id from cajas_registradoras r where r.almacen_id = c.almacen_id order by creado_en limit 1)
where registradora_id is null;

create table if not exists conteos_caja (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references cajas(id),
  tipo text not null check (tipo in ('apertura', 'cierre', 'fondo_siguiente', 'recepcion_cambio_turno', 'retiro', 'recuento_retiro', 'recuento_sobre')),
  usuario_id uuid not null references usuarios_internos(id),
  lineas jsonb not null,             -- [{ "d": 500, "piezas": 3 }]
  total numeric(12,2) not null,      -- lo calcula el sistema
  corrige_a uuid references conteos_caja(id),
  creado_en timestamptz not null default now()
);

create table if not exists retiros_caja (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  turno_id uuid not null references cajas(id),
  conteo_id uuid not null references conteos_caja(id),
  motivo text not null default 'envio_caja_fuerte',
  cajero_id uuid not null references usuarios_internos(id),
  autorizado_por uuid references usuarios_internos(id),
  recuento_id uuid references conteos_caja(id),
  creado_en timestamptz not null default now()
);
create sequence if not exists folio_retiro_seq;

create table if not exists sobres_fondo (
  id uuid primary key default gen_random_uuid(),
  folio_sello text not null,
  registradora_id uuid not null references cajas_registradoras(id),
  turno_cierre_id uuid not null references cajas(id),
  conteo_id uuid not null references conteos_caja(id),
  monto numeric(12,2) not null,
  usuario_id uuid not null references usuarios_internos(id),
  ubicacion text not null default 'caja fuerte',
  turno_apertura_id uuid references cajas(id),
  sello_integro boolean,
  creado_en timestamptz not null default now()
);

create table if not exists cierres_terminal (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references cajas(id),
  terminal_id uuid not null references terminales(id),
  total numeric(12,2) not null,
  transacciones int not null,
  foto_id uuid not null references archivos(id),
  usuario_id uuid not null references usuarios_internos(id),
  creado_en timestamptz not null default now()
);

alter table pagos
  add column if not exists terminal_id uuid references terminales(id),
  add column if not exists estado text not null default 'confirmado' check (estado in ('pendiente', 'confirmado', 'rechazado', 'expirado')),
  add column if not exists clave_rastreo text,
  add column if not exists banco_emisor text,
  add column if not exists confirmado_por uuid references usuarios_internos(id),
  add column if not exists confirmado_en timestamptz,
  add column if not exists vence_en timestamptz;

create table if not exists incidentes_caja (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid references cajas(id),
  tipo text not null check (tipo in ('diferencia_efectivo', 'diferencia_terminal', 'diferencia_apertura', 'diferencia_retiro', 'sello_roto', 'transferencia_manual', 'diferencia_cambio_turno')),
  monto numeric(12,2),
  detalle text,
  posible_metodo_mal_registrado boolean not null default false,
  responsable_id uuid references usuarios_internos(id),
  estado text not null default 'abierto' check (estado in ('abierto', 'resuelto')),
  resolucion text check (resolucion in ('error_captura', 'faltante_responsable', 'sobrante_cuenta', 'sello_roto_custodia', 'autorizado')),
  nota_resolucion text,
  resuelto_por uuid references usuarios_internos(id),
  resuelto_en timestamptz,
  creado_en timestamptz not null default now()
);

create table if not exists parametros_caja (
  clave text primary key,
  valor numeric not null,
  descripcion text not null,
  actualizado_por uuid references usuarios_internos(id),
  actualizado_en timestamptz not null default now()
);
insert into parametros_caja (clave, valor, descripcion) values
  ('fondo_fijo', 2000, 'Fondo fijo por caja (cambio)'),
  ('tolerancia_efectivo', 50, 'Tolerancia de diferencia en efectivo por turno'),
  ('tolerancia_terminal', 0, 'Tolerancia de diferencia en terminales'),
  ('umbral_retiro', 5000, 'Efectivo de venta en caja (sin fondo) que exige retiro parcial'),
  ('vigencia_transferencia_dias', 3, 'Vigencia de la referencia de transferencia (días naturales)'),
  ('horas_maximas_turno', 9, 'Horas de turno abierto antes de alertar'),
  ('minutos_retiro', 15, 'Minutos para hacer el retiro antes de avisar al supervisor')
on conflict (clave) do nothing;

create table if not exists bitacora_caja (
  id bigint generated always as identity primary key,
  usuario_id uuid references usuarios_internos(id),
  accion text not null,
  turno_id uuid references cajas(id),
  detalle jsonb,
  dispositivo text,
  creado_en timestamptz not null default now()
);
create index if not exists bitacora_caja_fecha on bitacora_caja (creado_en desc);

-- Registros inmutables: conteos, retiros, sobres, cierres de terminal y bitácora no se editan ni se borran.
create or replace function prohibir_cambios() returns trigger language plpgsql as $$
begin
  raise exception 'Registro de caja inmutable: % no se puede % (haz una corrección ligada)', tg_table_name, lower(tg_op);
end $$;
do $$
declare t text;
begin
  foreach t in array array['conteos_caja', 'retiros_caja', 'cierres_terminal', 'bitacora_caja'] loop
    execute format('drop trigger if exists %I_inmutable on %I', t, t);
    execute format('create trigger %I_inmutable before update or delete on %I for each row execute function prohibir_cambios()', t, t);
  end loop;
end $$;
-- Sobres: solo se permite registrar UNA vez su apertura (turno que lo recibe y si el sello estaba íntegro).
create or replace function sobre_solo_apertura() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Sobre de fondo inmutable'; end if;
  if old.turno_apertura_id is not null or new.folio_sello <> old.folio_sello or new.monto <> old.monto
     or new.conteo_id <> old.conteo_id or new.turno_cierre_id <> old.turno_cierre_id then
    raise exception 'Sobre de fondo inmutable';
  end if;
  return new;
end $$;
drop trigger if exists sobres_fondo_inmutable on sobres_fondo;
create trigger sobres_fondo_inmutable before update or delete on sobres_fondo for each row execute function sobre_solo_apertura();

do $$
declare t text;
begin
  foreach t in array array['cajas_registradoras', 'terminales', 'caja_terminales', 'conteos_caja', 'retiros_caja', 'sobres_fondo',
                           'cierres_terminal', 'incidentes_caja', 'parametros_caja', 'bitacora_caja'] loop
    execute format('alter table %I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on %I from anon, authenticated', t);
    end if;
  end loop;
end $$;
