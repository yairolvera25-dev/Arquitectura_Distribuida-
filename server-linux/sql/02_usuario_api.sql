-- Usuario que usa el servicio web para conectarse a PostgreSQL.
-- Principio de menor privilegio: solo puede LEER e INSERTAR en Georreferencia
-- (no puede borrar, modificar ni crear tablas) y solo se conecta desde localhost.
--
-- Ejecutar en el servidor Ubuntu:
--   sudo -u postgres psql -d UPP -f sql/02_usuario_api.sql
-- y después asignar la contraseña (no queda guardada en ningún archivo):
--   sudo -u postgres psql -c "\password upp_api"

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
