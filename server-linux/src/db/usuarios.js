import { pool } from './conexion.js';

// Cuentas de la app. "Contrasena" y "CodigoRecuperacion" guardan hashes scrypt, nunca el valor.

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
            "Contrasena" AS contrasena, "CodigoRecuperacion" AS "codigoRecuperacion"
       FROM "Usuarios"
      WHERE "Usuario" = $1`,
    [usuario],
  );
  return rows[0] ?? null;
}

export async function cambiarContrasena(usuario, contrasena) {
  await pool.query(`UPDATE "Usuarios" SET "Contrasena" = $2 WHERE "Usuario" = $1`, [usuario, contrasena]);
}

/** El usuario ya existía (violación del índice único). */
export const esUsuarioDuplicado = (error) => error?.code === '23505';
