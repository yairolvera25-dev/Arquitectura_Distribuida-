// La inteligencia de Barbie: Gemini con la API REST generateContent
// (https://ai.google.dev/api/generate-content) y dos herramientas que ejecuta la app:
// guardar el clima y consultar lo que hay en cada servidor.

import { GEMINI, type ServidorId } from '../../config';
import { bitacora, cronometro } from './bitacora';
import { CONDICIONES, type RegistroClima } from './clima';
import type { Pronostico } from './pronostico';
import { DATOS_CLIMA, type DatoClima, type FiltrosConsulta, type RegistroGuardado } from './servidores';
import type { EventoRespaldado, ResultadoRespaldo } from './respaldo';
import { leerSesion, nombreCompleto } from './sesion';

const URL_MODELOS = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIEMPO_LIMITE_MS = 20000;
const MAX_VUELTAS = 4; // Veces que Gemini puede usar herramientas antes de contestar
const TURNOS_EN_MEMORIA = 6; // Preguntas anteriores que recuerda, para "¿y en el dos?"
const MAX_REGISTROS = 50;

type LlamadaHerramienta = { id?: string; name: string; args?: Record<string, unknown> };

// Las partes se devuelven a Gemini tal como llegaron: las llamadas a herramientas
// traen una `thoughtSignature` que el modelo exige de vuelta.
type Parte = {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  functionCall?: LlamadaHerramienta;
  functionResponse?: { id?: string; name: string; response: Record<string, unknown> };
};
type Contenido = { role: 'user' | 'model'; parts: Parte[] };

export type ContextoBarbie = {
  clima: RegistroClima | null;
  pronostico: Pronostico | null;
  /** true si el dashboard muestra una ciudad elegida y no la ubicación real del GPS. */
  ubicacionElegida?: boolean;
};

export type AccionesBarbie = {
  guardar: (
    servidor: ServidorId,
    datos?: DatoClima[],
  ) => Promise<{ id: number; fechaHora: string; contenido: Partial<RegistroClima> }>;
  respaldarBitacora: (servidores: ServidorId[]) => Promise<ResultadoRespaldo[]>;
  cambiarUbicacion: (lugar: string) => Promise<RegistroClima>;
  volverAMiUbicacion: () => Promise<RegistroClima>;
  consultarBitacora: (servidor: ServidorId, limite: number) => Promise<{ total: number; eventos: EventoRespaldado[] }>;
  consultar: (servidor: ServidorId, filtros: FiltrosConsulta) => Promise<{ total: number | null; registros: RegistroGuardado[] }>;
};

const SERVIDOR_POR_NUMERO: Record<string, ServidorId> = { uno: 'windows', dos: 'linux' };
const NUMERO: Record<ServidorId, string> = { windows: 'uno', linux: 'dos' };

const PARAMETRO_SERVIDOR = {
  type: 'string',
  enum: ['uno', 'dos'],
  description: 'Servidor uno (Windows Server con SQL Server) o servidor dos (Ubuntu Server con PostgreSQL).',
};

const PARAMETRO_SERVIDORES = {
  type: 'string',
  enum: ['uno', 'dos', 'ambos'],
  description: 'Servidor uno (Windows, SQL Server), servidor dos (Ubuntu, PostgreSQL) o ambos.',
};

const SERVIDORES_DE: Record<string, ServidorId[]> = { uno: ['windows'], dos: ['linux'], ambos: ['windows', 'linux'] };

const HERRAMIENTAS = [
  {
    functionDeclarations: [
      {
        name: 'guardar_clima',
        description:
          'Guarda (respalda) el clima actual en la base de datos de un servidor o de ambos. Úsala solo cuando ' +
          'pidan guardar o respaldar. Si piden cosas distintas en cada servidor ("el clima en el uno y la ' +
          'ubicación en el dos"), llámala una vez por servidor con sus datos.',
        parameters: {
          type: 'object',
          properties: {
            servidor: PARAMETRO_SERVIDORES,
            datos: {
              type: 'array',
              items: { type: 'string', enum: ['todo', ...DATOS_CLIMA, 'hora'] },
              description:
                'Qué guardar. "todo" es el registro completo y es lo normal si no se especifica. ' +
                'Si pide solo algunos datos, manda solo esos. Quién guarda y la fecha y hora se registran siempre, ' +
                'así que para guardar solo la hora manda ["hora"].',
            },
          },
          required: ['servidor', 'datos'],
        },
      },
      {
        name: 'consultar_registros',
        description:
          'Lee los registros más recientes de un servidor (quién guardó, dónde, qué datos y cuándo) y cuántos ' +
          'cumplen los filtros. Úsala siempre que pregunten qué hay guardado, quién guardó, dónde o cuándo; ' +
          'nunca lo inventes. Los filtros son opcionales y se combinan.',
        parameters: {
          type: 'object',
          properties: {
            servidor: PARAMETRO_SERVIDOR,
            limite: {
              type: 'integer',
              description: `Cuántos registros recientes leer, de 1 a ${MAX_REGISTROS}. Usa 10 si no se especifica.`,
            },
            usuario: {
              type: 'string',
              description:
                'Solo los registros de este usuario (su nombre de usuario, p. ej. "haideni"). ' +
                'Para "lo que yo guardé" usa el usuario de quien te habla.',
            },
            lugar: { type: 'string', description: 'Solo los de un municipio o estado; basta parte del nombre.' },
            desde: { type: 'string', description: 'Fecha inicial AAAA-MM-DD (incluida). Calcula "hoy", "ayer", etc.' },
            hasta: { type: 'string', description: 'Fecha final AAAA-MM-DD (incluida).' },
          },
          required: ['servidor'],
        },
      },
      {
        name: 'cambiar_ubicacion',
        description:
          'Cambia el dashboard al clima de otra ciudad o lugar del mundo y devuelve su clima actual. Úsala ' +
          'cuando pregunten por el clima de otro lugar ("¿cómo está el clima en Londres?") o pidan cambiar ' +
          'la ubicación. Después de usarla, guardar_clima guarda el clima y la ubicación de ese lugar.',
        parameters: {
          type: 'object',
          properties: {
            lugar: {
              type: 'string',
              description: 'Nombre de la ciudad, con el país si hace falta para distinguirla (p. ej. "Londres", "París, Francia").',
            },
          },
          required: ['lugar'],
        },
      },
      {
        name: 'usar_mi_ubicacion',
        description: 'Regresa el dashboard a la ubicación real del usuario (su GPS) y devuelve su clima actual.',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'respaldar_bitacora',
        description:
          'Respalda la bitácora (los logs de la app: cada orden, cada paso y cada error) en la base de datos ' +
          'de un servidor o de ambos. Solo manda los eventos que ese servidor todavía no tiene.',
        parameters: { type: 'object', properties: { servidor: PARAMETRO_SERVIDORES }, required: ['servidor'] },
      },
      {
        name: 'consultar_bitacora',
        description: 'Lee los últimos logs respaldados en un servidor (qué pasó, cuándo y si hubo errores).',
        parameters: {
          type: 'object',
          properties: {
            servidor: PARAMETRO_SERVIDOR,
            limite: { type: 'integer', description: 'Cuántos eventos leer, de 1 a 50. Usa 10 si no se especifica.' },
          },
          required: ['servidor'],
        },
      },
    ],
  },
];

const fechaLocal = (fecha: string | Date) =>
  new Date(fecha).toLocaleString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const horaDe = (iso: string) => iso.slice(11, 16); // "2026-10-05T07:12" -> "07:12"

function describirClima(contexto: ContextoBarbie): string {
  const { clima, pronostico } = contexto;
  if (!clima) {
    return 'Todavía no tienes el clima actual: la app lo está obteniendo o no tiene permiso de ubicación.';
  }
  const lugar = [clima.municipio ?? clima.ciudad, clima.estado].filter(Boolean).join(', ');
  let texto =
    (contexto.ubicacionElegida
      ? `El dashboard muestra una ubicación ELEGIDA por el usuario, no donde está: ${lugar} ` +
        `(latitud ${clima.latitud.toFixed(5)}, longitud ${clima.longitud.toFixed(5)}). `
      : `Ubicación actual de quien te habla: ${lugar}, México (latitud ${clima.latitud.toFixed(5)}, ` +
        `longitud ${clima.longitud.toFixed(5)}). `) +
    `Clima actual en ${lugar}: ${clima.temperatura} °C, ${clima.condicion.toLowerCase()}, ` +
    `humedad ${clima.humedad} %, viento ${clima.viento} km/h.`;
  if (pronostico) {
    const dias = pronostico.dias.map((dia) => {
      const nombre = new Date(`${dia.fecha}T12:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric' });
      const condicion = (CONDICIONES[dia.codigo] ?? 'sin dato').toLowerCase();
      return `${nombre}: ${condicion}, máxima ${dia.maxima} °C y mínima ${dia.minima} °C`;
    });
    texto +=
      ` Sensación térmica ${pronostico.sensacion} °C, índice UV ${pronostico.uv}, ` +
      `amanecer ${horaDe(pronostico.amanecer)}, atardecer ${horaDe(pronostico.atardecer)}. ` +
      `Pronóstico de la semana: ${dias.join('; ')}.`;
  }
  return texto;
}

function instrucciones(contexto: ContextoBarbie): string {
  const sesion = leerSesion();
  const quien = sesion
    ? `Te habla ${nombreCompleto(sesion.usuario)}, que inició sesión con el usuario "${sesion.usuario.usuario}".`
    : 'No hay sesión iniciada.';
  const hoy = new Date();
  const fechaIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  return [
    'Eres Barbie, la asistente de voz de la app "Clima Distribuido", un proyecto escolar de la Universidad Politécnica de Pachuca. Eres alegre, amable y breve.',
    'Todo lo que respondes se lee en voz alta: contesta en español de México con una a tres frases cortas, sin markdown, listas, emojis ni símbolos, y escribe las unidades con palabras (grados, por ciento, kilómetros por hora).',
    'La app guarda el clima en dos servidores, cada uno con su propia base de datos: el servidor uno (Windows Server con SQL Server) y el servidor dos (Ubuntu Server con PostgreSQL). Cada registro tiene quién lo guardó, estado, municipio, latitud y longitud, temperatura, humedad, viento, y la fecha y hora, que se ponen solas.',
    'Guarda (o respalda) solo cuando te lo pidan. Si no dicen en qué servidor, pregunta cuál. Si piden guardar solo un dato, guarda solo ese. "Los dos servidores" o "ambos" es servidor "ambos".',
    'Una sola frase puede traer varias órdenes o preguntas ("guarda el clima en el uno y la ubicación en el dos", "dime qué hay en el uno y en el dos", "guarda en ambos y respalda los logs"): hazlas todas, llamando a las herramientas que hagan falta, y contesta todo junto.',
    'Después de guardar, di en qué servidor quedó y el contenido exacto que se guardó (por ejemplo: temperatura 18 grados, humedad 62 por ciento, en Pachuca, Hidalgo). Si en un servidor falló, dilo y por qué.',
    'La bitácora son los logs de la app (cada orden, sus pasos y sus errores). respaldar_bitacora la guarda en los servidores y consultar_bitacora lee lo respaldado.',
    'Para saber qué hay guardado, quién lo guardó, dónde o cuándo, usa consultar_registros con los filtros que hagan falta; nunca lo inventes. Resume en lugar de leer registro por registro: di cuántos son, quién los guardó, desde dónde, qué datos y cuándo. Un dato en null significa que en ese registro no se guardó. Si preguntan por los dos servidores, consulta cada uno.',
    'Cada registro se guarda a nombre de quien tiene la sesión iniciada; no puedes guardar a nombre de otra persona.',
    'Si preguntan dónde están, contesta con su ubicación actual (municipio y estado; las coordenadas solo si las piden).',
    'Si preguntan por el clima de otra ciudad o país, usa cambiar_ubicacion (el dashboard pasa a mostrar ese lugar) y contesta con los datos que devuelve: condición, temperatura, humedad y viento. Para volver a donde está el usuario ("mi ubicación", "regresa", "aquí") usa usar_mi_ubicacion.',
    'Guardar siempre guarda el clima y la ubicación que se está mostrando; si es una ciudad elegida, dilo al confirmar ("guardé el clima de Londres en el servidor uno").',
    'También puedes platicar de cualquier tema y contestar preguntas generales.',
    'El texto viene del reconocimiento de voz y puede traer errores: interprétalo con sentido común. Te activan diciendo tu nombre.',
    `Fecha y hora actual: ${fechaLocal(hoy)} (hoy es ${fechaIso}).`,
    quien,
    describirClima(contexto),
  ].join('\n');
}

type ErrorGemini = { error?: { message?: string; details?: { violations?: { quotaId?: string }[] }[] } };

function mensajeDeError(status: number, modelo: string, cuerpo: ErrorGemini | null): string {
  const detalle = cuerpo?.error?.message ?? '';
  if (status === 400 && /api key/i.test(detalle)) return 'La API key de Gemini no es válida; revisa EXPO_PUBLIC_GEMINI_API_KEY.';
  if (status === 403) return 'Gemini rechazó la API key; revisa EXPO_PUBLIC_GEMINI_API_KEY.';
  if (status === 404) return `Gemini no tiene el modelo ${modelo}; revisa EXPO_PUBLIC_GEMINI_MODELO.`;
  if (status === 429) return 'Se acabó la cuota gratis de todos los modelos de Gemini por ahora; intenta más tarde.';
  if (status >= 500) return 'Gemini está saturado; intenta otra vez en un momento.';
  return `Gemini respondió ${status}.`;
}

// Los modelos 3.x usan `thinkingLevel` y los 2.5 `thinkingBudget`; cada uno rechaza el del otro con un 400.
function razonamientoMinimo(modelo: string) {
  return /^gemini-[3-9]/.test(modelo) ? { thinkingLevel: 'low' } : { thinkingBudget: 0 };
}

/*
 * Cadena de modelos: el plan gratis da ~20 peticiones al día y 5 por minuto POR MODELO, así que
 * Barbie usa el primero disponible de GEMINI.modelos y salta al siguiente si uno se queda sin
 * cuota, está saturado, no existe o tarda demasiado. El que falla se pausa un rato para no
 * esperarlo en cada frase: hasta mañana si se acabó su cuota diaria, un minuto si fue la del minuto.
 */
const TIEMPO_POR_MODELO_MS = 8000;
const PAUSA: Record<'minuto' | 'dia' | 'saturado' | 'noExiste', number> = {
  minuto: 60 * 1000,
  dia: 6 * 60 * 60 * 1000,
  saturado: 2 * 60 * 1000,
  noExiste: 24 * 60 * 60 * 1000,
};
const pausadoHasta = new Map<string, number>();

// Qué modelo generó cada respuesta: al pasarle la conversación a OTRO modelo, sus firmas de
// razonamiento no le sirven y se cambian por el valor que Gemini acepta para saltar la validación.
const autor = new WeakMap<Contenido, string>();
const FIRMA_NEUTRA = 'skip_thought_signature_validator';

function paraModelo(contenidos: Contenido[], modelo: string): Contenido[] {
  return contenidos.map((contenido) => {
    const deOtro = autor.has(contenido) && autor.get(contenido) !== modelo;
    if (!deOtro) return contenido;
    return {
      ...contenido,
      parts: contenido.parts.map((parte) =>
        parte.thoughtSignature ? { ...parte, thoughtSignature: FIRMA_NEUTRA } : parte,
      ),
    };
  });
}

/** Si conviene probar el siguiente modelo, cuánto pausar este; null si el error no se arregla cambiando de modelo. */
function pausaPorFallo(status: number | null, cuerpo: ErrorGemini | null): number | null {
  if (status === null) return PAUSA.saturado; // Sin respuesta o tardó demasiado
  if (status === 404) return PAUSA.noExiste;
  if (status === 429) {
    const cuotas = (cuerpo?.error?.details ?? []).flatMap((d) => d.violations ?? []).map((v) => v.quotaId ?? '');
    return cuotas.some((id) => /PerDay/i.test(id)) ? PAUSA.dia : PAUSA.minuto;
  }
  if (status >= 500) return PAUSA.saturado;
  if (status === 400 && /signature/i.test(cuerpo?.error?.message ?? '')) return 0;
  return null;
}

function pedir(modelo: string, contenidos: Contenido[], contexto: ContextoBarbie, tiempoLimite: number) {
  return fetch(`${URL_MODELOS}/${modelo}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI.apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: instrucciones(contexto) }] },
      contents: paraModelo(contenidos, modelo),
      tools: HERRAMIENTAS,
      // Poco razonamiento: en una conversación por voz importa más contestar rápido.
      generationConfig: { thinkingConfig: razonamientoMinimo(modelo) },
    }),
    signal: AbortSignal.timeout(tiempoLimite),
  });
}

async function generar(contenidos: Contenido[], contexto: ContextoBarbie): Promise<Contenido> {
  const ahora = Date.now();
  const disponibles = GEMINI.modelos.filter((modelo) => (pausadoHasta.get(modelo) ?? 0) <= ahora);
  // Si todos están en pausa, se intenta igual con el que se libera primero.
  const candidatos = disponibles.length
    ? disponibles
    : [...GEMINI.modelos].sort((a, b) => (pausadoHasta.get(a) ?? 0) - (pausadoHasta.get(b) ?? 0)).slice(0, 1);

  let ultimoError = 'No pude conectarme con Gemini; revisa el internet.';
  for (const [i, modelo] of candidatos.entries()) {
    const esUltimo = i === candidatos.length - 1;
    const tiempo = cronometro();
    let respuesta: Response | null = null;
    try {
      respuesta = await pedir(modelo, contenidos, contexto, esUltimo ? TIEMPO_LIMITE_MS : TIEMPO_POR_MODELO_MS);
    } catch {
      respuesta = null; // Sin conexión o tardó demasiado
    }

    if (respuesta?.ok) {
      bitacora.exito('gemini', `${modelo} respondió`, { duracionMs: tiempo() });
      const datos = await respuesta.json();
      const partes: Parte[] | undefined = datos.candidates?.[0]?.content?.parts;
      if (!partes?.length) {
        // Respuesta vacía o bloqueada por los filtros de seguridad de Gemini.
        return { role: 'model', parts: [{ text: 'Prefiero no contestar eso. ¿Te ayudo con otra cosa?' }] };
      }
      const contenido: Contenido = { role: 'model', parts: partes };
      autor.set(contenido, modelo);
      return contenido;
    }

    const cuerpo: ErrorGemini | null = respuesta ? await respuesta.json().catch(() => null) : null;
    const status = respuesta?.status ?? null;
    const detalle = `${modelo} → ${status === null ? 'sin respuesta a tiempo' : `HTTP ${status}`}${
      cuerpo?.error?.message ? `: ${cuerpo.error.message.slice(0, 160)}` : ''
    }`;
    ultimoError = status === null ? ultimoError : mensajeDeError(status, modelo, cuerpo);
    const pausa = pausaPorFallo(status, cuerpo);

    if (pausa === null) {
      // Clave inválida, petición mal formada…: cambiar de modelo no lo arregla.
      bitacora.error('gemini', ultimoError, { detalle, duracionMs: tiempo() });
      throw new Error(ultimoError);
    }
    if (pausa > 0) pausadoHasta.set(modelo, Date.now() + pausa);
    if (!esUltimo) {
      bitacora.aviso('gemini', `${modelo} no respondió; pruebo con ${candidatos[i + 1]}`, { detalle, duracionMs: tiempo() });
    } else {
      bitacora.error('gemini', ultimoError, { detalle, duracionMs: tiempo() });
    }
  }
  throw new Error(ultimoError);
}

/** Contenido guardado en palabras, para que Barbie diga exactamente qué quedó en la base. */
function describirContenido(contenido: Partial<RegistroClima>) {
  return Object.fromEntries(
    Object.entries(contenido).filter(([campo, valor]) => valor !== undefined && valor !== null && campo !== 'fecha_hora'),
  );
}

/** Resumen del clima de un lugar, para que Barbie lo cuente. */
const resumenClima = (clima: RegistroClima) => ({
  lugar: [clima.ciudad, clima.estado].filter(Boolean).join(', '),
  temperatura: clima.temperatura,
  condicion: clima.condicion,
  humedad: clima.humedad,
  viento: clima.viento,
});

/** Ejecuta una herramienta que pidió Gemini. Los errores se le devuelven a Gemini para que los explique. */
async function ejecutar(llamada: LlamadaHerramienta, acciones: AccionesBarbie, hechos: string[]) {
  const args = llamada.args ?? {};

  // Herramientas de ubicación: no van a ningún servidor.
  if (llamada.name === 'cambiar_ubicacion' || llamada.name === 'usar_mi_ubicacion') {
    try {
      const clima =
        llamada.name === 'cambiar_ubicacion'
          ? await acciones.cambiarUbicacion(String(args.lugar ?? ''))
          : await acciones.volverAMiUbicacion();
      return { ok: true, mostrando: llamada.name === 'cambiar_ubicacion' ? 'ubicación elegida' : 'tu ubicación real', ...resumenClima(clima) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'No se pudo cambiar la ubicación.' };
    }
  }

  const servidores = SERVIDORES_DE[String(args.servidor)];
  if (!servidores) {
    return { ok: false, error: 'Servidor desconocido; usa "uno", "dos" o "ambos".' };
  }

  if (llamada.name === 'guardar_clima') {
    const pedidos = Array.isArray(args.datos) ? args.datos.map(String) : ['todo'];
    const datos = pedidos.includes('todo') ? undefined : DATOS_CLIMA.filter((dato) => pedidos.includes(dato));
    const resultados = await Promise.all(
      servidores.map(async (servidor) => {
        const numero = NUMERO[servidor];
        try {
          const { id, fechaHora, contenido } = await acciones.guardar(servidor, datos);
          hechos.push(`Guardé en el servidor ${numero}.`);
          return {
            ok: true,
            servidor: numero,
            id,
            guardado: datos ?? 'todo',
            contenido: describirContenido(contenido),
            fechaHora: fechaLocal(fechaHora),
          };
        } catch (error) {
          const mensaje = error instanceof Error ? error.message : 'Error desconocido.';
          hechos.push(`No pude guardar en el servidor ${numero}: ${mensaje}`);
          return { ok: false, servidor: numero, error: mensaje };
        }
      }),
    );
    return resultados.length === 1 ? resultados[0] : { resultados };
  }

  if (llamada.name === 'respaldar_bitacora') {
    const resultados = await acciones.respaldarBitacora(servidores);
    return {
      resultados: resultados.map(({ servidor, guardados, error }) => ({
        servidor: NUMERO[servidor],
        ok: !error,
        eventosRespaldados: guardados,
        ...(error ? { error } : {}),
      })),
    };
  }

  const servidor = servidores[0];
  const numero = NUMERO[servidor];
  try {
    if (llamada.name === 'consultar_registros') {
      const limite = Math.min(Math.max(Math.round(Number(args.limite) || 10), 1), MAX_REGISTROS);
      const texto = (valor: unknown) => (typeof valor === 'string' && valor.trim() ? valor.trim() : undefined);
      const { total, registros } = await acciones.consultar(servidor, {
        limite,
        usuario: texto(args.usuario),
        lugar: texto(args.lugar),
        desde: texto(args.desde),
        hasta: texto(args.hasta),
      });
      return {
        ok: true,
        servidor: numero,
        total: total ?? 'desconocido',
        registros: registros.map(({ nombre, paterno, materno, fechaHora, ...registro }) => ({
          ...registro,
          nombreCompleto: [nombre, paterno, materno].filter(Boolean).join(' '),
          fechaHora: fechaLocal(fechaHora),
        })),
      };
    }

    if (llamada.name === 'consultar_bitacora') {
      const limite = Math.min(Math.max(Math.round(Number(args.limite) || 10), 1), 50);
      const { total, eventos } = await acciones.consultarBitacora(servidor, limite);
      return {
        ok: true,
        servidor: numero,
        total,
        eventos: eventos.map(({ id, fechaEvento, ...evento }) => ({ ...evento, fecha: fechaLocal(fechaEvento) })),
      };
    }

    return { ok: false, error: `No existe la herramienta ${llamada.name}.` };
  } catch (error) {
    return { ok: false, servidor: numero, error: error instanceof Error ? error.message : 'Error desconocido.' };
  }
}

let memoria: Contenido[][] = [];

/**
 * Le pasa a Gemini lo que se le dijo a Barbie y devuelve lo que ella contesta.
 * Solo lanza un error si Gemini no respondió antes de guardar nada; así quien llama
 * puede intentar el comando sin Gemini sin riesgo de guardar dos veces.
 */
export async function conversarConBarbie(
  texto: string,
  contexto: ContextoBarbie,
  acciones: AccionesBarbie,
): Promise<string> {
  if (!GEMINI.apiKey) {
    bitacora.error('gemini', 'Falta configurar EXPO_PUBLIC_GEMINI_API_KEY en el archivo .env.');
    throw new Error('Falta configurar EXPO_PUBLIC_GEMINI_API_KEY en el archivo .env.');
  }

  const turno: Contenido[] = [{ role: 'user', parts: [{ text: texto }] }];
  const hechos: string[] = []; // Guardados ya hechos, por si Gemini falla a la mitad

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    let respuesta: Contenido;
    try {
      respuesta = await generar([...memoria.flat(), ...turno], contexto);
    } catch (error) {
      if (hechos.length) return hechos.join(' ');
      throw error;
    }
    turno.push(respuesta);

    const llamadas = respuesta.parts.flatMap((parte) => (parte.functionCall ? [parte.functionCall] : []));
    if (!llamadas.length) {
      memoria = [...memoria, turno].slice(-TURNOS_EN_MEMORIA);
      const textoRespuesta = respuesta.parts
        .filter((parte) => parte.text && !parte.thought)
        .map((parte) => parte.text)
        .join('')
        .trim();
      return textoRespuesta || '¡Ups! Me quedé en blanco. ¿Me lo repites?';
    }

    for (const llamada of llamadas) {
      bitacora.info('gemini', `Gemini pidió ${llamada.name.replace('_', ' ')}`, {
        detalle: JSON.stringify(llamada.args ?? {}),
      });
    }
    // En orden y no en paralelo: en "guarda en el dos y dime qué hay en el dos", la consulta debe ver lo guardado.
    const resultados: Awaited<ReturnType<typeof ejecutar>>[] = [];
    for (const llamada of llamadas) {
      resultados.push(await ejecutar(llamada, acciones, hechos));
    }
    turno.push({
      role: 'user',
      parts: llamadas.map((llamada, i) => ({
        functionResponse: { id: llamada.id, name: llamada.name, response: resultados[i] },
      })),
    });
  }
  return hechos.length ? hechos.join(' ') : 'Me enredé un poquito. ¿Me lo dices de otra forma?';
}
