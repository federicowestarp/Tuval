-- Tuval · cotizaciones de Emmsa en PDF y productos por clasificar

insert into categorias (id, nombre, orden) values ('por_clasificar', 'Por clasificar', 99);

alter table cotizaciones_proveedor
  add column fecha_proveedor text,
  add column vigencia text,
  add column condiciones text,
  add column subtotal numeric(12,2),
  add column total numeric(12,2),
  add column cuadra boolean;

alter table cotizacion_partidas add column unidad text, add column dias_entrega int;
