import { API_KEY, SERVIDORES, USUARIO, type ServidorId } from '../../config';
import type { RegistroClima } from './clima';

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

async function pedir(servidorId: ServidorId, ruta: string, opciones: RequestInit = {}) {
  const servidor = SERVIDORES[servidorId];
  if (!servidor.url) {
    throw new Error(`Falta configurar la URL de ${servidor.nombre} en el archivo .env.`);
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(`${servidor.url}${ruta}`, {
      ...opciones,
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
    });
  } catch {
    throw new Error(`No se pudo conectar con ${servidor.nombre}.`);
  }
  if (respuesta.status === 401) {
    throw new Error(`${servidor.nombre} rechazó la API key; revisa que sea la misma en ambos .env.`);
  }
  const cuerpo = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    throw new Error(`${servidor.nombre}: ${cuerpo?.error ?? `respondió ${respuesta.status}`}`);
  }
  return cuerpo;
}

/**
 * Guarda el registro en el servidor. Con `datos` solo se mandan esas partes;
 * quién guarda y la fecha y hora se registran siempre.
 */
export async function guardarClima(
  servidorId: ServidorId,
  registro: RegistroClima,
  datos?: DatoClima[],
): Promise<{ id: number; fechaHora: string }> {
  if (!USUARIO.usuario || !USUARIO.nombre) {
    throw new Error('Falta configurar EXPO_PUBLIC_USUARIO y EXPO_PUBLIC_NOMBRE en el archivo .env.');
  }
  const campos = datos
    ? Object.fromEntries(datos.flatMap((dato) => CAMPOS[dato]).map((campo) => [campo, registro[campo]]))
    : registro;
  const { id, fechaHora } = await pedir(servidorId, '/api/clima', {
    method: 'POST',
    body: JSON.stringify({ ...USUARIO, ...campos }),
  });
  return { id, fechaHora };
}

/** Últimos registros del servidor y cuántos tiene en total (null si el servidor no lo dice). */
export async function consultarRegistros(
  servidorId: ServidorId,
  limite: number,
): Promise<{ total: number | null; registros: RegistroGuardado[] }> {
  const { total, registros } = await pedir(servidorId, `/api/clima?limite=${limite}`);
  return { total: total ?? null, registros };
}
