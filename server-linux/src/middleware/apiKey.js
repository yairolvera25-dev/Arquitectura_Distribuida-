import { createHash, timingSafeEqual } from 'node:crypto';

const huella = (valor) => createHash('sha256').update(valor).digest();

/** Rechaza con 401 las peticiones sin el header `x-api-key` correcto. */
export function exigirApiKey(req, res, next) {
  const recibida = req.get('x-api-key') ?? '';
  // Comparación en tiempo constante para no filtrar la clave por tiempos de respuesta.
  if (!timingSafeEqual(huella(recibida), huella(process.env.API_KEY))) {
    return res.status(401).json({ ok: false, error: 'API key inválida.' });
  }
  next();
}
