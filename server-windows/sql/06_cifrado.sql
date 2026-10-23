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

-- Las columnas que ahora van cifradas deben aceptar NULL. Si la tabla se creó con ellas en NOT NULL,
-- el INSERT de la API falla (error 515 → HTTP 500). Se conserva el tipo actual de cada columna.
DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql += N'ALTER TABLE dbo.Georreferencia ALTER COLUMN ' + QUOTENAME(c.name) + N' '
  + CASE WHEN t.name IN (N'nvarchar', N'nchar')
           THEN t.name + N'(' + CAST(c.max_length / 2 AS NVARCHAR(10)) + N') COLLATE ' + c.collation_name
         WHEN t.name IN (N'varchar', N'char')
           THEN t.name + N'(' + CAST(c.max_length AS NVARCHAR(10)) + N') COLLATE ' + c.collation_name
         WHEN t.name IN (N'decimal', N'numeric')
           THEN t.name + N'(' + CAST(c.precision AS NVARCHAR(10)) + N',' + CAST(c.scale AS NVARCHAR(10)) + N')'
         ELSE t.name END
  + N' NULL;' + NCHAR(10)
  FROM sys.columns c
  JOIN sys.types t ON t.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID(N'dbo.Georreferencia')
   AND c.name IN (N'Estado', N'Municipio', N'Latitud', N'Longitud', N'Temperatura', N'Humedad', N'Viento')
   AND c.is_nullable = 0;
IF @sql <> N'' EXEC sys.sp_executesql @sql;
GO

-- Comprobación: los registros nuevos deben verse así.
--   SELECT TOP 5 Id, Usuario, Municipio, Temperatura, Cifrado FROM dbo.Georreferencia ORDER BY Id DESC;
--   → Municipio y Temperatura en NULL, y Cifrado = aes256gcm$…$…
