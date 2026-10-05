-- Base UPP y tabla Georreferencia (igual que en la Actividad 2).
-- Ya existe en el servidor; este script solo sirve para recrearla desde cero.
-- Ejecutar en SSMS conectado como administrador.

IF DB_ID(N'UPP') IS NULL
  CREATE DATABASE UPP;
GO

USE UPP;
GO

IF OBJECT_ID(N'dbo.Georreferencia', N'U') IS NULL
CREATE TABLE dbo.Georreferencia (
  Id          INT IDENTITY(1,1) PRIMARY KEY,
  Usuario     NVARCHAR(50)  NOT NULL,
  Nombre      NVARCHAR(50)  NOT NULL,
  Paterno     NVARCHAR(50)  NULL,
  Materno     NVARCHAR(50)  NULL,
  Estado      NVARCHAR(50)  NULL,
  Municipio   NVARCHAR(80)  NULL,
  Latitud     DECIMAL(10,6) NULL,
  Longitud    DECIMAL(10,6) NULL,
  Temperatura DECIMAL(5,2)  NULL,
  Humedad     DECIMAL(5,2)  NULL,
  Viento      DECIMAL(5,2)  NULL,
  FechaHora   DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);
GO
