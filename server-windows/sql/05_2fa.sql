-- Verificación en dos pasos (TOTP con Google Authenticator o Microsoft Authenticator).
-- Ejecutar en SSMS conectado como administrador, después de 03_usuarios.sql. Se puede repetir sin problema.
--
-- Secreto2FA guarda el secreto TOTP cifrado con AES-256-GCM (aes256gcm$iv$etiqueta$datos), nunca
-- en texto. NULL = la cuenta todavía no vincula su app autenticadora; se hace al iniciar sesión.

USE UPP;
GO

IF COL_LENGTH(N'dbo.Usuarios', N'Secreto2FA') IS NULL
  ALTER TABLE dbo.Usuarios ADD Secreto2FA NVARCHAR(255) NULL;
GO

-- El servicio web puede vincular la app (y desvincularla al restablecer la contraseña).
GRANT UPDATE (Secreto2FA) ON dbo.Usuarios TO upp_api;
GO
