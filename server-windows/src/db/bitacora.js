import { obtenerPool, sql } from './conexion.js';

/** Inserta todos los eventos en una sola consulta parametrizada (máx. 200 × 7 = 1400 parámetros). */
export async function insertarEventos(usuario, eventos) {
  const pool = await obtenerPool();
  const peticion = pool.request().input('usuario', sql.NVarChar(50), usuario);
  const filas = eventos.map((evento, i) => {
    peticion
      .input(`f${i}`, sql.DateTime2, evento.fecha)
      .input(`n${i}`, sql.NVarChar(10), evento.nivel)
      .input(`o${i}`, sql.NVarChar(20), evento.origen)
      .input(`m${i}`, sql.NVarChar(500), evento.mensaje)
      .input(`d${i}`, sql.NVarChar(1000), evento.detalle)
      .input(`r${i}`, sql.NVarChar(300), evento.orden);
    return `(@usuario, @f${i}, @n${i}, @o${i}, @m${i}, @d${i}, @r${i})`;
  });
  await peticion.query(`
    INSERT INTO dbo.Bitacora (Usuario, FechaEvento, Nivel, Origen, Mensaje, Detalle, Orden)
    VALUES ${filas.join(', ')}
  `);
}

export async function listarEventos({ limite, usuario }) {
  const pool = await obtenerPool();
  const conFiltro = () => {
    const peticion = pool.request();
    if (usuario) peticion.input('usuario', sql.NVarChar(50), usuario);
    return peticion;
  };
  const donde = usuario ? 'WHERE Usuario = @usuario' : '';
  const [resultado, conteo] = await Promise.all([
    conFiltro()
      .input('limite', sql.Int, limite)
      .query(`
        SELECT TOP (@limite) Id AS id, Usuario AS usuario, FechaEvento AS fechaEvento, Nivel AS nivel,
               Origen AS origen, Mensaje AS mensaje, Detalle AS detalle, Orden AS orden
          FROM dbo.Bitacora ${donde}
         ORDER BY Id DESC
      `),
    conFiltro().query(`SELECT COUNT(*) AS total FROM dbo.Bitacora ${donde}`),
  ]);
  return { eventos: resultado.recordset, total: conteo.recordset[0].total };
}
