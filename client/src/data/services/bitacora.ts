// Bitácora (logs) de la app: qué pasó en cada orden que se le dio a Barbie y en qué paso falló.
// Vive en memoria (se borra al cerrar la app) y también se imprime en la consola de Expo.

export type Nivel = 'info' | 'exito' | 'aviso' | 'error';
export type Origen = 'voz' | 'barbie' | 'gemini' | 'servidor' | 'clima' | 'cuenta' | 'app';

export type Evento = {
  id: number;
  fecha: number; // ms desde 1970
  nivel: Nivel;
  origen: Origen;
  mensaje: string;
  detalle?: string; // Información técnica para depurar (código HTTP, respuesta del servidor…)
  duracionMs?: number;
  orden?: number; // Orden de Barbie a la que pertenece
};

export type Orden = {
  id: number;
  texto: string; // Lo que se le dijo a Barbie (o qué botón se tocó)
  inicio: number;
  fin?: number;
  resultado?: 'exito' | 'aviso' | 'error';
};

export type EstadoBitacora = { eventos: Evento[]; ordenes: Orden[] };

const MAX_EVENTOS = 300;
const MAX_ORDENES = 50;

let estado: EstadoBitacora = { eventos: [], ordenes: [] };
let siguienteId = 1;
let ordenActual: number | null = null;
const oyentes = new Set<() => void>();

function publicar(nuevo: EstadoBitacora) {
  estado = nuevo;
  oyentes.forEach((oyente) => oyente());
}

const CONSOLA: Record<Nivel, (...datos: unknown[]) => void> = {
  info: console.log,
  exito: console.log,
  aviso: console.warn,
  error: console.error,
};

export function registrar(
  nivel: Nivel,
  origen: Origen,
  mensaje: string,
  extra: { detalle?: string; duracionMs?: number } = {},
) {
  const evento: Evento = {
    id: siguienteId++,
    fecha: Date.now(),
    nivel,
    origen,
    mensaje,
    ...extra,
    ...(ordenActual !== null ? { orden: ordenActual } : {}),
  };
  CONSOLA[nivel](`[${origen}] ${mensaje}${extra.detalle ? ` — ${extra.detalle}` : ''}`);
  publicar({ ...estado, eventos: [...estado.eventos, evento].slice(-MAX_EVENTOS) });
}

export const bitacora = {
  info: (origen: Origen, mensaje: string, extra?: { detalle?: string; duracionMs?: number }) =>
    registrar('info', origen, mensaje, extra),
  exito: (origen: Origen, mensaje: string, extra?: { detalle?: string; duracionMs?: number }) =>
    registrar('exito', origen, mensaje, extra),
  aviso: (origen: Origen, mensaje: string, extra?: { detalle?: string; duracionMs?: number }) =>
    registrar('aviso', origen, mensaje, extra),
  error: (origen: Origen, mensaje: string, extra?: { detalle?: string; duracionMs?: number }) =>
    registrar('error', origen, mensaje, extra),
};

/** Empieza a agrupar los eventos siguientes bajo una orden. Si ya hay una en curso, la reutiliza. */
export function iniciarOrden(texto: string): number {
  if (ordenActual !== null) return ordenActual;
  const orden: Orden = { id: siguienteId++, texto, inicio: Date.now() };
  ordenActual = orden.id;
  publicar({ ...estado, ordenes: [...estado.ordenes, orden].slice(-MAX_ORDENES) });
  return orden.id;
}

/** Cierra la orden en curso. Su resultado es el peor nivel que tuvo alguno de sus pasos. */
export function terminarOrden() {
  if (ordenActual === null) return;
  const id = ordenActual;
  ordenActual = null;
  const niveles = estado.eventos.filter((evento) => evento.orden === id).map((evento) => evento.nivel);
  const resultado = niveles.includes('error') ? 'error' : niveles.includes('aviso') ? 'aviso' : 'exito';
  publicar({
    ...estado,
    ordenes: estado.ordenes.map((orden) => (orden.id === id ? { ...orden, fin: Date.now(), resultado } : orden)),
  });
}

export function limpiarBitacora() {
  publicar({ eventos: [], ordenes: estado.ordenes.filter((orden) => orden.id === ordenActual) });
}

export function suscribirBitacora(oyente: () => void) {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export const leerBitacora = () => estado;

/** Mide cuánto tarda una operación, para registrarlo junto al resultado. */
export function cronometro() {
  const inicio = Date.now();
  return () => Date.now() - inicio;
}
