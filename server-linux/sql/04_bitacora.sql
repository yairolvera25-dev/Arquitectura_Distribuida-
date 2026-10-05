-- Respaldo de la bitácora (logs) de la app: cada evento que la app decide respaldar.
--   sudo -u postgres psql -d UPP -f sql/04_bitacora.sql
-- deploy/instalar.sh ya lo ejecuta solo. Se puede repetir sin problema.

CREATE TABLE IF NOT EXISTS "Bitacora" (
  "Id"            SERIAL PRIMARY KEY,
  "Usuario"       VARCHAR(50)   NOT NULL,
  "FechaEvento"   TIMESTAMP     NOT NULL,
  "Nivel"         VARCHAR(10)   NOT NULL,
  "Origen"        VARCHAR(20)   NOT NULL,
  "Mensaje"       VARCHAR(500)  NOT NULL,
  "Detalle"       VARCHAR(1000),
  "Orden"         VARCHAR(300),
  "FechaRespaldo" TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "Bitacora" OWNER TO upp_admin;

-- El servicio web solo puede leer y agregar eventos (no borrarlos ni modificarlos).
GRANT SELECT, INSERT ON "Bitacora" TO upp_api;
GRANT USAGE ON SEQUENCE "Bitacora_Id_seq" TO upp_api;
