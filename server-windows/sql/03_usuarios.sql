-- Cuentas de la app (inicio de sesión). Ejecutar en SSMS conectado como administrador,
-- después de 02_usuario_api.sql. Se puede repetir sin problema.
--
-- Contrasena guarda el hash scrypt (formato scrypt$N$r$p$sal$hash), nunca la contraseña.
-- Usuario se guarda siempre en minúsculas y es único.

USE UPP;
GO

IF OBJECT_ID(N'dbo.Usuarios', N'U') IS NULL
CREATE TABLE dbo.Usuarios (
  Id            INT IDENTITY(1,1) PRIMARY KEY,
  Usuario       NVARCHAR(50)  NOT NULL CONSTRAINT UQ_Usuarios_Usuario UNIQUE,
  Nombre        NVARCHAR(50)  NOT NULL,
  Paterno       NVARCHAR(50)  NULL,
  Materno       NVARCHAR(50)  NULL,
  Contrasena    NVARCHAR(255) NOT NULL,
  FechaRegistro DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);
GO

-- El servicio web solo puede leer y crear cuentas (no borrarlas ni modificarlas).
GRANT SELECT, INSERT ON dbo.Usuarios TO upp_api;
GO
