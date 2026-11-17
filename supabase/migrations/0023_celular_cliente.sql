-- Clientes identificados por celular: se verifica en persona en caja (sin costo de SMS/WhatsApp),
-- y desde caja se le da acceso a su cuenta en su propio celular con un QR de un solo uso.
alter table cuentas add column if not exists telefono_verificado_en timestamptz;
create index if not exists clientes_telefono on clientes (telefono);

create table if not exists accesos_cuenta (
  token_hash text primary key,
  cuenta_id uuid not null references cuentas(id) on delete cascade,
  creado_por uuid references usuarios_internos(id),
  expira_en timestamptz not null,
  usado_en timestamptz
);
alter table accesos_cuenta enable row level security;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on accesos_cuenta from anon, authenticated; end if;
end $$;

-- Programa de recomendados: interruptor y tope mensual por cliente que recomienda (supuestos hasta confirmar).
insert into parametros_operacion (clave, valor, descripcion, supuesto) values
  ('recomendados_activo', 0, 'Programa de recomendados: 1 = activo, 0 = en pausa', true),
  ('recomendados_max_mes', 5, 'Máximo de recompensas por recomendar que un cliente puede ganar al mes', true)
on conflict (clave) do nothing;
