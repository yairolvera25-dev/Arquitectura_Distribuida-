import { pool } from './conexion.js';

// Consultas parametrizadas ($1, $2…): los datos nunca se concatenan al SQL.

export async function insertarRegistro(r) {
  const { rows } = await pool.query(
    `INSERT INTO "Georreferencia"
       ("Usuario", "Nombre", "Paterno", "Materno", "Estado", "Municipio",
        "Latitud", "Longitud", "Temperatura", "Humedad", "Viento")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING "Id" AS id, "FechaHora" AS "fechaHora"`,
    [
      r.usuario,
      r.nombre,
      r.paterno,
      r.materno,
      r.estado,
      r.municipio,
      r.latitud,
      r.longitud,
      r.temperatura,
      r.humedad,
      r.viento,
    ],
  );
  return rows[0];
}

export async function listarRegistros(limite) {
  const { rows } = await pool.query(
    `SELECT "Id" AS id, "Usuario" AS usuario, "Nombre" AS nombre, "Paterno" AS paterno,
            "Materno" AS materno, "Estado" AS estado, "Municipio" AS municipio,
            "Latitud" AS latitud, "Longitud" AS longitud, "Temperatura" AS temperatura,
            "Humedad" AS humedad, "Viento" AS viento, "FechaHora" AS "fechaHora"
       FROM "Georreferencia"
      ORDER BY "Id" DESC
      LIMIT $1`,
    [limite],
  );
  return rows;
}
