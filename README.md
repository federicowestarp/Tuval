# Tuval

App de Tuval: tubería, equipos y eléctrico. Todo, a tiempo.

Una sola app (PWA) para clientes (plomeros y empresas), choferes y equipo interno, con un solo inventario para todos los canales.

- Especificación y decisiones: [`docs/ESPECIFICACION.md`](docs/ESPECIFICACION.md)
- Modelo de datos: [`supabase/migrations/0001_esquema_inicial.sql`](supabase/migrations/0001_esquema_inicial.sql)

## Correr en local

```bash
npm install
npm run dev
```

Abre http://localhost:3000. Rutas de demostración: `/` (catálogo y búsqueda) y `/pedido/DEMO-0001` (seguimiento).

El catálogo actual es de demostración, sin precios ni SKU reales.
