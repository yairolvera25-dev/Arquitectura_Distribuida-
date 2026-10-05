import { Router } from 'express';

import { insertarEventos, listarEventos } from '../db/bitacora.js';

const NIVELES = new Set(['info', 'exito', 'aviso', 'error']);
const MAX_EVENTOS = 200;
const recortar = (valor, maximo) => (typeof valor === 'string' && valor.trim() ? valor.trim().slice(0, maximo) : null);

/** Respaldo de la bitácora de la app. Los eventos quedan a nombre de quien tiene la sesión. */
export function rutasBitacora(servidor) {
  const rutas = Router();

  rutas.post('/', async (req, res) => {
    const lista = req.body?.eventos;
    if (!Array.isArray(lista) || lista.length === 0 || lista.length > MAX_EVENTOS) {
      return res.status(400).json({ ok: false, error: `Manda de 1 a ${MAX_EVENTOS} eventos en "eventos".` });
    }
    const eventos = [];
    for (const evento of lista) {
      const fecha = new Date(Number(evento?.fecha));
      const mensaje = recortar(evento?.mensaje, 500);
      if (!NIVELES.has(evento?.nivel) || !mensaje || Number.isNaN(fecha.getTime())) {
        return res.status(400).json({ ok: false, error: 'Cada evento necesita fecha, nivel (info, exito, aviso o error) y mensaje.' });
      }
      eventos.push({
        fecha,
        nivel: evento.nivel,
        origen: recortar(evento.origen, 20) ?? 'app',
        mensaje,
        detalle: recortar(evento.detalle, 1000),
        orden: recortar(evento.orden, 300),
      });
    }
    await insertarEventos(req.usuario.usuario, eventos);
    console.log(`Bitácora: ${eventos.length} eventos respaldados (${req.usuario.usuario})`);
    res.status(201).json({ ok: true, servidor, guardados: eventos.length });
  });

  rutas.get('/', async (req, res) => {
    const limite = Math.min(Math.max(Number.parseInt(req.query.limite, 10) || 50, 1), 200);
    const usuario = typeof req.query.usuario === 'string' && req.query.usuario.trim() ? req.query.usuario.trim().toLowerCase() : null;
    const { eventos, total } = await listarEventos({ limite, usuario });
    res.json({ ok: true, servidor, total, eventos });
  });

  return rutas;
}
