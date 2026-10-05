import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import type { ServidorId } from '../../config';
import { bitacora, iniciarOrden, terminarOrden } from '../../data/services/bitacora';
import { despuesDeLaPalabraClave, interpretarComando, ordenDeGuardar } from '../../data/services/comandos';
import { hablarComoBarbie, prepararVoz } from '../vozBarbie';

export type EstadoVoz =
  | 'apagado' // El usuario pausó el micrófono o no hay permiso
  | 'sinSoporte' // El dispositivo o navegador no tiene reconocimiento de voz (p. ej. Firefox)
  | 'esperando' // Escuchando en segundo plano, esperando "Barbie"
  | 'activo' // Ya se dijo "Barbie", esperando el resto (el servidor, o la pregunta con Gemini)
  | 'procesando'; // Guardando o pensando, y respondiendo por voz

// Tras decir "Barbie", cuánto tiempo se espera a que se diga el servidor.
const VENTANA_ACTIVACION_MS = 8000;
// Con Gemini, si el reconocedor no marca el final de la frase, se da por terminada tras este silencio.
const SILENCIO_MS = 1500;
const RETRASO_REINICIO_MS = 150;
const RETRASO_REINICIO_ERROR_MS = 1500;

// Errores en los que no tiene sentido seguir reintentando.
const ERRORES_FATALES = new Set(['not-allowed', 'service-not-allowed', 'language-not-supported']);

// Si el servicio falla tantas veces seguidas sin oír nada, se deja de reintentar.
const MAX_ERRORES_SEGUIDOS = 4;

const ES_WEB = Platform.OS === 'web';

function hayReconocimiento(): boolean {
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

type Opciones = {
  /** Guarda en el servidor indicado y devuelve el mensaje que se dirá en voz alta. */
  onGuardar: (servidor: ServidorId) => Promise<string>;
  /**
   * Con Gemini: responde lo que se le pidió a Barbie y devuelve lo que dirá en voz alta.
   * Sin esta opción, Barbie solo entiende "guardar en servidor uno/dos".
   */
  onPreguntar?: (texto: string) => Promise<string>;
};

export function useEscuchaContinua({ onGuardar, onPreguntar }: Opciones) {
  const [estado, setEstado] = useState<EstadoVoz>('apagado');
  const [transcripcion, setTranscripcion] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [hablando, setHablando] = useState(false); // Barbie está diciendo algo en voz alta

  const habilitado = useRef(false); // El usuario quiere que se escuche
  const pausado = useRef(false); // Pausa temporal mientras la app habla/guarda
  const ocupado = useRef(false); // Guardando o esperando a Gemini
  const corriendo = useRef(false); // Hay una sesión del reconocedor abierta
  const activado = useRef(false);
  const temporizadorActivacion = useRef<ReturnType<typeof setTimeout> | null>(null);
  const temporizadorSilencio = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retrasoReinicio = useRef(RETRASO_REINICIO_MS);
  const erroresSeguidos = useRef(0);
  const onGuardarRef = useRef(onGuardar);
  const onPreguntarRef = useRef(onPreguntar);

  useEffect(() => {
    onGuardarRef.current = onGuardar;
    onPreguntarRef.current = onPreguntar;
  }, [onGuardar, onPreguntar]);

  const iniciarReconocedor = useCallback(() => {
    if (!habilitado.current || pausado.current || corriendo.current) return;
    corriendo.current = true;
    ExpoSpeechRecognitionModule.start({
      lang: 'es-MX',
      interimResults: true,
      continuous: true,
      contextualStrings: ['Barbie', 'servidor uno', 'servidor dos', 'guardar', 'temperatura', 'humedad', 'registros'],
    });
  }, []);

  const desactivar = useCallback(() => {
    if (temporizadorActivacion.current) clearTimeout(temporizadorActivacion.current);
    if (temporizadorSilencio.current) clearTimeout(temporizadorSilencio.current);
    temporizadorActivacion.current = null;
    temporizadorSilencio.current = null;
    activado.current = false;
  }, []);

  const activar = useCallback(() => {
    desactivar();
    activado.current = true;
    setEstado('activo');
    temporizadorActivacion.current = setTimeout(() => {
      desactivar();
      setTranscripcion('');
      setEstado(habilitado.current ? 'esperando' : 'apagado');
      // Reinicia la sesión para que no se arrastre el "Barbie" anterior (iOS acumula el texto).
      ExpoSpeechRecognitionModule.abort();
    }, VENTANA_ACTIVACION_MS);
  }, [desactivar]);

  /**
   * Dice un texto con la voz de Barbie pausando el micrófono para que no se escuche a sí misma.
   * Con `reanudar: false` el micrófono sigue en pausa al terminar (para encadenar respuestas).
   */
  const decir = useCallback(
    (texto: string, { reanudar = true } = {}) =>
      new Promise<void>((resolve) => {
        setMensaje(texto);
        setHablando(true);
        pausado.current = true;
        ExpoSpeechRecognitionModule.abort();
        let terminado = false;
        const alTerminar = () => {
          if (terminado) return;
          terminado = true;
          clearTimeout(respaldo);
          setHablando(false);
          if (reanudar) {
            pausado.current = false;
            iniciarReconocedor();
          }
          resolve();
        };
        // Por si el navegador bloquea la voz y nunca avisa que terminó.
        const respaldo = setTimeout(alTerminar, 1500 + texto.length * 75);
        hablarComoBarbie(texto, alTerminar);
      }),
    [iniciarReconocedor],
  );

  const guardar = useCallback(
    /** `texto`: lo que se dijo; sin él, la orden vino del botón del servidor. */
    async (servidor: ServidorId, texto?: string) => {
      if (ocupado.current) return;
      ocupado.current = true;
      desactivar();
      setEstado('procesando');

      // Responde en cuanto entiende el comando, mientras guarda en paralelo,
      // para que no se sienta lenta aunque el servidor tarde.
      const numero = servidor === 'windows' ? 'uno' : 'dos';
      if (texto) {
        iniciarOrden(texto);
        bitacora.exito('voz', 'Comando reconocido', { detalle: texto });
      } else {
        iniciarOrden(`Botón: guardar en el servidor ${numero}`);
      }
      bitacora.info('barbie', `Guardar todo en el servidor ${numero}`);
      const aviso = decir(`¡Claro! Guardando en el servidor ${numero}.`, { reanudar: false });

      let respuesta: string;
      try {
        respuesta = await onGuardarRef.current(servidor);
      } catch (error) {
        respuesta = error instanceof Error ? error.message : 'No se pudo guardar la información.';
      }
      await aviso;

      setTranscripcion('');
      setEstado(habilitado.current ? 'esperando' : 'apagado');
      bitacora.info('barbie', `Barbie: «${respuesta}»`);
      terminarOrden();
      await decir(respuesta);
      ocupado.current = false;
    },
    [decir, desactivar],
  );

  const preguntar = useCallback(
    async (texto: string) => {
      const responder = onPreguntarRef.current;
      if (ocupado.current || !responder) return;
      ocupado.current = true;
      desactivar();
      setEstado('procesando');
      iniciarOrden(texto);
      bitacora.exito('voz', 'Frase reconocida', { detalle: texto });

      let respuesta: string;
      try {
        respuesta = await responder(texto);
      } catch (error) {
        // Sin Gemini (sin internet, sin cuota…) la orden directa de guardar sigue funcionando.
        const servidor = ordenDeGuardar(texto);
        if (servidor) {
          bitacora.aviso('barbie', 'Gemini falló; se usa el comando directo sin IA');
          ocupado.current = false;
          await guardar(servidor);
          return;
        }
        respuesta = error instanceof Error ? error.message : 'No pude pensar una respuesta.';
      }

      setTranscripcion('');
      setEstado(habilitado.current ? 'esperando' : 'apagado');
      bitacora.info('barbie', `Barbie: «${respuesta}»`);
      terminarOrden();
      await decir(respuesta);
      ocupado.current = false;
      // Si Barbie preguntó algo ("¿en qué servidor?"), se le contesta sin volver a decir su nombre.
      if (habilitado.current && /\?\s*$/.test(respuesta)) activar();
    },
    [activar, decir, desactivar, guardar],
  );

  useSpeechRecognitionEvent('start', () => {
    retrasoReinicio.current = RETRASO_REINICIO_MS;
  });

  useSpeechRecognitionEvent('end', () => {
    corriendo.current = false;
    // Android, iOS y el navegador cierran la sesión tras un silencio: se vuelve a abrir sola.
    if (habilitado.current && !pausado.current) {
      setTimeout(iniciarReconocedor, retrasoReinicio.current);
    }
  });

  useSpeechRecognitionEvent('result', (evento) => {
    if (pausado.current || ocupado.current) return;
    erroresSeguidos.current = 0;
    const texto = evento.results[0]?.transcript ?? '';
    if (!texto) return;

    if (onPreguntarRef.current) {
      const peticion = despuesDeLaPalabraClave(texto, activado.current);
      if (peticion === null) {
        // Conversación que no es para la app: no se muestra ni se procesa.
        if (evento.isFinal) setTranscripcion('');
        return;
      }
      setTranscripcion(texto);
      if (peticion && evento.isFinal) {
        preguntar(texto);
        return;
      }
      // Todavía se está hablando: la ventana se alarga y se espera el final de la frase.
      activar();
      if (peticion) temporizadorSilencio.current = setTimeout(() => preguntar(texto), SILENCIO_MS);
      return;
    }

    const resultado = interpretarComando(texto, activado.current);

    if (resultado.tipo === 'guardar') {
      setTranscripcion(texto);
      guardar(resultado.servidor, texto);
    } else if (resultado.tipo === 'activado') {
      setTranscripcion(texto);
      if (!activado.current) activar();
    } else if (evento.isFinal) {
      // Conversación que no es para la app: no se muestra ni se procesa.
      setTranscripcion('');
    }
  });

  useSpeechRecognitionEvent('error', (evento) => {
    if (evento.error === 'aborted' || evento.error === 'no-speech') return;
    retrasoReinicio.current = RETRASO_REINICIO_ERROR_MS;
    erroresSeguidos.current += 1;
    bitacora.error('voz', `Error del reconocimiento de voz: ${evento.error}`, {
      detalle: `${evento.message || 'sin detalle'} (intento ${erroresSeguidos.current} de ${MAX_ERRORES_SEGUIDOS})`,
    });
    if (ERRORES_FATALES.has(evento.error) || erroresSeguidos.current >= MAX_ERRORES_SEGUIDOS) {
      habilitado.current = false;
      desactivar();
      setEstado('apagado');
      setMensaje(
        evento.error === 'network' && ES_WEB
          ? 'El navegador no pudo conectarse al servicio de voz. Usa Google Chrome o Edge (Chromium y Brave no lo incluyen).'
          : `El reconocimiento de voz no está disponible (${evento.error}).`,
      );
    }
  });

  const encender = useCallback(async () => {
    if (!hayReconocimiento()) {
      bitacora.error('voz', 'Este dispositivo o navegador no tiene reconocimiento de voz');
      setEstado('sinSoporte');
      setMensaje(
        ES_WEB
          ? 'Este navegador no tiene reconocimiento de voz. Usa Chrome, Edge o Safari.'
          : 'Este dispositivo no tiene un servicio de reconocimiento de voz (instala o activa Google).',
      );
      return;
    }
    // En web el navegador pide el permiso del micrófono por sí solo al empezar a escuchar.
    if (!ES_WEB) {
      const permiso = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permiso.granted) {
        bitacora.error('voz', 'Permiso del micrófono denegado');
        setMensaje('Se necesita el permiso del micrófono para escuchar a Barbie.');
        return;
      }
    }
    habilitado.current = true;
    erroresSeguidos.current = 0;
    bitacora.info('voz', 'Micrófono encendido; esperando «Barbie»');
    setMensaje('');
    setEstado('esperando');
    iniciarReconocedor();
  }, [iniciarReconocedor]);

  const apagar = useCallback(() => {
    bitacora.info('voz', 'Micrófono apagado');
    habilitado.current = false;
    desactivar();
    setTranscripcion('');
    setEstado('apagado');
    ExpoSpeechRecognitionModule.abort();
  }, [desactivar]);

  // El profesor pidió que la app escuche todo el tiempo: en móvil se enciende al abrir.
  // En web/escritorio el navegador exige un primer toque del usuario antes de usar
  // el micrófono y la voz, así que ahí se enciende al tocar el círculo.
  useEffect(() => {
    prepararVoz();
    if (!ES_WEB) encender();
    else if (!hayReconocimiento()) encender(); // Solo para mostrar el aviso de "sin soporte"
    return () => {
      habilitado.current = false;
      desactivar();
      ExpoSpeechRecognitionModule.abort();
      Speech.stop();
    };
  }, [encender, desactivar]);

  return {
    estado,
    hablando,
    transcripcion,
    mensaje,
    alternar: estado === 'sinSoporte' ? () => {} : estado === 'apagado' ? encender : apagar,
    guardar,
    decir,
  };
}
