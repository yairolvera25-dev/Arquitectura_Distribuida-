import { obtenerPool, sql } from './conexion.js';

// Cuentas de la app. La columna Contrasena guarda el hash scrypt, nunca la contraseña.

export async function crearUsuario({ usuario, nombre, paterno, materno, contrasena }) {
  const pool = await obtenerPool();
  const resultado = await pool
    .request()
    .input('usuario', sql.NVarChar(50), usuario)
    .input('nombre', sql.NVarChar(50), nombre)
    .input('paterno', sql.NVarChar(50), paterno)
    .input('materno', sql.NVarChar(50), materno)
    .input('contrasena', sql.NVarChar(255), contrasena)
    .query(`
      INSERT INTO dbo.Usuarios (Usuario, Nombre, Paterno, Materno, Contrasena)
      OUTPUT INSERTED.Id AS id
      VALUES (@usuario, @nombre, @paterno, @materno, @contrasena)
    `);
  return resultado.recordset[0];
}

export async function buscarUsuario(usuario) {
  const pool = await obtenerPool();
  const resultado = await pool
    .request()
    .input('usuario', sql.NVarChar(50), usuario)
    .query(`
      SELECT Usuario AS usuario, Nombre AS nombre, Paterno AS paterno,
             Materno AS materno, Contrasena AS contrasena
        FROM dbo.Usuarios
       WHERE Usuario = @usuario
    `);
  return resultado.recordset[0] ?? null;
}

/** El usuario ya existía (violación de la restricción UNIQUE: errores 2627 y 2601). */
export const esUsuarioDuplicado = (error) => error?.number === 2627 || error?.number === 2601;
