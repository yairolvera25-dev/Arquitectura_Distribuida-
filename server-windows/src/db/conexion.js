import sql from 'mssql';

const puerto = process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined;

const configuracion = {
  server: process.env.DB_SERVER ?? 'localhost',
  database: process.env.DB_NAME ?? 'UPP',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // El puerto y el nombre de instancia son excluyentes: se usa uno u otro.
  ...(puerto ? { port: puerto } : {}),
  connectionTimeout: 5000,
  pool: { max: 5 },
  options: {
    ...(puerto ? {} : { instanceName: process.env.DB_INSTANCE || 'SQLEXPRESS' }),
    encrypt: true,
    // SQL Server Express usa un certificado autofirmado; la conexión es local.
    trustServerCertificate: true,
    // FechaHora se guarda con la hora local del servidor (GETDATE()).
    useUTC: false,
  },
};

let conexion = null;

export function obtenerPool() {
  conexion ??= new sql.ConnectionPool(configuracion).connect().catch((error) => {
    conexion = null; // Permite reintentar en la siguiente petición
    throw error;
  });
  return conexion;
}

export async function verificarConexion() {
  const pool = await obtenerPool();
  await pool.request().query('SELECT 1');
}

export { sql };
