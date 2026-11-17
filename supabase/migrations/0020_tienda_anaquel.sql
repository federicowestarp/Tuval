-- Tienda física: etiquetas de anaquel, carrito para pagar en caja, chequeos aleatorios y surtido guiado.

-- Precio con IVA con el que se imprimió la etiqueta de cada producto (para avisar cuándo reimprimir).
create table if not exists etiquetas_impresas (
  producto_id uuid primary key references productos(id) on delete cascade,
  precio numeric,
  nombre text,
  impresa_en timestamptz not null default now(),
  impresa_por uuid references usuarios_internos(id)
);

-- Carrito que el cliente arma en la tienda escaneando etiquetas y enseña en caja (QR o código corto).
create table if not exists carritos_tienda (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  lineas jsonb not null,
  cuenta_id uuid references cuentas(id),
  creado_en timestamptz not null default now(),
  cobrado_en timestamptz,
  pedido_id uuid references pedidos(id)
);

-- Chequeo aleatorio de anaquel: conteo ciego de unos cuantos productos al día. No ajusta solo: lo revisa supervisión.
create table if not exists chequeos_anaquel (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id),
  almacen_id uuid not null references almacenes(id),
  fecha date not null default (now() at time zone 'America/Mexico_City')::date,
  esperado numeric,
  contado numeric,
  etiqueta_ok boolean,
  usuario_id uuid references usuarios_internos(id),
  contado_en timestamptz,
  revisado_en timestamptz,
  revisado_por uuid references usuarios_internos(id),
  resolucion text check (resolucion in ('ajustado', 'sin_ajuste')),
  unique (producto_id, almacen_id, fecha)
);

-- Plano: posición de cada ubicación (pasillo/anaquel en la cuadrícula; nivel = altura, 1 = el de abajo).
alter table ubicaciones add column if not exists orden int;

-- Surtido guiado: el pedido queda "por surtir en sucursal" y cada pieza se descuenta al escanearla.
alter table pedidos add column if not exists surtir_en_sucursal_desde timestamptz;

insert into parametros_operacion (clave, valor, descripcion, supuesto) values
  ('chequeos_por_dia', 5, 'Productos al azar para chequeo de anaquel cada día', true)
on conflict (clave) do nothing;

do $$
declare t text;
begin
  foreach t in array array['etiquetas_impresas', 'carritos_tienda', 'chequeos_anaquel'] loop
    execute format('alter table %I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on %I from anon, authenticated', t); end if;
  end loop;
end $$;
