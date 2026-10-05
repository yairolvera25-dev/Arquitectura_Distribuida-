// Respaldo de la bitácora (logs) en los servidores: tabla Bitacora de cada uno.
// Solo se mandan los eventos que ese servidor todavía no tiene.

import type { ServidorId } from '../../config';
import { bitacora, leerBitacora } from './bitacora';
import { pedirServidor } from './servidores';

const MAX_POR_ENVIO = 200;
const NUMERO: Record<ServidorId, string> = { windows: 'uno', linux: 'dos' };

// Último evento respaldado en cada servidor (en memoria: al reabrir la app empieza de nuevo).
const respaldadoHasta: Record<ServidorId, number> = { windows: 0, linux: 0 };

export type ResultadoRespaldo = { servidor: ServidorId; guardados: number; error?: string };

async function respaldarEn(servidor: ServidorId): Promise<ResultadoRespaldo> {
  const { eventos, ordenes } = leerBitacora();
  const textoDeOrden = new Map(ordenes.map((orden) => [orden.id, orden.texto]));
  const pendientes = eventos.filter((evento) => evento.id > respaldadoHasta[servidor]);
  if (!pendientes.length) return { servidor, guardados: 0 };

  let guardados = 0;
  try {
    for (let i = 0; i < pendientes.length; i += MAX_POR_ENVIO) {
      const lote = pendientes.slice(i, i + MAX_POR_ENVIO);
      await pedirServidor(servidor, '/api/bitacora', {
        method: 'POST',
        body: JSON.stringify({
          eventos: lote.map((evento) => ({
            fecha: evento.fecha,
            nivel: evento.nivel,
            origen: evento.origen,
            mensaje: evento.mensaje,
            detalle: evento.detalle,
            orden: evento.orden !== undefined ? textoDeOrden.get(evento.orden) : undefined,
          })),
        }),
      });
      guardados += lote.length;
      respaldadoHasta[servidor] = lote[lote.length - 1].id;
    }
    return { servidor, guardados };
  } catch (error) {
    return { servidor, guardados, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Respalda en los servidores indicados (en paralelo) y deja el resultado en la bitácora. */
export async function respaldarBitacora(servidores: ServidorId[]): Promise<ResultadoRespaldo[]> {
  const resultados = await Promise.all(servidores.map(respaldarEn));
  for (const { servidor, guardados, error } of resultados) {
    if (error) bitacora.error('app', `No se pudo respaldar la bitácora en el servidor ${NUMERO[servidor]}`, { detalle: error });
    else bitacora.exito('app', `Bitácora respaldada en el servidor ${NUMERO[servidor]}: ${guardados} eventos nuevos`);
  }
  return resultados;
}

export type EventoRespaldado = {
  id: number;
  usuario: string;
  fechaEvento: string;
  nivel: string;
  origen: string;
  mensaje: string;
  detalle: string | null;
  orden: string | null;
};

/** Últimos eventos respaldados en un servidor. */
export async function consultarBitacora(servidor: ServidorId, limite: number, usuario?: string) {
  const parametros = `limite=${limite}${usuario ? `&usuario=${encodeURIComponent(usuario)}` : ''}`;
  const { total, eventos } = await pedirServidor(servidor, `/api/bitacora?${parametros}`);
  return { total: total as number, eventos: eventos as EventoRespaldado[] };
}
