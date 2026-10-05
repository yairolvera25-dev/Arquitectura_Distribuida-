import { obtenerPool, sql } from './conexion.js';

// Consultas parametrizadas (@usuario, @nombre…): los datos nunca se concatenan al SQL.

export async function insertarRegistro(r) {
  const pool = await obtenerPool();
  const resultado = await pool
    .request()
    .input('usuario', sql.NVarChar(50), r.usuario)
    .input('nombre', sql.NVarChar(50), r.nombre)
    .input('paterno', sql.NVarChar(50), r.paterno)
    .input('materno', sql.NVarChar(50), r.materno)
    .input('estado', sql.NVarChar(50), r.estado)
    .input('municipio', sql.NVarChar(80), r.municipio)
    .input('latitud', sql.Decimal(10, 6), r.latitud)
    .input('longitud', sql.Decimal(10, 6), r.longitud)
    .input('temperatura', sql.Decimal(5, 2), r.temperatura)
    .input('humedad', sql.Decimal(5, 2), r.humedad)
    .input('viento', sql.Decimal(5, 2), r.viento)
    .query(`
      INSERT INTO dbo.Georreferencia
        (Usuario, Nombre, Paterno, Materno, Estado, Municipio,
         Latitud, Longitud, Temperatura, Humedad, Viento)
      OUTPUT INSERTED.Id AS id, INSERTED.FechaHora AS fechaHora
      VALUES
        (@usuario, @nombre, @paterno, @materno, @estado, @municipio,
         @latitud, @longitud, @temperatura, @humedad, @viento)
    `);
  return resultado.recordset[0];
}

export async function listarRegistros(limite) {
  const pool = await obtenerPool();
  const resultado = await pool
    .request()
    .input('limite', sql.Int, limite)
    .query(`
      SELECT TOP (@limite)
             Id AS id, Usuario AS usuario, Nombre AS nombre, Paterno AS paterno,
             Materno AS materno, Estado AS estado, Municipio AS municipio,
             Latitud AS latitud, Longitud AS longitud, Temperatura AS temperatura,
             Humedad AS humedad, Viento AS viento, FechaHora AS fechaHora
        FROM dbo.Georreferencia
       ORDER BY Id DESC
    `);
  return resultado.recordset;
}
