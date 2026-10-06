// Registro e inicio de sesión. Las cuentas viven en los DOS servidores (tabla Usuarios en
// SQL Server y en PostgreSQL), así que se puede entrar aunque uno esté apagado. La app guarda
// un token por servidor, así que funciona aunque cada uno firme con su propio TOKEN_SECRET.

import type { ServidorId } from '../../config';
import { bitacora } from './bitacora';
import { ErrorServidor, pedirServidor } from './servidores';
import { cambiarToken, guardarSesion, leerSesion, type UsuarioSesion } from './sesion';

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

export type RespuestaRegistro = { resultado: ResultadoRegistro; codigoRecuperacion: string | null };

/**
 * Crea la cuenta en los dos servidores, uno tras otro: el primero genera el código de
 * recuperación y se le pasa al segundo, para que sea el mismo en ambos.
 */
export async function registrar(datos: DatosRegistro): Promise<RespuestaRegistro> {
  bitacora.info('cuenta', `Creando la cuenta ${datos.usuario} en los dos servidores`);
  const resultado = {} as ResultadoRegistro;
  const errores: unknown[] = [];
  let codigoRecuperacion: string | null = null;

  for (const id of SERVIDORES_IDS) {
    try {
      const respuesta = await pedirServidor(id, '/api/auth/registro', {
        method: 'POST',
        body: JSON.stringify(codigoRecuperacion ? { ...datos, codigoRecuperacion } : datos),
      });
      codigoRecuperacion ??= respuesta.codigoRecuperacion ?? null;
      resultado[id] = 'creada';
    } catch (error) {
      errores.push(error);
      resultado[id] = status(error) === 409 ? 'existia' : sinConexion(error) ? 'sinConexion' : 'error';
    }
  }

  const creadas = SERVIDORES_IDS.filter((id) => resultado[id] === 'creada');
  if (!creadas.length) throw errorPrincipal(errores);
  if (creadas.length === 1) {
    const otro = SERVIDORES_IDS.find((id) => id !== creadas[0])!;
    bitacora.aviso('cuenta', `La cuenta solo quedó en el servidor ${NUMERO[creadas[0]]}`, {
      detalle: `Servidor ${NUMERO[otro]}: ${resultado[otro]}. Se copiará la próxima vez que inicies sesión con él encendido.`,
    });
  } else {
    bitacora.exito('cuenta', `Cuenta ${datos.usuario} creada en los dos servidores`);
  }
  return { resultado, codigoRecuperacion };
}

/** Cambia la contraseña con el código de recuperación, en los dos servidores. */
export async function restablecerContrasena(usuario: string, codigo: string, contrasena: string) {
  const intentos = await Promise.allSettled(
    SERVIDORES_IDS.map((id) =>
      pedirServidor(id, '/api/auth/restablecer', { method: 'POST', body: JSON.stringify({ usuario, codigo, contrasena }) }),
    ),
  );
  const listos = SERVIDORES_IDS.filter((_, i) => intentos[i].status === 'fulfilled');
  if (!listos.length) {
    throw errorPrincipal(intentos.flatMap((intento) => (intento.status === 'rejected' ? [intento.reason] : [])));
  }
  if (listos.length === 1) {
    bitacora.aviso('cuenta', `Contraseña restablecida solo en el servidor ${NUMERO[listos[0]]}`);
  } else {
    bitacora.exito('cuenta', `Contraseña de ${usuario} restablecida en los dos servidores`);
  }
}

type RespuestaLogin = { token: string; usuario: UsuarioSesion };

/** La primera promesa que se cumple; si todas fallan, rechaza con la lista de errores. */
function primeraQueFunciona<T>(promesas: Promise<T>[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const errores: unknown[] = [];
    promesas.forEach((promesa) =>
      promesa.then(resolve, (error) => {
        errores.push(error);
        if (errores.length === promesas.length) reject(errores);
      }),
    );
  });
}

/**
 * Inicia sesión en los dos servidores, cada uno con SU token. Entra en cuanto el primero
 * responde bien (no espera a uno apagado); el token del otro se agrega cuando llegue.
 */
export async function iniciarSesion(usuario: string, contrasena: string): Promise<UsuarioSesion> {
  const login = (id: ServidorId) =>
    pedirServidor(id, '/api/auth/login', { method: 'POST', body: JSON.stringify({ usuario, contrasena }) }) as Promise<RespuestaLogin>;
  const intentos = SERVIDORES_IDS.map((id) => login(id).then((respuesta) => ({ id, ...respuesta })));

  let primero: RespuestaLogin & { id: ServidorId };
  try {
    primero = await primeraQueFunciona(intentos);
  } catch (errores) {
    throw errorPrincipal(errores as unknown[]);
  }
  const datos = primero.usuario;
  guardarSesion({ usuario: datos, tokens: { [primero.id]: primero.token } });
  bitacora.exito('cuenta', `Sesión iniciada: ${datos.usuario} (servidor ${NUMERO[primero.id]})`);

  // Los demás servidores, en segundo plano.
  const sigueLaMismaSesion = () => leerSesion()?.usuario.usuario === datos.usuario;
  SERVIDORES_IDS.forEach((id, i) => {
    if (id === primero.id) return;
    intentos[i].then(
      ({ token }) => {
        if (!sigueLaMismaSesion()) return;
        cambiarToken(id, token);
        bitacora.exito('cuenta', `Sesión iniciada también en el servidor ${NUMERO[id]}`);
      },
      async (error) => {
        if (status(error) !== 401) return; // Apagado o sin la función: se queda sin token de ese servidor
        // No conoce la cuenta (estaba apagado al registrarse): se le crea con los mismos datos y se
        // entra. Si ya la tiene con otra contraseña, responde 409 y no se toca.
        try {
          await pedirServidor(id, '/api/auth/registro', { method: 'POST', body: JSON.stringify({ ...datos, contrasena }) });
          bitacora.exito('cuenta', `Cuenta copiada al servidor ${NUMERO[id]}`);
          const { token } = await login(id);
          if (sigueLaMismaSesion()) cambiarToken(id, token);
        } catch {
          bitacora.aviso('cuenta', `No se pudo copiar la cuenta al servidor ${NUMERO[id]}`);
        }
      },
    );
  });
  return datos;
}

export function cerrarSesion() {
  guardarSesion(null);
  bitacora.info('cuenta', 'Sesión cerrada');
}
