-- Cuentas de la app (inicio de sesión). Se ejecuta después de 02_usuario_api.sql:
--   sudo -u postgres psql -d UPP -f sql/03_usuarios.sql
-- deploy/instalar.sh ya lo ejecuta solo. Se puede repetir sin problema.
--
-- "Contrasena" y "CodigoRecuperacion" guardan hashes scrypt (scrypt$N$r$p$sal$hash), nunca el valor.
-- "Usuario" se guarda siempre en minúsculas y es único.

CREATE TABLE IF NOT EXISTS "Usuarios" (
  "Id"            SERIAL PRIMARY KEY,
  "Usuario"       VARCHAR(50)  NOT NULL UNIQUE,
  "Nombre"        VARCHAR(50)  NOT NULL,
  "Paterno"       VARCHAR(50),
  "Materno"       VARCHAR(50),
  "Contrasena"    VARCHAR(255) NOT NULL,
  "CodigoRecuperacion" VARCHAR(255),
  "FechaRegistro" TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "Usuarios" OWNER TO upp_admin;
-- Instalaciones anteriores a "restablecer contraseña" no tienen la columna.
ALTER TABLE "Usuarios" ADD COLUMN IF NOT EXISTS "CodigoRecuperacion" VARCHAR(255);

-- El servicio web puede leer y crear cuentas, y cambiar SOLO la contraseña (para restablecerla).
-- No puede borrar cuentas ni cambiar ningún otro dato.
GRANT SELECT, INSERT ON "Usuarios" TO upp_api;
GRANT UPDATE ("Contrasena") ON "Usuarios" TO upp_api;
GRANT USAGE ON SEQUENCE "Usuarios_Id_seq" TO upp_api;
