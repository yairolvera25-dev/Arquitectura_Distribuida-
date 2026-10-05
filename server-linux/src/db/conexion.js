import pg from 'pg';

// PostgreSQL devuelve NUMERIC como texto; se convierte a número para el JSON.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (valor) => Number.parseFloat(valor));

export const pool = new pg.Pool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? 'UPP',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 5,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (error) => {
  console.error('Error en la conexión con PostgreSQL:', error.message);
});

export async function verificarConexion() {
  await pool.query('SELECT 1');
}
