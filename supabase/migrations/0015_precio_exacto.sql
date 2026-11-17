-- 0015 · Precio por renglón con 6 decimales: un precio capturado con IVA ($500) se guarda sin IVA
-- sin perder centavos (431.034483 × 1.16 = 500.00).
alter table pedido_partidas alter column precio_unitario type numeric(16,6);
