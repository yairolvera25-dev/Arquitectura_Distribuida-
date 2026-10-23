-- Cifrado AES-256-GCM de los registros del clima (Actividad 2, Parcial 2 — Ruta A).
-- Ejecutar en SSMS conectado como administrador, después de 01_tabla.sql. Se puede repetir sin problema.
--
-- La API guarda estado, municipio, coordenadas, temperatura, humedad y viento en la columna Cifrado
-- (aes256gcm$nonce$cifrado, en Base64) y deja en NULL sus columnas en texto. Usuario, Nombre y
-- FechaHora siguen en claro para poder filtrar por ellos.
-- upp_api ya tiene SELECT e INSERT sobre toda la tabla, así que no hace falta otro GRANT.

USE UPP;
GO

IF COL_LENGTH(N'dbo.Georreferencia', N'Cifrado') IS NULL
  ALTER TABLE dbo.Georreferencia ADD Cifrado NVARCHAR(MAX) NULL;
GO

-- Comprobación: los registros nuevos deben verse así.
--   SELECT TOP 5 Id, Usuario, Municipio, Temperatura, Cifrado FROM dbo.Georreferencia ORDER BY Id DESC;
--   → Municipio y Temperatura en NULL, y Cifrado = aes256gcm$…$…
