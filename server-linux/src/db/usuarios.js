import { pool } from './conexion.js';

// Cuentas de la app. La columna "Contrasena" guarda el hash scrypt, nunca la contraseña.

export async function crearUsuario({ usuario, nombre, paterno, materno, contrasena }) {
  const { rows } = await pool.query(
    `INSERT INTO "Usuarios" ("Usuario", "Nombre", "Paterno", "Materno", "Contrasena")
     VALUES ($1, $2, $3, $4, $5)
     RETURNING "Id" AS id`,
    [usuario, nombre, paterno, materno, contrasena],
  );
  return rows[0];
}

export async function buscarUsuario(usuario) {
  const { rows } = await pool.query(
    `SELECT "Usuario" AS usuario, "Nombre" AS nombre, "Paterno" AS paterno,
            "Materno" AS materno, "Contrasena" AS contrasena
       FROM "Usuarios"
      WHERE "Usuario" = $1`,
    [usuario],
  );
  return rows[0] ?? null;
}

/** El usuario ya existía (violación del índice único). */
export const esUsuarioDuplicado = (error) => error?.code === '23505';
