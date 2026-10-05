-- Cuentas de la app (inicio de sesión). Ejecutar en SSMS conectado como administrador,
-- después de 02_usuario_api.sql. Se puede repetir sin problema.
--
-- Contrasena y CodigoRecuperacion guardan hashes scrypt (scrypt$N$r$p$sal$hash), nunca el valor.
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
  CodigoRecuperacion NVARCHAR(255) NULL,
  FechaRegistro DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);
GO

-- Instalaciones anteriores a "restablecer contraseña" no tienen la columna.
IF COL_LENGTH(N'dbo.Usuarios', N'CodigoRecuperacion') IS NULL
  ALTER TABLE dbo.Usuarios ADD CodigoRecuperacion NVARCHAR(255) NULL;
GO

-- El servicio web puede leer y crear cuentas, y cambiar SOLO la contraseña (para restablecerla).
-- No puede borrar cuentas ni cambiar ningún otro dato.
GRANT SELECT, INSERT ON dbo.Usuarios TO upp_api;
GRANT UPDATE (Contrasena) ON dbo.Usuarios TO upp_api;
GO
