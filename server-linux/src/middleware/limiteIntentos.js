// Frena los ataques de fuerza bruta al login: tras MAX_FALLOS intentos fallidos con el mismo
// usuario desde la misma IP, se bloquea ese par durante BLOQUEO_MS. Vive en memoria.
const MAX_FALLOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;

const fallos = new Map(); // clave -> { cuenta, desde }

const clave = (req) => `${req.ip}|${String(req.body?.usuario ?? '').trim().toLowerCase()}`;

export function limitarIntentos(req, res, next) {
  const registro = fallos.get(clave(req));
  if (registro && registro.cuenta >= MAX_FALLOS) {
    const restante = registro.desde + BLOQUEO_MS - Date.now();
    if (restante > 0) {
      const minutos = Math.ceil(restante / 60000);
      return res
        .status(429)
        .json({ ok: false, error: `Demasiados intentos fallidos; espera ${minutos} minuto${minutos === 1 ? '' : 's'}.` });
    }
    fallos.delete(clave(req));
  }
  next();
}

export function anotarFallo(req) {
  const k = clave(req);
  const registro = fallos.get(k);
  fallos.set(k, registro ? { ...registro, cuenta: registro.cuenta + 1 } : { cuenta: 1, desde: Date.now() });
}

export function anotarExito(req) {
  fallos.delete(clave(req));
}
