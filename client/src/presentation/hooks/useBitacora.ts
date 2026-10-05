import { useSyncExternalStore } from 'react';

import { leerBitacora, suscribirBitacora } from '../../data/services/bitacora';

/** Eventos y órdenes de la bitácora; el componente se actualiza con cada evento nuevo. */
export function useBitacora() {
  return useSyncExternalStore(suscribirBitacora, leerBitacora, leerBitacora);
}
