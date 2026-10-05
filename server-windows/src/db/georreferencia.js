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

/** Últimos registros que cumplen los filtros y cuántos hay en total con esos filtros. */
export async function listarRegistros({ limite, usuario, lugar, desde, hasta }) {
  const pool = await obtenerPool();
  const condiciones = [];
  // Cada consulta necesita su propio request con los mismos parámetros.
  const conFiltros = () => {
    const peticion = pool.request();
    if (usuario) peticion.input('usuario', sql.NVarChar(50), usuario);
    if (lugar) peticion.input('lugar', sql.NVarChar(82), `%${lugar}%`);
    if (desde) peticion.input('desde', sql.VarChar(10), desde);
    if (hasta) peticion.input('hasta', sql.VarChar(10), hasta);
    return peticion;
  };
  // La intercalación por defecto de SQL Server no distingue mayúsculas, así que = y LIKE ya lo cubren.
  if (usuario) condiciones.push('Usuario = @usuario');
  if (lugar) condiciones.push('(Municipio LIKE @lugar OR Estado LIKE @lugar)');
  if (desde) condiciones.push('FechaHora >= CAST(@desde AS date)');
  if (hasta) condiciones.push('FechaHora < DATEADD(day, 1, CAST(@hasta AS date))');
  const donde = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [resultado, conteo] = await Promise.all([
    conFiltros()
      .input('limite', sql.Int, limite)
      .query(`
        SELECT TOP (@limite)
               Id AS id, Usuario AS usuario, Nombre AS nombre, Paterno AS paterno,
               Materno AS materno, Estado AS estado, Municipio AS municipio,
               Latitud AS latitud, Longitud AS longitud, Temperatura AS temperatura,
               Humedad AS humedad, Viento AS viento, FechaHora AS fechaHora
          FROM dbo.Georreferencia
          ${donde}
         ORDER BY Id DESC
      `),
    conFiltros().query(`SELECT COUNT(*) AS total FROM dbo.Georreferencia ${donde}`),
  ]);
  return { registros: resultado.recordset, total: conteo.recordset[0].total };
}
