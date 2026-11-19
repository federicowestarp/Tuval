-- Piezas buscadas en la tienda que no tenemos: el cliente puede dejar su celular para que le avisemos.
alter table solicitudes_producto add column if not exists contacto_telefono text;
alter table solicitudes_producto add column if not exists atendida_en timestamptz;
