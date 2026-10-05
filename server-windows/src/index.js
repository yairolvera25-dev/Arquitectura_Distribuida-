import 'dotenv/config';
import cors from 'cors';
import express from 'express';

import { verificarConexion } from './db/conexion.js';
import { exigirApiKey } from './middleware/apiKey.js';
import { exigirSesion } from './middleware/sesion.js';
import { rutasAuth } from './routes/auth.js';
import { rutasBitacora } from './routes/bitacora.js';
import { rutasClima } from './routes/clima.js';

const SERVIDOR = 'windows';
const PUERTO = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';

if (!process.env.API_KEY || process.env.API_KEY.length < 16) {
  console.error('Falta API_KEY en el archivo .env (mínimo 16 caracteres).');
  process.exit(1);
}
// Firma los tokens de sesión. Debe ser la MISMA en los dos servidores.
if (!process.env.TOKEN_SECRET || process.env.TOKEN_SECRET.length < 32) {
  console.error('Falta TOKEN_SECRET en el archivo .env (mínimo 32 caracteres, igual en los dos servidores).');
  process.exit(1);
}

// Códigos de error cuando la base de datos no responde o rechaza las credenciales (pg y mssql).
const ERRORES_DE_CONEXION = new Set(['ECONNREFUSED', 'ETIMEDOUT', 'ESOCKET', 'ELOGIN', 'ETIMEOUT', '28P01', '57P03']);

const origenes = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origen) => origen.trim())
  .filter(Boolean);

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: origenes.length ? origenes : '*' }));
// 200 eventos de la bitácora caben en ~100 KB.
app.use(express.json({ limit: '200kb' }));

// Sin API key: solo dice si el servicio y la base de datos responden.
app.get('/api/salud', async (_req, res) => {
  try {
    await verificarConexion();
    res.json({ ok: true, servidor: SERVIDOR, baseDeDatos: 'conectada' });
  } catch (error) {
    console.error('Sin conexión a la base de datos:', error.message);
    res.status(503).json({ ok: false, servidor: SERVIDOR, baseDeDatos: 'sin conexión' });
  }
});

app.use('/api/auth', exigirApiKey, rutasAuth(SERVIDOR));
app.use('/api/clima', exigirApiKey, exigirSesion, rutasClima(SERVIDOR));
app.use('/api/bitacora', exigirApiKey, exigirSesion, rutasBitacora(SERVIDOR));

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Ruta no encontrada.' });
});

app.use((error, _req, res, _next) => {
  // Errores del cliente (JSON mal formado, cuerpo muy grande…)
  if (error.expose && error.status < 500) {
    return res.status(error.status).json({ ok: false, error: error.message });
  }
  if (ERRORES_DE_CONEXION.has(error.code)) {
    console.error('Sin conexión a la base de datos:', error.message);
    return res.status(503).json({ ok: false, error: 'La base de datos no está disponible.' });
  }
  console.error(error);
  res.status(500).json({ ok: false, error: 'Error interno del servidor.' });
});

app.listen(PUERTO, HOST, () => {
  console.log(`Servidor ${SERVIDOR} escuchando en http://${HOST}:${PUERTO}`);
});
