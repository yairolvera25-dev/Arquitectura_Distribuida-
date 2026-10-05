-- Respaldo de la bitácora (logs) de la app. Ejecutar en SSMS conectado como administrador,
-- después de 03_usuarios.sql. Se puede repetir sin problema.

USE UPP;
GO

IF OBJECT_ID(N'dbo.Bitacora', N'U') IS NULL
CREATE TABLE dbo.Bitacora (
  Id            INT IDENTITY(1,1) PRIMARY KEY,
  Usuario       NVARCHAR(50)   NOT NULL,
  FechaEvento   DATETIME2      NOT NULL,
  Nivel         NVARCHAR(10)   NOT NULL,
  Origen        NVARCHAR(20)   NOT NULL,
  Mensaje       NVARCHAR(500)  NOT NULL,
  Detalle       NVARCHAR(1000) NULL,
  Orden         NVARCHAR(300)  NULL,
  FechaRespaldo DATETIME2      NOT NULL DEFAULT SYSDATETIME()
);
GO

-- El servicio web solo puede leer y agregar eventos (no borrarlos ni modificarlos).
GRANT SELECT, INSERT ON dbo.Bitacora TO upp_api;
GO
