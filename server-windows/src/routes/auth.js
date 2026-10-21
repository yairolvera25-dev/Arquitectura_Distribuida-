import { randomInt } from 'node:crypto';

import { Router } from 'express';

import { buscarUsuario, cambiarContrasena, crearUsuario, esUsuarioDuplicado, guardarSecreto2FA } from '../db/usuarios.js';
import { anotarExito, anotarFallo, limitarIntentos } from '../middleware/limiteIntentos.js';
import { exigirSesion } from '../middleware/sesion.js';
import { cifrarContrasena, verificarContrasena } from '../seguridad/contrasenas.js';
import { firmarToken, firmarTokenPendiente, revocarToken, verificarTokenPendiente } from '../seguridad/tokens.js';
import {
  cifrarSecreto,
  datosParaVincular,
  descifrarSecreto,
  esSecretoValido,
  generarSecreto,
  marcarUsado,
  verificarCodigo,
} from '../seguridad/totp.js';

const USUARIO_VALIDO = /^[a-z0-9._-]{3,30}$/;
const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

// Código de recuperación: 12 caracteres sin los que se confunden (0/O, 1/I/L), tipo K7QF-M2XP-9TRW.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODIGO_VALIDO = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/;
const normalizarCodigo = (valor) => texto(valor).toUpperCase().replace(/[^A-Z0-9]/g, '');
const formatearCodigo = (codigo) => codigo.match(/.{4}/g).join('-');
const generarCodigo = () => Array.from({ length: 12 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');

function validarContrasena(contrasena) {
  if (contrasena.length < 8 || contrasena.length > 72) return 'La contraseña debe tener de 8 a 72 caracteres.';
  if (!/[a-zA-Z]/.test(contrasena) || !/[0-9]/.test(contrasena)) {
    return 'La contraseña debe tener al menos una letra y un número.';
  }
  return null;
}

function validarCuenta(cuerpo) {
  const errores = [];
  const usuario = texto(cuerpo.usuario).toLowerCase();
  const nombre = texto(cuerpo.nombre);
  const paterno = texto(cuerpo.paterno);
  const materno = texto(cuerpo.materno);
  const contrasena = typeof cuerpo.contrasena === 'string' ? cuerpo.contrasena : '';

  if (!USUARIO_VALIDO.test(usuario)) {
    errores.push('El usuario debe tener de 3 a 30 caracteres: letras, números, punto, guion o guion bajo.');
  }
  if (!nombre || nombre.length > 50) errores.push('El nombre es obligatorio (máximo 50 caracteres).');
  if (paterno.length > 50 || materno.length > 50) errores.push('Los apellidos admiten máximo 50 caracteres.');
  const problema = validarContrasena(contrasena);
  if (problema) errores.push(problema);
  // La app manda el código que generó el otro servidor, para que sea el mismo en los dos.
  const codigo = cuerpo.codigoRecuperacion === undefined ? generarCodigo() : normalizarCodigo(cuerpo.codigoRecuperacion);
  if (!CODIGO_VALIDO.test(codigo)) errores.push('El código de recuperación no es válido.');
  return {
    errores,
    cuenta: { usuario, nombre, paterno: paterno || null, materno: materno || null, contrasena },
    codigo,
  };
}

const ERROR_TOTP = {
  incorrecto: 'Código de verificación incorrecto.',
  vencido: 'Ese código ya venció; escribe el que muestra ahora tu app autenticadora.',
  usado: 'Ese código ya se usó; espera a que tu app muestre el siguiente.',
};

/** Exige el token que da el login cuando la contraseña es correcta, y deja el usuario en `req.intentoDe`. */
function exigirPendiente(req, res, next) {
  try {
    req.intentoDe = verificarTokenPendiente(texto(req.body?.tokenPendiente));
    next();
  } catch {
    res.status(401).json({ ok: false, codigo: 'PENDIENTE', error: 'Pasó mucho tiempo; vuelve a escribir tu usuario y contraseña.' });
  }
}

export function rutasAuth(servidor) {
  const rutas = Router();

  // Crear cuenta. La contraseña y el código de recuperación se guardan cifrados (scrypt).
  // El código se devuelve en texto UNA sola vez, para que la persona lo guarde.
  rutas.post('/registro', async (req, res) => {
    const { errores, cuenta, codigo } = validarCuenta(req.body ?? {});
    if (errores.length) {
      return res.status(400).json({ ok: false, error: errores[0], errores });
    }
    try {
      const [contrasenaCifrada, codigoCifrado] = await Promise.all([
        cifrarContrasena(cuenta.contrasena),
        cifrarContrasena(codigo),
      ]);
      const { id } = await crearUsuario({ ...cuenta, contrasena: contrasenaCifrada, codigoRecuperacion: codigoCifrado });
      console.log(`Usuario ${cuenta.usuario} registrado (id ${id})`);
      const { contrasena, ...publico } = cuenta;
      res.status(201).json({ ok: true, servidor, usuario: publico, codigoRecuperacion: formatearCodigo(codigo) });
    } catch (error) {
      if (esUsuarioDuplicado(error)) {
        return res.status(409).json({ ok: false, error: 'Ese usuario ya existe; elige otro.' });
      }
      throw error;
    }
  });

  // Paso 1 de 2: usuario y contraseña. El mensaje de error es el mismo si el usuario no existe o
  // la contraseña está mal, para no revelar qué usuarios existen. Si son correctos NO se entrega la
  // sesión, solo un token pendiente para el paso 2 (código TOTP). Si la cuenta todavía no vincula
  // su app autenticadora, también se manda un secreto nuevo con su QR.
  rutas.post('/login', limitarIntentos, async (req, res) => {
    const usuario = texto(req.body?.usuario).toLowerCase();
    const contrasena = typeof req.body?.contrasena === 'string' ? req.body.contrasena : '';
    const encontrado = usuario ? await buscarUsuario(usuario) : null;
    const correcta = await verificarContrasena(contrasena, encontrado?.contrasena ?? null);

    if (!encontrado || !correcta) {
      anotarFallo(req);
      console.warn(`Inicio de sesión fallido para "${usuario}" desde ${req.ip}`);
      return res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos.' });
    }
    // El contador de fallos NO se limpia aquí: si no, quien sepa la contraseña podría probar
    // códigos TOTP sin límite volviendo a entrar cada 4 intentos.
    const tokenPendiente = firmarTokenPendiente(encontrado.usuario);
    if (encontrado.secreto2fa) {
      console.log(`Contraseña correcta: ${encontrado.usuario}; falta el código TOTP`);
      return res.json({ ok: true, servidor, paso: 'codigo', tokenPendiente });
    }
    console.log(`Contraseña correcta: ${encontrado.usuario}; falta vincular la app autenticadora`);
    const vincular = await datosParaVincular(encontrado.usuario, generarSecreto());
    res.json({ ok: true, servidor, paso: 'configurar', tokenPendiente, ...vincular });
  });

  // Paso 2 de 2: el código de 6 dígitos de Google/Microsoft Authenticator. Solo aquí se entrega la
  // sesión. Al vincular (cuenta sin secreto) llega también el secreto del QR que se escaneó: la app
  // manda el mismo a los dos servidores, para que un solo código sirva en ambos.
  rutas.post('/2fa', exigirPendiente, limitarIntentos, async (req, res) => {
    const usuario = req.intentoDe;
    const codigo = texto(req.body?.codigo).replace(/\s/g, '');
    const encontrado = await buscarUsuario(usuario);
    if (!encontrado) {
      return res.status(401).json({ ok: false, codigo: 'PENDIENTE', error: 'Vuelve a escribir tu usuario y contraseña.' });
    }

    let secreto;
    const vinculando = !encontrado.secreto2fa;
    if (vinculando) {
      secreto = texto(req.body?.secreto).toUpperCase();
      if (!esSecretoValido(secreto)) {
        return res.status(409).json({
          ok: false,
          codigo: 'SIN_2FA',
          error: 'Este servidor no tiene vinculada tu app autenticadora; restablece tu contraseña para volver a vincularla.',
        });
      }
    } else {
      try {
        secreto = descifrarSecreto(encontrado.secreto2fa);
      } catch {
        // Se cifró con otro TOKEN_SECRET o el valor está alterado.
        console.error(`No se pudo descifrar el secreto TOTP de ${usuario}`);
        return res.status(409).json({
          ok: false,
          codigo: 'SIN_2FA',
          error: 'No se pudo leer tu verificación en dos pasos; restablece tu contraseña para volver a vincularla.',
        });
      }
    }

    const { estado, periodo } = verificarCodigo(secreto, codigo);
    const motivo = estado !== 'valido' ? estado : marcarUsado(usuario, periodo) ? null : 'usado';
    if (motivo) {
      anotarFallo(req);
      console.warn(`Código TOTP ${motivo} para "${usuario}" desde ${req.ip}`);
      return res.status(401).json({ ok: false, codigo: 'TOTP', motivo, error: ERROR_TOTP[motivo] });
    }
    if (vinculando && !(await guardarSecreto2FA(usuario, cifrarSecreto(secreto)))) {
      return res.status(409).json({ ok: false, error: 'La app autenticadora se acaba de vincular desde otro lado; vuelve a iniciar sesión.' });
    }

    anotarExito(req);
    const publico = {
      usuario: encontrado.usuario,
      nombre: encontrado.nombre,
      paterno: encontrado.paterno,
      materno: encontrado.materno,
    };
    console.log(`Sesión iniciada con 2FA: ${publico.usuario}${vinculando ? ' (app autenticadora vinculada)' : ''}`);
    res.json({ ok: true, servidor, token: firmarToken(publico), usuario: publico });
  });

  // Restablecer la contraseña con el código de recuperación que se dio al crear la cuenta.
  // Mismo mensaje si el usuario no existe o el código está mal, y mismo límite de intentos que el login.
  // También desvincula la app autenticadora (por si se perdió el teléfono): se vuelve a vincular al entrar.
  rutas.post('/restablecer', limitarIntentos, async (req, res) => {
    const usuario = texto(req.body?.usuario).toLowerCase();
    const codigo = normalizarCodigo(req.body?.codigo);
    const nueva = typeof req.body?.contrasena === 'string' ? req.body.contrasena : '';
    const problema = validarContrasena(nueva);
    if (problema) return res.status(400).json({ ok: false, error: problema });

    const encontrado = usuario ? await buscarUsuario(usuario) : null;
    const correcto = await verificarContrasena(codigo, encontrado?.codigoRecuperacion ?? null);
    if (!encontrado || !correcto) {
      anotarFallo(req);
      console.warn(`Restablecimiento fallido para "${usuario}" desde ${req.ip}`);
      return res.status(401).json({ ok: false, error: 'Usuario o código de recuperación incorrectos.' });
    }
    anotarExito(req);
    await cambiarContrasena(encontrado.usuario, await cifrarContrasena(nueva));
    console.log(`Contraseña restablecida: ${encontrado.usuario}`);
    res.json({ ok: true, servidor });
  });

  // Quién soy (para comprobar que el token sigue siendo válido).
  rutas.get('/yo', exigirSesion, (req, res) => {
    res.json({ ok: true, servidor, usuario: req.usuario });
  });

  // Cerrar sesión: el token deja de servir en este servidor aunque todavía no venza.
  rutas.post('/salir', exigirSesion, (req, res) => {
    revocarToken(req.token);
    console.log(`Sesión cerrada: ${req.usuario.usuario}`);
    res.json({ ok: true, servidor });
  });

  return rutas;
}
