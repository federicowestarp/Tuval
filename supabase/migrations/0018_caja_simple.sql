-- 0018 · Caja simplificada: el fondo se queda en la caja (sin sobres), PIN para cambiar de usuario rápido,
-- terminales conectadas a la app (sin cierre de lote) y avisos de diferencias dentro de tolerancia.
alter table usuarios_internos add column if not exists pin_hash text;
alter table terminales add column if not exists integrada boolean not null default false;
alter table incidentes_caja add column if not exists dentro_tolerancia boolean not null default false;
