import { API_KEY, SERVIDORES, type ServidorId } from '../config';
import type { RegistroClima } from './clima';

const TIEMPO_LIMITE_MS = 8000;

export async function guardarClima(servidorId: ServidorId, registro: RegistroClima): Promise<void> {
  const servidor = SERVIDORES[servidorId];
  if (!servidor.url) {
    throw new Error(`Falta configurar la URL de ${servidor.nombre} en el archivo .env.`);
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(`${servidor.url}/api/clima`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify(registro),
      signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
    });
  } catch {
    throw new Error(`No se pudo conectar con ${servidor.nombre}.`);
  }
  if (!respuesta.ok) {
    throw new Error(`${servidor.nombre} respondió ${respuesta.status}.`);
  }
}
