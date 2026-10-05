import { Router } from 'express';

import { buscarUsuario, crearUsuario, esUsuarioDuplicado } from '../db/usuarios.js';
import { anotarExito, anotarFallo, limitarIntentos } from '../middleware/limiteIntentos.js';
import { exigirSesion } from '../middleware/sesion.js';
import { cifrarContrasena, verificarContrasena } from '../seguridad/contrasenas.js';
import { firmarToken } from '../seguridad/tokens.js';

const USUARIO_VALIDO = /^[a-z0-9._-]{3,30}$/;
const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

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
  if (contrasena.length < 8 || contrasena.length > 72) {
    errores.push('La contraseña debe tener de 8 a 72 caracteres.');
  } else if (!/[a-zA-Z]/.test(contrasena) || !/[0-9]/.test(contrasena)) {
    errores.push('La contraseña debe tener al menos una letra y un número.');
  }
  return { errores, cuenta: { usuario, nombre, paterno: paterno || null, materno: materno || null, contrasena } };
}

export function rutasAuth(servidor) {
  const rutas = Router();

  // Crear cuenta. La contraseña se guarda cifrada (scrypt), nunca en texto plano.
  rutas.post('/registro', async (req, res) => {
    const { errores, cuenta } = validarCuenta(req.body ?? {});
    if (errores.length) {
      return res.status(400).json({ ok: false, error: errores[0], errores });
    }
    try {
      const contrasenaCifrada = await cifrarContrasena(cuenta.contrasena);
      const { id } = await crearUsuario({ ...cuenta, contrasena: contrasenaCifrada });
      console.log(`Usuario ${cuenta.usuario} registrado (id ${id})`);
      const { contrasena, ...publico } = cuenta;
      res.status(201).json({ ok: true, servidor, usuario: publico });
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

  // Quién soy (para comprobar que el token sigue siendo válido).
  rutas.get('/yo', exigirSesion, (req, res) => {
    res.json({ ok: true, servidor, usuario: req.usuario });
  });

  return rutas;
}
