# Tuval

App de Tuval: tubería, equipos y eléctrico. Todo, a tiempo.

Una sola app (PWA) para clientes (plomeros y empresas), choferes y equipo interno, con un solo inventario para todos los canales.

- Especificación y decisiones: [`docs/ESPECIFICACION.md`](docs/ESPECIFICACION.md)
- Modelo de datos: [`supabase/migrations/`](supabase/migrations/) · datos de demostración: [`supabase/seed.sql`](supabase/seed.sql)

## Rutas

| Ruta | Para quién | Qué hace |
|---|---|---|
| `/` | Cliente | Catálogo, búsqueda por medida o SKU, categorías |
| `/carrito` | Cliente | Carrito, datos de entrega, factura o nota, hace el pedido |
| `/pedido/[id]` | Cliente | Seguimiento: recibido → preparando → en ruta → entregado |
| `/interno/pedidos` | Equipo Tuval | Pedidos del día y avance de estado (**sin inicio de sesión todavía**) |

## Correr en local

Requiere Postgres 14+ con la extensión `unaccent` (Supabase la trae).

```bash
npm install
cp .env.example .env.local          # y pon tu DATABASE_URL
psql "$DATABASE_URL" -f supabase/migrations/0001_esquema_inicial.sql
psql "$DATABASE_URL" -f supabase/migrations/0002_pedido_en_linea.sql
psql "$DATABASE_URL" -f supabase/seed.sql   # opcional: productos de demostración
npm run dev
npm test                             # reglas de hora de corte
```

El catálogo de demostración no tiene precios: aparecen como "Precio por confirmar" hasta cargar la lista de Emmsa.
