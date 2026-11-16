alter table direcciones add column if not exists entidad text;   -- estado de la república
alter table pedidos add column if not exists entidad text;
alter table contactos_web add column if not exists entidad text;
update direcciones set entidad = case when zona = 'tlaxcala' then 'Tlaxcala' else 'Puebla' end where entidad is null;
update pedidos set entidad = case when zona = 'tlaxcala' then 'Tlaxcala' when zona is not null then 'Puebla' end where entidad is null;
