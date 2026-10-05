import { verificarToken } from '../seguridad/tokens.js';

/** Exige una sesión iniciada (header `Authorization: Bearer <token>`) y deja el usuario en `req.usuario`. */
export function exigirSesion(req, res, next) {
  const [tipo, token] = (req.get('authorization') ?? '').split(' ');
  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ ok: false, codigo: 'SESION', error: 'Inicia sesión para continuar.' });
  }
  try {
    req.usuario = verificarToken(token);
    next();
  } catch (error) {
    const expiro = error?.name === 'TokenExpiredError';
    res.status(401).json({
      ok: false,
      codigo: 'SESION',
      error: expiro ? 'Tu sesión expiró; vuelve a iniciar sesión.' : 'La sesión no es válida; vuelve a iniciar sesión.',
    });
  }
}
