import postgres from "postgres";

const g = globalThis as unknown as { sql?: postgres.Sql };

/** Conexión única a Postgres (Supabase en producción). Solo se usa en el servidor. */
export const sql =
  g.sql ??
  postgres(process.env.DATABASE_URL ?? "", {
    max: 5,
    // Supabase en Vercel: usar el pooler en modo transacción (puerto 6543), que no admite consultas preparadas.
    prepare: false,
    types: { numeric: { to: 1700, from: [1700], serialize: String, parse: Number } },
  });

if (process.env.NODE_ENV !== "production") g.sql = sql;
