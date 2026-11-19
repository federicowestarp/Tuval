-- Compras a varios proveedores: cada partida del pedido se compra al proveedor elegido (el de mejor cotización por default).
alter table pedido_partidas add column if not exists proveedor_id uuid references proveedores(id);
