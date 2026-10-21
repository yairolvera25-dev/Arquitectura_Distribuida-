-- Verificación en dos pasos (TOTP con Google Authenticator o Microsoft Authenticator).
-- Se ejecuta después de 03_usuarios.sql:
--   sudo -u postgres psql -d UPP -f sql/05_2fa.sql
-- deploy/instalar.sh ya lo ejecuta solo. Se puede repetir sin problema.
--
-- "Secreto2FA" guarda el secreto TOTP cifrado con AES-256-GCM (aes256gcm$iv$etiqueta$datos), nunca
-- en texto. NULL = la cuenta todavía no vincula su app autenticadora; se hace al iniciar sesión.

ALTER TABLE "Usuarios" ADD COLUMN IF NOT EXISTS "Secreto2FA" VARCHAR(255);

-- El servicio web puede vincular la app (y desvincularla al restablecer la contraseña).
GRANT UPDATE ("Secreto2FA") ON "Usuarios" TO upp_api;
