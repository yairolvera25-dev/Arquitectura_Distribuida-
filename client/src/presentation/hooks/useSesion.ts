import { useSyncExternalStore } from 'react';

import { leerSesion, suscribirSesion } from '../../data/services/sesion';

/** Sesión iniciada (o null); el componente se actualiza al iniciar o cerrar sesión. */
export function useSesion() {
  return useSyncExternalStore(suscribirSesion, leerSesion, leerSesion);
}
