import { Router } from 'express';

import { insertarRegistro, listarRegistros } from '../db/georreferencia.js';
import { validarRegistro } from '../middleware/validarRegistro.js';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Filtros opcionales de GET /api/clima: ?usuario=…&lugar=…&desde=AAAA-MM-DD&hasta=AAAA-MM-DD&limite=…
 * Devuelve el texto del error si alguno es inválido.
 */
function leerFiltros(query) {
  const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');
  const filtros = {
    limite: Math.min(Math.max(Number.parseInt(query.limite, 10) || 50, 1), 200),
    usuario: texto(query.usuario).toLowerCase() || null,
    lugar: texto(query.lugar) || null,
    desde: texto(query.desde) || null,
    hasta: texto(query.hasta) || null,
  };
  if (filtros.usuario && filtros.usuario.length > 50) return '"usuario" admite máximo 50 caracteres.';
  if (filtros.lugar && filtros.lugar.length > 80) return '"lugar" admite máximo 80 caracteres.';
  for (const campo of ['desde', 'hasta']) {
    if (filtros[campo] && !FECHA.test(filtros[campo])) return `"${campo}" debe tener el formato AAAA-MM-DD.`;
  }
  return filtros;
}

export function rutasClima(servidor) {
  const rutas = Router();

  // Guarda un registro enviado por la app (comando "guardar en servidor …").
  rutas.post('/', validarRegistro, async (req, res) => {
    // Quién guarda sale de la sesión, no de lo que mande la app.
    req.registro = { ...req.registro, ...req.usuario };
    const { id, fechaHora } = await insertarRegistro(req.registro);
    console.log(`Registro ${id} guardado (${req.registro.usuario}, ${req.registro.municipio ?? 'sin municipio'})`);
    res.status(201).json({ ok: true, servidor, id, fechaHora });
  });

  // Últimos registros guardados en este servidor y cuántos hay en total.
  rutas.get('/', async (req, res) => {
    const filtros = leerFiltros(req.query);
    if (typeof filtros === 'string') {
      return res.status(400).json({ ok: false, error: filtros });
    }
    const { registros, total } = await listarRegistros(filtros);
    res.json({ ok: true, servidor, total, registros });
  });

  return rutas;
}
