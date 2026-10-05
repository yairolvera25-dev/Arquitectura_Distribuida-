-- Login que usa el servicio web para conectarse a SQL Server.
-- Principio de menor privilegio: NO se usa "sa". Este login solo puede LEER e
-- INSERTAR en dbo.Georreferencia (no puede borrar, modificar ni crear tablas).
--
-- Ejecutar en SSMS conectado como administrador (sa o Administrador).
-- 1) Reemplaza <CONTRASEÑA_ROBUSTA> antes de ejecutar.
-- 2) NO guardes el archivo con la contraseña escrita ni la muestres en capturas.

USE master;
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'upp_api')
  CREATE LOGIN upp_api
    WITH PASSWORD = N'<CONTRASEÑA_ROBUSTA>',
         DEFAULT_DATABASE = UPP,
         CHECK_POLICY = ON;
GO

USE UPP;
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'upp_api')
  CREATE USER upp_api FOR LOGIN upp_api;
GO

GRANT SELECT, INSERT ON dbo.Georreferencia TO upp_api;
GO
