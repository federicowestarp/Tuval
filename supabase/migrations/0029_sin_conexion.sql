-- Modo sin conexión: cada cambio hecho sin señal llega con un id único generado en el teléfono.
-- Si el teléfono lo reenvía (porque no supo si llegó), aquí se detecta y no se aplica dos veces.
create table if not exists cambios_sin_conexion (
  id uuid primary key,
  usuario_id uuid references usuarios_internos(id),
  accion text not null,
  ocurrido_en timestamptz,
  recibido_en timestamptz not null default now(),
  resultado jsonb
);
create index if not exists cambios_sin_conexion_usuario on cambios_sin_conexion (usuario_id, recibido_en desc);
