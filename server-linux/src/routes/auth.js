import { randomInt } from 'node:crypto';

import { Router } from 'express';

import { buscarUsuario, cambiarContrasena, crearUsuario, esUsuarioDuplicado } from '../db/usuarios.js';
import { anotarExito, anotarFallo, limitarIntentos } from '../middleware/limiteIntentos.js';
import { exigirSesion } from '../middleware/sesion.js';
import { cifrarContrasena, verificarContrasena } from '../seguridad/contrasenas.js';
import { firmarToken } from '../seguridad/tokens.js';

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

  // Iniciar sesión. El mensaje de error es el mismo si el usuario no existe o la contraseña
  // está mal, para no revelar qué usuarios existen.
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
    anotarExito(req);
    const publico = {
      usuario: encontrado.usuario,
      nombre: encontrado.nombre,
      paterno: encontrado.paterno,
      materno: encontrado.materno,
    };
    console.log(`Sesión iniciada: ${publico.usuario}`);
    res.json({ ok: true, servidor, token: firmarToken(publico), usuario: publico });
  });

  // Restablecer la contraseña con el código de recuperación que se dio al crear la cuenta.
  // Mismo mensaje si el usuario no existe o el código está mal, y mismo límite de intentos que el login.
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

  return rutas;
}
