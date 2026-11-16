-- Tuval · fase 1: pedido en línea con surtido desde Emmsa

create extension if not exists unaccent;

create type zona_entrega as enum ('puebla', 'atlixco', 'tlaxcala');
create type ventana_entrega as enum ('manana', 'tarde');

-- Precio puede faltar mientras no tengamos la lista de Emmsa: el pedido queda "por confirmar precio".
alter table pedido_partidas alter column precio_unitario drop not null;

alter table pedidos
  add column zona zona_entrega,
  add column entrega_fecha date,
  add column entrega_ventana ventana_entrega,
  add column contacto_nombre text,
  add column contacto_telefono text,
  add column sin_recepcion_solicitada boolean not null default false,
  add column notas text;

create sequence folio_pedido_seq start 1;

-- Almacenes de Emmsa (proveedor). Coordenadas pendientes: se capturan del mapa, no se inventan.
insert into almacenes (nombre, tipo, direccion) values
  ('Emmsa · Bodega ciudad', 'proveedor', 'C. 25 Sur 1902 B, Sta Cruz los Ángeles, 72400 Heroica Puebla de Zaragoza, Pue.'),
  ('Emmsa · Corredor Industrial La Ciénega', 'proveedor', 'Calle L 7b, Corredor Industrial la Ciénega, 72225 Heroica Puebla de Zaragoza, Pue.');

insert into proveedores (nombre, almacen_id, dias_credito, contacto)
select 'Emmsa', id, 30, 'Bodega ciudad 222 295 9451 · La Ciénega 222 141 9800'
from almacenes where nombre = 'Emmsa · Bodega ciudad';

insert into listas_precio (nombre) values ('Público');
