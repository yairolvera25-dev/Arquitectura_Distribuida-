import { cifrar, descifrar } from '../seguridad/cifradoAes.js';
import { obtenerPool, sql } from './conexion.js';

// Consultas parametrizadas (@usuario, @nombre…): los datos nunca se concatenan al SQL.

// Datos del clima que se guardan cifrados con AES en la columna Cifrado. Sus columnas en texto
// (Estado, Municipio, Latitud…) quedan en NULL; solo se llenan en los registros anteriores al cifrado.
const PROTEGIDOS = ['estado', 'municipio', 'latitud', 'longitud', 'temperatura', 'humedad', 'viento'];

export async function insertarRegistro(r) {
  const protegidos = Object.fromEntries(PROTEGIDOS.map((campo) => [campo, r[campo] ?? null]));
  const pool = await obtenerPool();
  const resultado = await pool
    .request()
    .input('usuario', sql.NVarChar(50), r.usuario)
    .input('nombre', sql.NVarChar(50), r.nombre)
    .input('paterno', sql.NVarChar(50), r.paterno)
    .input('materno', sql.NVarChar(50), r.materno)
    .input('cifrado', sql.NVarChar(sql.MAX), cifrar(protegidos))
    .query(`
      INSERT INTO dbo.Georreferencia (Usuario, Nombre, Paterno, Materno, Cifrado)
      OUTPUT INSERTED.Id AS id, INSERTED.FechaHora AS fechaHora
      VALUES (@usuario, @nombre, @paterno, @materno, @cifrado)
    `);
  return resultado.recordset[0];
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
  const pool = await obtenerPool();
  const condiciones = [];
  // Cada consulta necesita su propio request con los mismos parámetros.
  const conFiltros = () => {
    const peticion = pool.request();
    if (usuario) peticion.input('usuario', sql.NVarChar(50), usuario);
    if (desde) peticion.input('desde', sql.VarChar(10), desde);
    if (hasta) peticion.input('hasta', sql.VarChar(10), hasta);
    return peticion;
  };
  // La intercalación por defecto de SQL Server no distingue mayúsculas, así que = ya lo cubre.
  if (usuario) condiciones.push('Usuario = @usuario');
  if (desde) condiciones.push('FechaHora >= CAST(@desde AS date)');
  if (hasta) condiciones.push('FechaHora < DATEADD(day, 1, CAST(@hasta AS date))');
  const donde = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  // Municipio y Estado van cifrados: SQL Server no puede buscar en ellos con LIKE. Con filtro de
  // lugar se descifran los registros que pasan los demás filtros y se busca aquí.
  const consulta = (tope) =>
    conFiltros()
      .input('limite', sql.Int, limite)
      .query(`
        SELECT ${tope ? 'TOP (@limite)' : ''}
               Id AS id, Usuario AS usuario, Nombre AS nombre, Paterno AS paterno,
               Materno AS materno, Estado AS estado, Municipio AS municipio,
               Latitud AS latitud, Longitud AS longitud, Temperatura AS temperatura,
               Humedad AS humedad, Viento AS viento, FechaHora AS fechaHora, Cifrado AS cifrado
          FROM dbo.Georreferencia
          ${donde}
         ORDER BY Id DESC
      `);

  if (lugar) {
    const buscado = lugar.toLowerCase();
    const encontrados = (await consulta(false)).recordset
      .map((fila) => abrirRegistro(fila, conCifrado))
      .filter((r) => contiene(r.municipio, buscado) || contiene(r.estado, buscado));
    return { registros: encontrados.slice(0, limite), total: encontrados.length };
  }

  const [resultado, conteo] = await Promise.all([
    consulta(true),
    conFiltros().query(`SELECT COUNT(*) AS total FROM dbo.Georreferencia ${donde}`),
  ]);
  return { registros: resultado.recordset.map((fila) => abrirRegistro(fila, conCifrado)), total: conteo.recordset[0].total };
}
