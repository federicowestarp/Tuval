-- Tuval · tablero: flotilla, gastos, nómina, cobros y motivos de cancelación

create table if not exists vehiculos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,                       -- "Camioneta 1", "Moto 2"
  tipo text not null check (tipo in ('camioneta', 'moto', 'camion', 'auto')),
  placas text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
alter table rutas add column if not exists vehiculo_id uuid references vehiculos(id);

create table if not exists empleados (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  puesto text,
  usuario_id uuid references usuarios_internos(id),
  sueldo numeric(12,2),                       -- por periodo
  periodicidad text not null default 'quincenal' check (periodicidad in ('semanal', 'quincenal', 'mensual')),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table if not exists gastos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default (now() at time zone 'America/Mexico_City')::date,
  categoria text not null check (categoria in ('combustible', 'mantenimiento', 'seguro', 'casetas', 'nomina', 'renta', 'servicios', 'marketing', 'compras', 'otros')),
  concepto text not null,
  monto numeric(12,2) not null check (monto > 0),   -- total pagado, IVA incluido
  vehiculo_id uuid references vehiculos(id),
  empleado_id uuid references empleados(id),
  forma_pago text,
  comprobante_id uuid references archivos(id),
  creado_por uuid references usuarios_internos(id),
  creado_en timestamptz not null default now()
);
create index if not exists gastos_fecha on gastos (fecha);

alter table pedidos add column if not exists motivo_cancelacion text;
alter table pagos add column if not exists registrado_por uuid references usuarios_internos(id);

alter table vehiculos enable row level security;
alter table empleados enable row level security;
alter table gastos enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on vehiculos, empleados, gastos from anon, authenticated;
  end if;
end $$;
