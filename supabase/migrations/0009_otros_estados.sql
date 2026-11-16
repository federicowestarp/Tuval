-- Tuval · pedidos desde cualquier estado: se guarda la entidad para ver de dónde llega la demanda
alter type zona_entrega add value if not exists 'otro';
