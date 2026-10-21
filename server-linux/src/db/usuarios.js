import { pool } from './conexion.js';

// Cuentas de la app. "Contrasena" y "CodigoRecuperacion" guardan hashes scrypt, nunca el valor.
// "Secreto2FA" guarda el secreto TOTP cifrado con AES-256-GCM (NULL = falta vincular la app autenticadora).

export async function crearUsuario({ usuario, nombre, paterno, materno, contrasena, codigoRecuperacion }) {
  const { rows } = await pool.query(
    `INSERT INTO "Usuarios" ("Usuario", "Nombre", "Paterno", "Materno", "Contrasena", "CodigoRecuperacion")
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING "Id" AS id`,
    [usuario, nombre, paterno, materno, contrasena, codigoRecuperacion],
  );
  return rows[0];
}

export async function buscarUsuario(usuario) {
  const { rows } = await pool.query(
    `SELECT "Usuario" AS usuario, "Nombre" AS nombre, "Paterno" AS paterno, "Materno" AS materno,
            "Contrasena" AS contrasena, "CodigoRecuperacion" AS "codigoRecuperacion", "Secreto2FA" AS "secreto2fa"
       FROM "Usuarios"
      WHERE "Usuario" = $1`,
    [usuario],
  );
  return rows[0] ?? null;
}

/** Cambia la contraseña y desvincula la app autenticadora (por si se perdió el teléfono). */
export async function cambiarContrasena(usuario, contrasena) {
  await pool.query(`UPDATE "Usuarios" SET "Contrasena" = $2, "Secreto2FA" = NULL WHERE "Usuario" = $1`, [usuario, contrasena]);
}

/** Vincula la app autenticadora; false si ya estaba vinculada (no se sobrescribe). */
export async function guardarSecreto2FA(usuario, secretoCifrado) {
  const { rowCount } = await pool.query(
    `UPDATE "Usuarios" SET "Secreto2FA" = $2 WHERE "Usuario" = $1 AND "Secreto2FA" IS NULL`,
    [usuario, secretoCifrado],
  );
  return rowCount === 1;
}

/** El usuario ya existía (violación del índice único). */
export const esUsuarioDuplicado = (error) => error?.code === '23505';
