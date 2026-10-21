// Registro e inicio de sesión. Las cuentas viven en los DOS servidores (tabla Usuarios en
// SQL Server y en PostgreSQL), así que se puede entrar aunque uno esté apagado. La app guarda
// un token por servidor, así que funciona aunque cada uno firme con su propio TOKEN_SECRET.
// Entrar tiene dos pasos (2FA): usuario y contraseña, y luego el código TOTP de 6 dígitos de
// Google Authenticator o Microsoft Authenticator. Sin el segundo no hay sesión.

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

/** Paso 1 (usuario y contraseña correctos): todavía no hay sesión, falta el código TOTP. */
type RespuestaLogin = {
  paso: 'codigo' | 'configurar';
  tokenPendiente: string;
  // Solo con paso 'configurar': la cuenta todavía no vincula su app autenticadora.
  secreto?: string;
  enlace?: string;
  qr?: string;
};
type RespuestaSesion = { token: string; usuario: UsuarioSesion };

/** Inicio de sesión a la mitad: la contraseña ya es correcta y falta el código de 6 dígitos. */
export type Verificacion = {
  usuario: string;
  /** 'codigo': ya tiene la app vinculada. 'configurar': primero hay que escanear el QR. */
  paso: 'codigo' | 'configurar';
  /** Al configurar: el QR (PNG en data URI), el enlace otpauth:// y la clave para escribirla a mano. */
  vincular: { secreto: string; enlace: string; qr: string } | null;
  contrasena: string;
  /** Paso 1 en cada servidor, en el orden de SERVIDORES_IDS. */
  intentos: Promise<RespuestaLogin>[];
};

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

const pedirLogin = (id: ServidorId, usuario: string, contrasena: string) =>
  pedirServidor(id, '/api/auth/login', { method: 'POST', body: JSON.stringify({ usuario, contrasena }) }) as Promise<RespuestaLogin>;

const pedirSesion = (id: ServidorId, tokenPendiente: string, codigo: string, secreto?: string) =>
  pedirServidor(id, '/api/auth/2fa', {
    method: 'POST',
    body: JSON.stringify({ tokenPendiente, codigo, ...(secreto ? { secreto } : {}) }),
  }) as Promise<RespuestaSesion>;

/**
 * Paso 1 de 2: usuario y contraseña en los dos servidores. Sigue en cuanto el primero responde bien
 * (no espera a uno apagado). Todavía NO hay sesión: falta `verificarCodigo` con el código TOTP.
 */
export async function iniciarSesion(usuario: string, contrasena: string): Promise<Verificacion> {
  const intentos = SERVIDORES_IDS.map((id) => pedirLogin(id, usuario, contrasena));
  let primero: RespuestaLogin & { id: ServidorId };
  try {
    primero = await primeraQueFunciona(intentos.map((intento, i) => intento.then((r) => ({ ...r, id: SERVIDORES_IDS[i] }))));
  } catch (errores) {
    throw errorPrincipal(errores as unknown[]);
  }
  const { paso, secreto, enlace, qr } = primero;
  bitacora.info(
    'cuenta',
    paso === 'configurar'
      ? `Contraseña correcta; falta vincular la app autenticadora (servidor ${NUMERO[primero.id]})`
      : `Contraseña correcta; falta el código de verificación (servidor ${NUMERO[primero.id]})`,
  );
  return {
    usuario,
    paso,
    vincular: paso === 'configurar' && secreto && enlace && qr ? { secreto, enlace, qr } : null,
    contrasena,
    intentos,
  };
}

/**
 * Paso 2 de 2: el código de Google/Microsoft Authenticator. Cada servidor lo valida por su cuenta y
 * entrega SU token; se entra con el primero que lo acepta y el otro se agrega en segundo plano.
 * Al vincular, se manda a los dos el secreto del QR que se escaneó, para que el mismo código sirva en ambos.
 */
export async function verificarCodigo(verificacion: Verificacion, codigo: string): Promise<UsuarioSesion> {
  const { usuario, contrasena, intentos } = verificacion;
  const secreto = verificacion.vincular?.secreto;
  const pasos = SERVIDORES_IDS.map((id, i) =>
    intentos[i].then(({ tokenPendiente }) => pedirSesion(id, tokenPendiente, codigo, secreto)).then((r) => ({ ...r, id })),
  );

  let primero: RespuestaSesion & { id: ServidorId };
  try {
    primero = await primeraQueFunciona(pasos);
  } catch (errores) {
    // Un servidor que rechazó la contraseña en el paso 1 no explica por qué falló el código.
    const erroresLogin = await Promise.all(intentos.map((intento) => intento.then(() => null, (e: unknown) => e)));
    const delCodigo = (errores as unknown[]).filter((error) => !erroresLogin.includes(error));
    throw errorPrincipal(delCodigo.length ? delCodigo : (errores as unknown[]));
  }
  const datos = primero.usuario;
  guardarSesion({ usuario: datos, tokens: { [primero.id]: primero.token } });
  bitacora.exito('cuenta', `Sesión iniciada con verificación en dos pasos: ${datos.usuario} (servidor ${NUMERO[primero.id]})`);

  // Los demás servidores, en segundo plano.
  const sigueLaMismaSesion = () => leerSesion()?.usuario.usuario === datos.usuario;
  SERVIDORES_IDS.forEach((id, i) => {
    if (id === primero.id) return;
    pasos[i].then(
      ({ token }) => {
        if (!sigueLaMismaSesion()) return;
        cambiarToken(id, token);
        bitacora.exito('cuenta', `Sesión iniciada también en el servidor ${NUMERO[id]}`);
      },
      async (error) => {
        if (status(error) === 409) {
          bitacora.aviso('cuenta', `El servidor ${NUMERO[id]} no tiene vinculada tu app autenticadora`, {
            detalle: 'Restablece tu contraseña con el código de recuperación para vincularla en los dos servidores.',
          });
          return;
        }
        const errorLogin = await intentos[i].then(
          () => null,
          (e: unknown) => e,
        );
        if (status(errorLogin) !== 401) return; // Apagado o sin la función: se queda sin token de ese servidor
        // No conoce la cuenta (estaba apagado al registrarse): se le crea con los mismos datos. Si ya la
        // tiene con otra contraseña, responde 409 y no se toca. La app autenticadora solo se le puede
        // vincular si se acaba de escanear el QR (el secreto no se vuelve a mostrar después).
        try {
          await pedirServidor(id, '/api/auth/registro', { method: 'POST', body: JSON.stringify({ ...datos, contrasena }) });
          bitacora.exito('cuenta', `Cuenta copiada al servidor ${NUMERO[id]}`);
        } catch {
          bitacora.aviso('cuenta', `No se pudo copiar la cuenta al servidor ${NUMERO[id]}`);
          return;
        }
        if (!secreto) {
          bitacora.aviso('cuenta', `El servidor ${NUMERO[id]} quedó sin la verificación en dos pasos`, {
            detalle: 'Restablece tu contraseña con el código de recuperación para vincularla en los dos servidores.',
          });
          return;
        }
        try {
          const { tokenPendiente } = await pedirLogin(id, usuario, contrasena);
          const { token } = await pedirSesion(id, tokenPendiente, codigo, secreto);
          if (sigueLaMismaSesion()) cambiarToken(id, token);
        } catch {
          bitacora.aviso('cuenta', `No se pudo entrar al servidor ${NUMERO[id]} con la cuenta copiada`);
        }
      },
    );
  });
  return datos;
}

/** Cierra la sesión en la app y en cada servidor, para que sus tokens dejen de servir. */
export function cerrarSesion() {
  const tokens = leerSesion()?.tokens ?? {};
  // pedirServidor toma el token en cuanto se llama, antes de que guardarSesion(null) lo borre.
  for (const id of Object.keys(tokens) as ServidorId[]) {
    pedirServidor(id, '/api/auth/salir', { method: 'POST' }).catch(() => {});
  }
  guardarSesion(null);
  bitacora.info('cuenta', 'Sesión cerrada');
}
