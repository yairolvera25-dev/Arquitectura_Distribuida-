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

/** Últimos registros que cumplen los filtros y cuántos hay en total con esos filtros. */
export async function listarRegistros({ limite, usuario, lugar, desde, hasta }) {
  const condiciones = [];
  const valores = [];
  const agregar = (sql, valor) => {
    valores.push(valor);
    condiciones.push(sql.replaceAll('?', `$${valores.length}`));
  };
  if (usuario) agregar('lower("Usuario") = ?', usuario);
  if (lugar) agregar('("Municipio" ILIKE ? OR "Estado" ILIKE ?)', `%${lugar}%`);
  if (desde) agregar('"FechaHora" >= ?::date', desde);
  if (hasta) agregar('"FechaHora" < ?::date + 1', hasta);
  const donde = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [{ rows }, conteo] = await Promise.all([
    pool.query(
      `SELECT "Id" AS id, "Usuario" AS usuario, "Nombre" AS nombre, "Paterno" AS paterno,
              "Materno" AS materno, "Estado" AS estado, "Municipio" AS municipio,
              "Latitud" AS latitud, "Longitud" AS longitud, "Temperatura" AS temperatura,
              "Humedad" AS humedad, "Viento" AS viento, "FechaHora" AS "fechaHora"
         FROM "Georreferencia"
         ${donde}
        ORDER BY "Id" DESC
        LIMIT $${valores.length + 1}`,
      [...valores, limite],
    ),
    pool.query(`SELECT COUNT(*)::int AS total FROM "Georreferencia" ${donde}`, valores),
  ]);
  return { registros: rows, total: conteo.rows[0].total };
}
