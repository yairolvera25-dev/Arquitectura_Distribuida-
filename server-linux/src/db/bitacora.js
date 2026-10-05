import { pool } from './conexion.js';

const COLUMNAS = 7;

/** Inserta todos los eventos en una sola consulta parametrizada. */
export async function insertarEventos(usuario, eventos) {
  const valores = [];
  const filas = eventos.map((evento, i) => {
    valores.push(usuario, evento.fecha, evento.nivel, evento.origen, evento.mensaje, evento.detalle, evento.orden);
    const base = i * COLUMNAS;
    return `(${Array.from({ length: COLUMNAS }, (_, j) => `$${base + j + 1}`).join(', ')})`;
  });
  await pool.query(
    `INSERT INTO "Bitacora" ("Usuario", "FechaEvento", "Nivel", "Origen", "Mensaje", "Detalle", "Orden")
     VALUES ${filas.join(', ')}`,
    valores,
  );
}

export async function listarEventos({ limite, usuario }) {
  const donde = usuario ? 'WHERE lower("Usuario") = $2' : '';
  const [{ rows }, conteo] = await Promise.all([
    pool.query(
      `SELECT "Id" AS id, "Usuario" AS usuario, "FechaEvento" AS "fechaEvento", "Nivel" AS nivel,
              "Origen" AS origen, "Mensaje" AS mensaje, "Detalle" AS detalle, "Orden" AS orden
         FROM "Bitacora" ${donde}
        ORDER BY "Id" DESC
        LIMIT $1`,
      usuario ? [limite, usuario] : [limite],
    ),
    pool.query(`SELECT COUNT(*)::int AS total FROM "Bitacora" ${usuario ? 'WHERE lower("Usuario") = $1' : ''}`, usuario ? [usuario] : []),
  ]);
  return { eventos: rows, total: conteo.rows[0].total };
}
