import jwt from 'jsonwebtoken';

// Token de sesión (JWT firmado con HMAC-SHA256). Los dos servidores comparten TOKEN_SECRET,
// así que la sesión iniciada en uno sirve también en el otro.
const DURACION = '12h';
const EMISOR = 'clima-distribuido-upp';

export function firmarToken({ usuario, nombre, paterno, materno }) {
  return jwt.sign({ nombre, paterno, materno }, process.env.TOKEN_SECRET, {
    algorithm: 'HS256',
    subject: usuario,
    issuer: EMISOR,
    expiresIn: DURACION,
  });
}

/** Devuelve el usuario del token, o lanza un error si es inválido o ya expiró. */
export function verificarToken(token) {
  const datos = jwt.verify(token, process.env.TOKEN_SECRET, { algorithms: ['HS256'], issuer: EMISOR });
  return { usuario: datos.sub, nombre: datos.nombre, paterno: datos.paterno ?? null, materno: datos.materno ?? null };
}
