-- Base UPP y tabla Georreferencia. Ya existe en el servidor desde la
-- Actividad 2; este script solo sirve para recrearla desde cero.
-- Ejecutar: sudo -u postgres psql -f sql/01_tabla.sql
--
-- Nota: los anchos de aquí (50) son los del contrato, iguales a los del
-- servidor Windows y a los que valida la API. La tabla que ya está instalada
-- en la VM se creó con VARCHAR(80) en Nombre, Paterno, Materno y Estado, y
-- con Nombre aceptando nulos. Es compatible -- la API nunca deja pasar más de
-- 50 caracteres ni un Nombre vacío -- pero por eso un CREATE desde cero no
-- sale idéntico a la tabla en producción. No hace falta migrar nada.

SELECT 'CREATE DATABASE "UPP" OWNER upp_admin'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'UPP')\gexec

\c UPP

CREATE TABLE IF NOT EXISTS "Georreferencia" (
  "Id"          SERIAL PRIMARY KEY,
  "Usuario"     VARCHAR(50)  NOT NULL,
  "Nombre"      VARCHAR(50)  NOT NULL,
  "Paterno"     VARCHAR(50),
  "Materno"     VARCHAR(50),
  "Estado"      VARCHAR(50),
  "Municipio"   VARCHAR(80),
  "Latitud"     NUMERIC(10,6),
  "Longitud"    NUMERIC(10,6),
  "Temperatura" NUMERIC(5,2),
  "Humedad"     NUMERIC(5,2),
  "Viento"      NUMERIC(5,2),
  "FechaHora"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "Georreferencia" OWNER TO upp_admin;
