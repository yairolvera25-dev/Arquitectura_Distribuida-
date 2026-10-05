// Registro e inicio de sesión. Las cuentas viven en los DOS servidores (tabla Usuarios en
// SQL Server y en PostgreSQL), así que se puede entrar aunque uno esté apagado. Los dos
// firman los tokens con el mismo secreto: la sesión que da uno sirve en el otro.

import type { ServidorId } from '../../config';
import { bitacora } from './bitacora';
import { ErrorServidor, pedirServidor } from './servidores';
import { guardarSesion, type UsuarioSesion } from './sesion';

const SERVIDORES_IDS: ServidorId[] = ['windows', 'linux'];
const NUMERO: Record<ServidorId, string> = { windows: 'uno', linux: 'dos' };

export type DatosRegistro = UsuarioSesion & { contrasena: string };

/** Qué pasó en cada servidor al registrarse, para mostrarlo en pantalla. */
export type ResultadoRegistro = Record<ServidorId, 'creada' | 'existia' | 'sinConexion' | 'error'>;

const sinConexion = (error: unknown) => error instanceof ErrorServidor && error.status === null;
const status = (error: unknown) => (error instanceof ErrorServidor ? error.status : null);

/** Error más útil para el usuario de una lista: primero los de datos o cuenta, al final los de red. */
function errorPrincipal(errores: unknown[]): Error {
  const conRespuesta = errores.find((error) => status(error) !== null);
  const elegido = conRespuesta ?? errores[0];
  return elegido instanceof Error ? elegido : new Error('No se pudo completar la operación.');
}

export async function registrar(datos: DatosRegistro): Promise<ResultadoRegistro> {
  bitacora.info('cuenta', `Creando la cuenta ${datos.usuario} en los dos servidores`);
  const intentos = await Promise.allSettled(
    SERVIDORES_IDS.map((id) =>
      pedirServidor(id, '/api/auth/registro', { method: 'POST', body: JSON.stringify(datos) }),
    ),
  );

  const resultado = {} as ResultadoRegistro;
  intentos.forEach((intento, i) => {
    const id = SERVIDORES_IDS[i];
    resultado[id] =
      intento.status === 'fulfilled'
        ? 'creada'
        : status(intento.reason) === 409
          ? 'existia'
          : sinConexion(intento.reason)
            ? 'sinConexion'
            : 'error';
  });

  const creadas = SERVIDORES_IDS.filter((id) => resultado[id] === 'creada');
  if (!creadas.length) {
    const errores = intentos.flatMap((intento) => (intento.status === 'rejected' ? [intento.reason] : []));
    throw errorPrincipal(errores);
  }
  if (creadas.length === 1) {
    const otro = SERVIDORES_IDS.find((id) => id !== creadas[0])!;
    bitacora.aviso('cuenta', `La cuenta solo quedó en el servidor ${NUMERO[creadas[0]]}`, {
      detalle: `Servidor ${NUMERO[otro]}: ${resultado[otro]}. Se copiará la próxima vez que inicies sesión con él encendido.`,
    });
  } else {
    bitacora.exito('cuenta', `Cuenta ${datos.usuario} creada en los dos servidores`);
  }
  return resultado;
}

export async function iniciarSesion(usuario: string, contrasena: string): Promise<UsuarioSesion> {
  const intentos = await Promise.allSettled(
    SERVIDORES_IDS.map((id) =>
      pedirServidor(id, '/api/auth/login', { method: 'POST', body: JSON.stringify({ usuario, contrasena }) }),
    ),
  );

  const exito = intentos.find((intento) => intento.status === 'fulfilled');
  if (!exito || exito.status !== 'fulfilled') {
    const errores = intentos.flatMap((intento) => (intento.status === 'rejected' ? [intento.reason] : []));
    throw errorPrincipal(errores);
  }

  const { token, usuario: datos } = exito.value as { token: string; usuario: UsuarioSesion };
  guardarSesion({ token, usuario: datos });
  bitacora.exito('cuenta', `Sesión iniciada: ${datos.usuario}`);

  // Sincronización: si un servidor no conoce la cuenta (estaba apagado al registrarse),
  // se le crea ahora con los mismos datos. Si ya la tiene con otra contraseña, responde 409 y no se toca.
  intentos.forEach((intento, i) => {
    if (intento.status === 'rejected' && status(intento.reason) === 401) {
      const id = SERVIDORES_IDS[i];
      pedirServidor(id, '/api/auth/registro', {
        method: 'POST',
        body: JSON.stringify({ ...datos, contrasena }),
      }).then(
        () => bitacora.exito('cuenta', `Cuenta copiada al servidor ${NUMERO[id]}`),
        () => bitacora.aviso('cuenta', `No se pudo copiar la cuenta al servidor ${NUMERO[id]}`),
      );
    }
  });
  return datos;
}

export function cerrarSesion() {
  guardarSesion(null);
  bitacora.info('cuenta', 'Sesión cerrada');
}
