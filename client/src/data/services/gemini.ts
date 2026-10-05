// La inteligencia de Barbie: Gemini con la API REST generateContent
// (https://ai.google.dev/api/generate-content) y dos herramientas que ejecuta la app:
// guardar el clima y consultar lo que hay en cada servidor.

import { GEMINI, USUARIO, type ServidorId } from '../../config';
import { CONDICIONES, type RegistroClima } from './clima';
import type { Pronostico } from './pronostico';
import { DATOS_CLIMA, type DatoClima, type RegistroGuardado } from './servidores';

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

export type ContextoBarbie = { clima: RegistroClima | null; pronostico: Pronostico | null };

export type AccionesBarbie = {
  guardar: (servidor: ServidorId, datos?: DatoClima[]) => Promise<{ id: number; fechaHora: string }>;
  consultar: (servidor: ServidorId, limite: number) => Promise<{ total: number | null; registros: RegistroGuardado[] }>;
};

const SERVIDOR_POR_NUMERO: Record<string, ServidorId> = { uno: 'windows', dos: 'linux' };
const NUMERO: Record<ServidorId, string> = { windows: 'uno', linux: 'dos' };

const PARAMETRO_SERVIDOR = {
  type: 'string',
  enum: ['uno', 'dos'],
  description: 'Servidor uno (Windows Server con SQL Server) o servidor dos (Ubuntu Server con PostgreSQL).',
};

const HERRAMIENTAS = [
  {
    functionDeclarations: [
      {
        name: 'guardar_clima',
        description:
          'Guarda el clima actual en la base de datos de un servidor. Úsala solo cuando el usuario pida guardar. ' +
          'Para guardar en los dos servidores, llámala una vez por servidor.',
        parameters: {
          type: 'object',
          properties: {
            servidor: PARAMETRO_SERVIDOR,
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
          'Lee los registros más recientes de un servidor y cuántos tiene en total. ' +
          'Úsala siempre que pregunten qué hay guardado; nunca lo inventes.',
        parameters: {
          type: 'object',
          properties: {
            servidor: PARAMETRO_SERVIDOR,
            limite: {
              type: 'integer',
              description: `Cuántos registros recientes leer, de 1 a ${MAX_REGISTROS}. Usa 10 si no se especifica.`,
            },
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

function describirClima({ clima, pronostico }: ContextoBarbie): string {
  if (!clima) {
    return 'Todavía no tienes el clima actual: la app lo está obteniendo o no tiene permiso de ubicación.';
  }
  const lugar = [clima.municipio ?? clima.ciudad, clima.estado].filter(Boolean).join(', ');
  let texto =
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
  const nombre = [USUARIO.nombre, USUARIO.paterno].filter(Boolean).join(' ') || 'el usuario';
  return [
    'Eres Barbie, la asistente de voz de la app "Clima Distribuido", un proyecto escolar de la Universidad Politécnica de Pachuca. Eres alegre, amable y breve.',
    'Todo lo que respondes se lee en voz alta: contesta en español de México con una a tres frases cortas, sin markdown, listas, emojis ni símbolos, y escribe las unidades con palabras (grados, por ciento, kilómetros por hora).',
    'La app guarda el clima en dos servidores, cada uno con su propia base de datos: el servidor uno (Windows Server con SQL Server) y el servidor dos (Ubuntu Server con PostgreSQL). Cada registro tiene quién lo guardó, estado, municipio, latitud y longitud, temperatura, humedad, viento, y la fecha y hora, que se ponen solas.',
    'Guarda solo cuando te lo pidan. Si no dicen en qué servidor, pregunta cuál. Si piden guardar solo un dato, guarda solo ese.',
    'Para saber qué hay guardado usa consultar_registros, nunca lo inventes. Resume en lugar de leer registro por registro. Un dato en null significa que en ese registro no se guardó.',
    'También puedes platicar de cualquier tema y contestar preguntas generales.',
    'El texto viene del reconocimiento de voz y puede traer errores: interprétalo con sentido común. Te activan diciendo tu nombre.',
    `Fecha y hora actual: ${fechaLocal(new Date())}.`,
    `Te habla ${nombre}.`,
    describirClima(contexto),
  ].join('\n');
}

function mensajeDeError(status: number, cuerpo: { error?: { message?: string } } | null): string {
  const detalle = cuerpo?.error?.message ?? '';
  if (status === 400 && /api key/i.test(detalle)) return 'La API key de Gemini no es válida; revisa EXPO_PUBLIC_GEMINI_API_KEY.';
  if (status === 403) return 'Gemini rechazó la API key; revisa EXPO_PUBLIC_GEMINI_API_KEY.';
  if (status === 404) return `Gemini no tiene el modelo ${GEMINI.modelo}; revisa EXPO_PUBLIC_GEMINI_MODELO.`;
  if (status === 429) return 'Se acabó la cuota gratis de Gemini por ahora; intenta en un minuto.';
  if (status >= 500) return 'Gemini está saturado; intenta otra vez en un momento.';
  console.warn('Gemini respondió', status, detalle);
  return `Gemini respondió ${status}.`;
}

async function generar(contenidos: Contenido[], contexto: ContextoBarbie): Promise<Contenido> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${URL_MODELOS}/${GEMINI.modelo}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instrucciones(contexto) }] },
        contents: contenidos,
        tools: HERRAMIENTAS,
        // Poco razonamiento: en una conversación por voz importa más contestar rápido.
        generationConfig: { thinkingConfig: { thinkingLevel: 'low' } },
      }),
      signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
    });
  } catch {
    throw new Error('No pude conectarme con Gemini; revisa el internet.');
  }
  if (!respuesta.ok) {
    throw new Error(mensajeDeError(respuesta.status, await respuesta.json().catch(() => null)));
  }
  const datos = await respuesta.json();
  const partes: Parte[] | undefined = datos.candidates?.[0]?.content?.parts;
  if (!partes?.length) {
    // Respuesta vacía o bloqueada por los filtros de seguridad de Gemini.
    return { role: 'model', parts: [{ text: 'Prefiero no contestar eso. ¿Te ayudo con otra cosa?' }] };
  }
  return { role: 'model', parts: partes };
}

/** Ejecuta una herramienta que pidió Gemini. Los errores se le devuelven a Gemini para que los explique. */
async function ejecutar(llamada: LlamadaHerramienta, acciones: AccionesBarbie, hechos: string[]) {
  const args = llamada.args ?? {};
  const servidor = SERVIDOR_POR_NUMERO[String(args.servidor)];
  if (!servidor) {
    return { ok: false, error: 'Servidor desconocido; usa "uno" o "dos".' };
  }
  const numero = NUMERO[servidor];

  try {
    if (llamada.name === 'guardar_clima') {
      const pedidos = Array.isArray(args.datos) ? args.datos.map(String) : ['todo'];
      const datos = pedidos.includes('todo')
        ? undefined
        : DATOS_CLIMA.filter((dato) => pedidos.includes(dato));
      const { id, fechaHora } = await acciones.guardar(servidor, datos);
      hechos.push(`Guardé en el servidor ${numero}.`);
      return { ok: true, servidor: numero, id, guardado: datos ?? 'todo', fechaHora: fechaLocal(fechaHora) };
    }

    if (llamada.name === 'consultar_registros') {
      const limite = Math.min(Math.max(Math.round(Number(args.limite) || 10), 1), MAX_REGISTROS);
      const { total, registros } = await acciones.consultar(servidor, limite);
      return {
        ok: true,
        servidor: numero,
        total: total ?? 'desconocido',
        registros: registros.map(({ paterno, materno, fechaHora, ...registro }) => ({
          ...registro,
          fechaHora: fechaLocal(fechaHora),
        })),
      };
    }

    return { ok: false, error: `No existe la herramienta ${llamada.name}.` };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido.';
    if (llamada.name === 'guardar_clima') hechos.push(`No pude guardar en el servidor ${numero}: ${mensaje}`);
    return { ok: false, error: mensaje };
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

    const resultados = await Promise.all(llamadas.map((llamada) => ejecutar(llamada, acciones, hechos)));
    turno.push({
      role: 'user',
      parts: llamadas.map((llamada, i) => ({
        functionResponse: { id: llamada.id, name: llamada.name, response: resultados[i] },
      })),
    });
  }
  return hechos.length ? hechos.join(' ') : 'Me enredé un poquito. ¿Me lo dices de otra forma?';
}
