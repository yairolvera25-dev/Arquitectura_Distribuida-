-- Cifrado híbrido AES + RSA de los registros del clima (Actividad 2, Parcial 2 — Ruta A).
-- Ejecutar: sudo -u postgres psql -d UPP -f sql/06_cifrado.sql   (deploy/instalar.sh ya lo hace)
-- Se puede repetir sin problema.
--
-- La API guarda estado, municipio, coordenadas, temperatura, humedad y viento en la columna "Cifrado"
-- (rsaoaep+aes256gcm$clave$nonce$cifrado, en Base64) y deja en NULL sus columnas en texto.
-- "Usuario", "Nombre" y "FechaHora" siguen en claro para poder filtrar por ellos.
-- upp_api ya tiene SELECT e INSERT sobre toda la tabla, así que no hace falta otro GRANT.

ALTER TABLE "Georreferencia" ADD COLUMN IF NOT EXISTS "Cifrado" TEXT;

-- Comprobación: los registros nuevos deben verse así.
--   SELECT "Id", "Usuario", "Municipio", "Temperatura", left("Cifrado", 60)
--     FROM "Georreferencia" ORDER BY "Id" DESC LIMIT 5;
--   → "Municipio" y "Temperatura" vacíos, y "Cifrado" = rsaoaep+aes256gcm$…
