-- Usuario que usa el servicio web para conectarse a PostgreSQL.
-- Principio de menor privilegio: solo puede LEER e INSERTAR en Georreferencia
-- (no puede borrar, modificar ni crear tablas) y solo se conecta desde localhost.
--
-- Ejecutar en el servidor Ubuntu:
--   sudo -u postgres psql -d UPP -f sql/02_usuario_api.sql
--
-- El rol se crea SIN contraseña, así que todavía no puede conectarse.
-- Hay que asignársela aparte, abriendo psql y usando \password, que la pide
-- por teclado y no la deja en el historial del shell:
--   sudo -u postgres psql -d UPP
--   \password upp_api
--   \q
--
-- No uses  psql -c "\password upp_api" : con -c el comando no es interactivo
-- y no llega a pedir nada. Si prefieres una sola línea, usa ALTER ROLE
-- (queda en el historial de bash, bórralo después):
--   sudo -u postgres psql -d UPP -c "ALTER ROLE upp_api WITH PASSWORD 'la-que-elegiste'"
--
-- Esa misma contraseña va en DB_PASSWORD del .env, ENTRE COMILLAS DOBLES.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'upp_api') THEN
    CREATE ROLE upp_api WITH LOGIN;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE "UPP" TO upp_api;
GRANT USAGE ON SCHEMA public TO upp_api;
GRANT SELECT, INSERT ON "Georreferencia" TO upp_api;
GRANT USAGE ON SEQUENCE "Georreferencia_Id_seq" TO upp_api;
