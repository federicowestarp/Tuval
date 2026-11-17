-- Venta asistida: el vendedor arma el carrito con el cliente en su tablet y lo manda a caja; la venta queda a su nombre.
alter table carritos_tienda add column if not exists vendedor_id uuid references usuarios_internos(id);
alter table carritos_tienda add column if not exists cliente_id uuid references clientes(id);
