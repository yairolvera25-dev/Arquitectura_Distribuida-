import { cifrar, descifrar } from '../seguridad/cifradoRsa.js';
import { pool } from './conexion.js';

// Consultas parametrizadas ($1, $2…): los datos nunca se concatenan al SQL.

// Datos del clima que se guardan cifrados (AES + RSA) en la columna "Cifrado". Sus columnas en texto
// ("Estado", "Municipio", "Latitud"…) quedan en NULL; solo se llenan en los registros anteriores al cifrado.
const PROTEGIDOS = ['estado', 'municipio', 'latitud', 'longitud', 'temperatura', 'humedad', 'viento'];

export async function insertarRegistro(r) {
  const protegidos = Object.fromEntries(PROTEGIDOS.map((campo) => [campo, r[campo] ?? null]));
  const { rows } = await pool.query(
    `INSERT INTO "Georreferencia" ("Usuario", "Nombre", "Paterno", "Materno", "Cifrado")
     VALUES ($1, $2, $3, $4, $5)
     RETURNING "Id" AS id, "FechaHora" AS "fechaHora"`,
    [r.usuario, r.nombre, r.paterno, r.materno, cifrar(protegidos)],
  );
  return rows[0];
}

/**
 * Fila de la BD → registro en claro. Si el cifrado no cuadra (alterado u otra clave) lo marca.
 * Con `conCifrado` también devuelve el valor tal como está en la BD (para mostrarlo en la app).
 */
function abrirRegistro({ cifrado, ...fila }, conCifrado) {
  const extra = conCifrado ? { cifrado } : {};
  if (!cifrado) return { ...fila, ...extra, protegido: false };
  try {
    return { ...fila, ...descifrar(cifrado), ...extra, protegido: true };
  } catch (error) {
    console.error(`Registro ${fila.id}: no se pudo descifrar (${error.message})`);
    return { ...fila, ...extra, protegido: true, alterado: true };
  }
}

const contiene = (texto, buscado) => typeof texto === 'string' && texto.toLowerCase().includes(buscado);

/** Últimos registros que cumplen los filtros y cuántos hay en total con esos filtros. */
export async function listarRegistros({ limite, usuario, lugar, desde, hasta, conCifrado }) {
  const condiciones = [];
  const valores = [];
  const agregar = (sql, valor) => {
    valores.push(valor);
    condiciones.push(sql.replaceAll('?', `$${valores.length}`));
  };
  if (usuario) agregar('lower("Usuario") = ?', usuario);
  if (desde) agregar('"FechaHora" >= ?::date', desde);
  if (hasta) agregar('"FechaHora" < ?::date + 1', hasta);
  const donde = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  // "Municipio" y "Estado" van cifrados: PostgreSQL no puede buscar en ellos con ILIKE. Con filtro
  // de lugar se descifran los registros que pasan los demás filtros y se busca aquí.
  const consulta = (tope) =>
    pool.query(
      `SELECT "Id" AS id, "Usuario" AS usuario, "Nombre" AS nombre, "Paterno" AS paterno,
              "Materno" AS materno, "Estado" AS estado, "Municipio" AS municipio,
              "Latitud" AS latitud, "Longitud" AS longitud, "Temperatura" AS temperatura,
              "Humedad" AS humedad, "Viento" AS viento, "FechaHora" AS "fechaHora", "Cifrado" AS cifrado
         FROM "Georreferencia"
         ${donde}
        ORDER BY "Id" DESC
        ${tope ? `LIMIT $${valores.length + 1}` : ''}`,
      tope ? [...valores, limite] : valores,
    );

  if (lugar) {
    const buscado = lugar.toLowerCase();
    const encontrados = (await consulta(false)).rows
      .map((fila) => abrirRegistro(fila, conCifrado))
      .filter((r) => contiene(r.municipio, buscado) || contiene(r.estado, buscado));
    return { registros: encontrados.slice(0, limite), total: encontrados.length };
  }

  const [{ rows }, conteo] = await Promise.all([
    consulta(true),
    pool.query(`SELECT COUNT(*)::int AS total FROM "Georreferencia" ${donde}`, valores),
  ]);
  return { registros: rows.map((fila) => abrirRegistro(fila, conCifrado)), total: conteo.rows[0].total };
}
