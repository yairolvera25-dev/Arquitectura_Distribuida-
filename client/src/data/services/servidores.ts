import { API_KEY, SERVIDORES, type ServidorId } from '../../config';
import { bitacora, cronometro } from './bitacora';
import type { RegistroClima } from './clima';
import { guardarSesion, leerSesion } from './sesion';

const TIEMPO_LIMITE_MS = 8000;

/** Partes del registro que se pueden guardar por separado ("guarda solo la temperatura"). */
export type DatoClima = 'temperatura' | 'humedad' | 'viento' | 'ubicacion';

const CAMPOS: Record<DatoClima, (keyof RegistroClima)[]> = {
  temperatura: ['temperatura'],
  humedad: ['humedad'],
  viento: ['viento'],
  ubicacion: ['latitud', 'longitud', 'estado', 'municipio'],
};

export const DATOS_CLIMA = Object.keys(CAMPOS) as DatoClima[];

/** Un registro tal como lo devuelve `GET /api/clima`; lo que no se guardó viene en null. */
export type RegistroGuardado = {
  id: number;
  usuario: string;
  nombre: string;
  paterno: string | null;
  materno: string | null;
  estado: string | null;
  municipio: string | null;
  latitud: number | null;
  longitud: number | null;
  temperatura: number | null;
  humedad: number | null;
  viento: number | null;
  fechaHora: string;
};

/** Error de un servidor; `status` es el código HTTP, o null si no hubo respuesta. */
export class ErrorServidor extends Error {
  constructor(
    mensaje: string,
    readonly status: number | null,
  ) {
    super(mensaje);
  }
}

/** Lanza el error y lo deja en la bitácora con el detalle técnico. */
function fallar(mensaje: string, status: number | null, detalle: string, duracionMs?: number): never {
  bitacora.error('servidor', mensaje, { detalle, duracionMs });
  throw new ErrorServidor(mensaje, status);
}

/**
 * Petición a la API de un servidor con la API key y, si hay sesión, el token.
 * El cuerpo nunca va a la bitácora (puede llevar la contraseña).
 */
export async function pedirServidor(servidorId: ServidorId, ruta: string, opciones: RequestInit = {}) {
  const servidor = SERVIDORES[servidorId];
  const metodo = opciones.method ?? 'GET';
  const peticion = `${metodo} ${servidor.url}${ruta}`;
  if (!servidor.url) {
    fallar(`Falta configurar la URL de ${servidor.nombre} en el archivo .env.`, null, 'Variable EXPO_PUBLIC_SERVIDOR_*_URL vacía');
  }

  const token = leerSesion()?.token;
  const tiempo = cronometro();
  let respuesta: Response;
  try {
    respuesta = await fetch(`${servidor.url}${ruta}`, {
      ...opciones,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
    });
  } catch (error) {
    const causa =
      error instanceof Error && error.name === 'TimeoutError'
        ? `sin respuesta en ${TIEMPO_LIMITE_MS / 1000} s`
        : 'no hay conexión (¿ZeroTier conectado? ¿servidor encendido?)';
    fallar(`No se pudo conectar con ${servidor.nombre}.`, null, `${peticion} → ${causa}`, tiempo());
  }
  const duracionMs = tiempo();
  const cuerpo = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    const detalle = `${peticion} → HTTP ${respuesta.status}${
      Array.isArray(cuerpo?.errores) ? ` (${cuerpo.errores.join(' ')})` : ''
    }`;
    if (respuesta.status === 401 && cuerpo?.codigo === 'SESION') {
      // El token expiró o no es válido: se cierra la sesión y la app vuelve al inicio de sesión.
      guardarSesion(null);
      fallar(cuerpo.error ?? 'Tu sesión expiró; vuelve a iniciar sesión.', 401, detalle, duracionMs);
    }
    if (respuesta.status === 401 && /api key/i.test(cuerpo?.error ?? '')) {
      fallar(`${servidor.nombre} rechazó la API key; revisa que sea la misma en ambos .env.`, 401, detalle, duracionMs);
    }
    fallar(cuerpo?.error ?? `${servidor.nombre} respondió ${respuesta.status}.`, respuesta.status, detalle, duracionMs);
  }
  bitacora.exito('servidor', `${servidor.nombre} respondió ${respuesta.status}`, {
    detalle: `${peticion}${cuerpo?.id ? ` → registro ${cuerpo.id}` : ''}`,
    duracionMs,
  });
  return cuerpo;
}

/**
 * Guarda el registro en el servidor. Con `datos` solo se mandan esas partes.
 * Quién guarda lo pone el servidor a partir de la sesión; la fecha y hora, la base de datos.
 */
export async function guardarClima(
  servidorId: ServidorId,
  registro: RegistroClima,
  datos?: DatoClima[],
): Promise<{ id: number; fechaHora: string; contenido: Partial<RegistroClima> }> {
  const campos = datos
    ? Object.fromEntries(datos.flatMap((dato) => CAMPOS[dato]).map((campo) => [campo, registro[campo]]))
    : registro;
  const { id, fechaHora } = await pedirServidor(servidorId, '/api/clima', {
    method: 'POST',
    body: JSON.stringify(campos),
  });
  return { id, fechaHora, contenido: campos };
}

/** Filtros de la consulta; las fechas en formato AAAA-MM-DD. */
export type FiltrosConsulta = {
  limite: number;
  usuario?: string;
  lugar?: string;
  desde?: string;
  hasta?: string;
};

/** Últimos registros del servidor que cumplen los filtros y cuántos hay en total (null si no lo dice). */
export async function consultarRegistros(
  servidorId: ServidorId,
  filtros: FiltrosConsulta,
): Promise<{ total: number | null; registros: RegistroGuardado[] }> {
  const parametros = Object.entries(filtros)
    .filter(([, valor]) => valor !== undefined && valor !== '')
    .map(([clave, valor]) => `${clave}=${encodeURIComponent(String(valor))}`)
    .join('&');
  const { total, registros } = await pedirServidor(servidorId, `/api/clima?${parametros}`);
  return { total: total ?? null, registros };
}
