// Sesión iniciada en la app: el token que firman los servidores y los datos de quien entró.
// En web se recuerda entre recargas (localStorage); en el celular vive en memoria y hay que
// volver a iniciar sesión al abrir la app (guardarla seguro requiere expo-secure-store).

export type UsuarioSesion = {
  usuario: string;
  nombre: string;
  paterno: string | null;
  materno: string | null;
};

export type Sesion = { token: string; usuario: UsuarioSesion };

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
    return sesion && expiracion(sesion.token) > Date.now() ? sesion : null;
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

export function suscribirSesion(oyente: () => void) {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export const nombreCompleto = (usuario: UsuarioSesion) =>
  [usuario.nombre, usuario.paterno, usuario.materno].filter(Boolean).join(' ');
