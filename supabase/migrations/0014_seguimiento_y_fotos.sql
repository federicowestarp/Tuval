-- 0014 · Seguimiento de cotizaciones (recordatorios al cliente, reconfirmar con el proveedor).
-- El archivo no borra nada: es una vista por antigüedad (ver src/lib/seguimiento.ts).
alter table pedidos
  add column if not exists recordatorios int not null default 0,
  add column if not exists recordado_en timestamptz,
  add column if not exists reconfirmado_en timestamptz;

create index if not exists pedidos_estado_creado on pedidos (estado, creado_en desc);
create index if not exists pedido_eventos_pedido on pedido_eventos (pedido_id, creado_en desc);
create index if not exists cotizaciones_pedido on cotizaciones_proveedor (pedido_id, cargada_en desc);
