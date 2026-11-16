# Tuval

App de Tuval: tubería, equipos y eléctrico. Todo, a tiempo.

Una sola app (PWA) para clientes (plomeros y empresas), choferes y equipo interno, con un solo inventario para todos los canales.

- Especificación y decisiones: [`docs/ESPECIFICACION.md`](docs/ESPECIFICACION.md)
- Modelo de datos: [`supabase/migrations/`](supabase/migrations/) · datos de demostración: [`supabase/seed.sql`](supabase/seed.sql)

## Rutas

| Ruta | Para quién | Qué hace |
|---|---|---|
| `/` | Público | Página de Internet: propuesta, cómo funciona, obras, horarios, buscador |
| `/obras` | Público | Página para constructoras con formulario de contacto |
| `/producto/[sku]` | Público | Ficha de producto (destino de los QR de anaquel) |
| `/tienda` | Cliente | Catálogo; buscador único (escribir, pegar lista o foto); "pídelo y lo buscamos" |
| `/cuenta`, `/cuenta/pedidos` | Cliente | Cuenta y pedidos del cliente |
| `/lista` | Cliente | Pedir con lista escrita (busca en catálogo) o foto/PDF adjunta |
| `/cuenta/direcciones` | Cliente | Direcciones guardadas: obra/particular, mapa, foto de fachada, quién recibe |
| `/carrito` | Cliente | Envío a dirección guardada o recoger, factura o nota, enviar pedido |
| `/pedido/[id]` | Cliente | Seguimiento y botón para compartir el acceso de entrega con quien recibe |
| `/entrega/[token]` | Quien recibe | Seguimiento sin precios y confirmación de lo recibido (faltantes) |
| `/interno/entrar` | Equipo Tuval | Inicio de sesión (correo y contraseña; bloqueo tras 5 intentos) |
| `/interno/pedidos` | Equipo Tuval | Pedidos del día y avance de estado |
| `/interno/chofer` | Chofer / equipo | Ruta del día: salir a entregar, ubicación en vivo, entrega con foto y ubicación |
| `/interno/catalogo` | Administrador | Importar catálogo desde CSV (PurAqua, Emmsa u hoja propia) y quitar orígenes de la tienda |
| `/interno/contactos` | Equipo Tuval | Solicitudes de la página (Tuval Obra) |
| `/interno/equipo` | Administrador | Invitar usuarios (liga de un solo uso, 24 h) y darlos de baja |
| `/interno/pedidos/[id]` | Equipo Tuval | Cotización de Emmsa en PDF, comparación, confirmación y aviso por WhatsApp |
| `/interno/demanda` | Equipo Tuval | Lo que piden y no tenemos, agrupado; alta en catálogo |

## Correr en local

Requiere Postgres 14+ con la extensión `unaccent` (Supabase la trae).

```bash
npm install
cp .env.example .env.local          # y pon tu DATABASE_URL
psql "$DATABASE_URL" -f supabase/migrations/0001_esquema_inicial.sql
psql "$DATABASE_URL" -f supabase/migrations/0002_pedido_en_linea.sql
psql "$DATABASE_URL" -f supabase/migrations/0003_direcciones_demanda_cotizaciones.sql
psql "$DATABASE_URL" -f supabase/migrations/0004_cotizacion_pdf.sql
psql "$DATABASE_URL" -f supabase/migrations/0005_seguridad.sql
psql "$DATABASE_URL" -f supabase/migrations/0006_equipo.sql
psql "$DATABASE_URL" -f supabase/migrations/0007_catalogo_y_chofer.sql
psql "$DATABASE_URL" -f supabase/migrations/0008_catalogo_y_chofer_2.sql
psql "$DATABASE_URL" -f supabase/migrations/0009_otros_estados.sql
psql "$DATABASE_URL" -f supabase/migrations/0010_otros_estados_2.sql
psql "$DATABASE_URL" -f supabase/migrations/0011_municipio.sql
psql "$DATABASE_URL" -f supabase/seed.sql   # opcional: productos de demostración
npm run dev
npm test                             # hora de corte, lector de listas y de cotizaciones
```

El catálogo de demostración no tiene precios: aparecen como "Precio por confirmar" hasta cargar la lista de Emmsa.
