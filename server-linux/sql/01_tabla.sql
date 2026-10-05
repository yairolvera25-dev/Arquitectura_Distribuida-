-- Base UPP y tabla Georreferencia (igual que en la Actividad 2).
-- Ya existe en el servidor; este script solo sirve para recrearla desde cero.
-- Ejecutar: sudo -u postgres psql -f sql/01_tabla.sql

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
