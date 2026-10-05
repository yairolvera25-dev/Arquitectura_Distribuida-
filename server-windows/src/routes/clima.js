import { Router } from 'express';

import { insertarRegistro, listarRegistros } from '../db/georreferencia.js';
import { validarRegistro } from '../middleware/validarRegistro.js';

export function rutasClima(servidor) {
  const rutas = Router();

  // Guarda un registro enviado por la app (comando "guardar en servidor …").
  rutas.post('/', validarRegistro, async (req, res) => {
    const { id, fechaHora } = await insertarRegistro(req.registro);
    console.log(`Registro ${id} guardado (${req.registro.usuario}, ${req.registro.municipio ?? 'sin municipio'})`);
    res.status(201).json({ ok: true, servidor, id, fechaHora });
  });

  // Últimos registros guardados en este servidor y cuántos hay en total.
  rutas.get('/', async (req, res) => {
    const limite = Math.min(Math.max(Number.parseInt(req.query.limite, 10) || 50, 1), 200);
    const { registros, total } = await listarRegistros(limite);
    res.json({ ok: true, servidor, total, registros });
  });

  return rutas;
}
