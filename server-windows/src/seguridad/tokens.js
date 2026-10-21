import { randomUUID } from 'node:crypto';

import jwt from 'jsonwebtoken';

// Tokens firmados con HMAC-SHA256 (JWT). Hay dos tipos, que se distinguen por la audiencia:
// - sesión: se entrega solo cuando la contraseña Y el código TOTP son correctos; dura 12 horas.
// - pendiente: prueba que la contraseña ya fue correcta y solo sirve para mandar el código
//   TOTP (POST /api/auth/2fa). No abre /api/clima ni /api/bitacora; dura 10 minutos.
const EMISOR = 'clima-distribuido-upp';
const SESION = { audiencia: 'sesion', duracion: '12h' };
const PENDIENTE = { audiencia: 'verificacion-2fa', duracion: '10m' };

const opciones = { algorithms: ['HS256'], issuer: EMISOR };

export function firmarToken({ usuario, nombre, paterno, materno }) {
  return jwt.sign({ nombre, paterno, materno }, process.env.TOKEN_SECRET, {
    algorithm: 'HS256',
    subject: usuario,
    issuer: EMISOR,
    audience: SESION.audiencia,
    expiresIn: SESION.duracion,
    jwtid: randomUUID(),
  });
}

// Sesiones cerradas antes de vencer (POST /api/auth/salir): id del token -> cuándo vence, en ms.
// Viven en memoria; los tokens de antes de un reinicio duran hasta su vencimiento normal.
const revocados = new Map();

/** Devuelve el usuario del token, o lanza un error si es inválido, ya expiró o se cerró la sesión. */
export function verificarToken(token) {
  const datos = jwt.verify(token, process.env.TOKEN_SECRET, { ...opciones, audience: SESION.audiencia });
  if (revocados.has(datos.jti)) throw new Error('Sesión cerrada');
  return { usuario: datos.sub, nombre: datos.nombre, paterno: datos.paterno ?? null, materno: datos.materno ?? null };
}

/** Invalida un token de sesión ya verificado, para que no sirva aunque alguien lo hubiera copiado. */
export function revocarToken(token) {
  const { jti, exp } = jwt.decode(token);
  const ahora = Date.now();
  for (const [id, vence] of revocados) if (vence < ahora) revocados.delete(id);
  revocados.set(jti, exp * 1000);
}

export function firmarTokenPendiente(usuario) {
  return jwt.sign({}, process.env.TOKEN_SECRET, {
    algorithm: 'HS256',
    subject: usuario,
    issuer: EMISOR,
    audience: PENDIENTE.audiencia,
    expiresIn: PENDIENTE.duracion,
  });
}

/** Devuelve el usuario cuya contraseña ya se verificó, o lanza un error. */
export function verificarTokenPendiente(token) {
  return jwt.verify(token, process.env.TOKEN_SECRET, { ...opciones, audience: PENDIENTE.audiencia }).sub;
}
