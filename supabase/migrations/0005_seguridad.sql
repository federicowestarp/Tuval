-- Tuval · seguridad en Supabase
-- Supabase publica el esquema "public" por su API REST con la llave anónima. La app NO usa esa API:
-- se conecta directo a Postgres desde el servidor. Se activa RLS sin políticas en todas las tablas
-- para que nadie pueda leer ni escribir por la API pública (el servidor, como dueño, no se ve afectado).
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- Los roles anon/authenticated solo existen en Supabase.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon, authenticated;
    revoke all on all sequences in schema public from anon, authenticated;
  end if;
end $$;
