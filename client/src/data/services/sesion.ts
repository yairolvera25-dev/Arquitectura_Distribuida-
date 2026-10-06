// Sesión iniciada en la app: un token POR SERVIDOR y los datos de quien entró.
// Con un token por servidor no importa si cada uno firma con su propio TOKEN_SECRET.
// En web se recuerda entre recargas (localStorage); en el celular vive en memoria y hay que
// volver a iniciar sesión al abrir la app (guardarla seguro requiere expo-secure-store).

import type { ServidorId } from '../../config';

export type UsuarioSesion = {
  usuario: string;
  nombre: string;
  paterno: string | null;
  materno: string | null;
};

export type Sesion = { usuario: UsuarioSesion; tokens: Partial<Record<ServidorId, string>> };

const CLAVE = 'clima-upp-sesion';
const oyentes = new Set<() => void>();

function almacen(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Fecha de expiración del token (campo `exp` del JWT), en ms. */
function expiracion(token: string): number {
  try {
    const carga = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(carga)).exp * 1000;
  } catch {
    return 0;
  }
}

function cargar(): Sesion | null {
  try {
    const guardada = almacen()?.getItem(CLAVE);
    const sesion: Sesion | null = guardada ? JSON.parse(guardada) : null;
    if (!sesion?.tokens) return null; // Sesiones de la versión anterior (un solo token): se descartan
    const vigentes = Object.fromEntries(
      Object.entries(sesion.tokens).filter(([, token]) => token && expiracion(token) > Date.now()),
    );
    return Object.keys(vigentes).length ? { ...sesion, tokens: vigentes } : null;
  } catch {
    return null;
  }
}

let actual: Sesion | null = cargar();

export const leerSesion = () => actual;

export function guardarSesion(sesion: Sesion | null) {
  actual = sesion;
  try {
    if (sesion) almacen()?.setItem(CLAVE, JSON.stringify(sesion));
    else almacen()?.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento (modo privado): la sesión dura mientras la app esté abierta.
  }
  oyentes.forEach((oyente) => oyente());
}

/** Agrega o quita el token de un servidor sin tocar el de los demás. Sin tokens, la sesión se cierra. */
export function cambiarToken(servidor: ServidorId, token: string | null) {
  if (!actual) return;
  const tokens = { ...actual.tokens };
  if (token) tokens[servidor] = token;
  else delete tokens[servidor];
  guardarSesion(Object.keys(tokens).length ? { ...actual, tokens } : null);
}

export function suscribirSesion(oyente: () => void) {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export const nombreCompleto = (usuario: UsuarioSesion) =>
  [usuario.nombre, usuario.paterno, usuario.materno].filter(Boolean).join(' ');
