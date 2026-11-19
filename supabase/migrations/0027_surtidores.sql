-- Quién surte cada producto: principal (1) y alterno (2). Sirve para pedir cotización a cada proveedor solo con sus piezas
-- y para comprar al que sí tiene existencia.
alter table productos_proveedor add column if not exists preferencia smallint check (preferencia in (1, 2));
create unique index if not exists productos_proveedor_preferencia on productos_proveedor (producto_id, preferencia) where preferencia is not null;
-- Avisar al cliente cuando consigamos lo que no teníamos.
alter table solicitudes_producto add column if not exists avisado_en timestamptz;
