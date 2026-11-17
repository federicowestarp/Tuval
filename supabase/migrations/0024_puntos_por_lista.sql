-- Puntos y recomendados solo para clientes cuya lista de precios lo permite:
-- Público y Plomero / Contratista sí; Obra / Constructora no (ya tiene mejor precio).
alter table listas_precio add column if not exists acumula_puntos boolean not null default true;
update listas_precio set acumula_puntos = false where nombre = 'Obra / Constructora';
