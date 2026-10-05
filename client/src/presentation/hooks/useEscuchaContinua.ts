import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import type { ServidorId } from '../../config';
import { interpretarComando } from '../../data/services/comandos';
import { hablarComoBarbie, prepararVoz } from '../vozBarbie';

export type EstadoVoz =
  | 'apagado' // El usuario pausó el micrófono o no hay permiso
  | 'sinSoporte' // El dispositivo o navegador no tiene reconocimiento de voz (p. ej. Firefox)
  | 'esperando' // Escuchando en segundo plano, esperando "Barbie"
  | 'activo' // Ya se dijo "Barbie", esperando "servidor uno/dos"
  | 'procesando'; // Guardando y respondiendo por voz

// Tras decir "Barbie", cuánto tiempo se espera a que se diga el servidor.
const VENTANA_ACTIVACION_MS = 8000;
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
};

export function useEscuchaContinua({ onGuardar }: Opciones) {
  const [estado, setEstado] = useState<EstadoVoz>('apagado');
  const [transcripcion, setTranscripcion] = useState('');
  const [mensaje, setMensaje] = useState('');

  const habilitado = useRef(false); // El usuario quiere que se escuche
  const pausado = useRef(false); // Pausa temporal mientras la app habla/guarda
  const guardando = useRef(false);
  const corriendo = useRef(false); // Hay una sesión del reconocedor abierta
  const activado = useRef(false);
  const temporizadorActivacion = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retrasoReinicio = useRef(RETRASO_REINICIO_MS);
  const erroresSeguidos = useRef(0);
  const onGuardarRef = useRef(onGuardar);

  useEffect(() => {
    onGuardarRef.current = onGuardar;
  }, [onGuardar]);

  const iniciarReconocedor = useCallback(() => {
    if (!habilitado.current || pausado.current || corriendo.current) return;
    corriendo.current = true;
    ExpoSpeechRecognitionModule.start({
      lang: 'es-MX',
      interimResults: true,
      continuous: true,
      contextualStrings: ['Barbie', 'servidor uno', 'servidor dos', 'guardar'],
    });
  }, []);

  const desactivar = useCallback(() => {
    if (temporizadorActivacion.current) clearTimeout(temporizadorActivacion.current);
    temporizadorActivacion.current = null;
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
        pausado.current = true;
        ExpoSpeechRecognitionModule.abort();
        let terminado = false;
        const alTerminar = () => {
          if (terminado) return;
          terminado = true;
          clearTimeout(respaldo);
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
    async (servidor: ServidorId) => {
      if (guardando.current) return;
      guardando.current = true;
      desactivar();
      setEstado('procesando');

      // Responde en cuanto entiende el comando, mientras guarda en paralelo,
      // para que no se sienta lenta aunque el servidor tarde.
      const numero = servidor === 'windows' ? 'uno' : 'dos';
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
      await decir(respuesta);
      guardando.current = false;
    },
    [decir, desactivar],
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
    if (pausado.current || guardando.current) return;
    erroresSeguidos.current = 0;
    const texto = evento.results[0]?.transcript ?? '';
    if (!texto) return;

    const resultado = interpretarComando(texto, activado.current);

    if (resultado.tipo === 'guardar') {
      setTranscripcion(texto);
      guardar(resultado.servidor);
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
        setMensaje('Se necesita el permiso del micrófono para escuchar a Barbie.');
        return;
      }
    }
    habilitado.current = true;
    erroresSeguidos.current = 0;
    setMensaje('');
    setEstado('esperando');
    iniciarReconocedor();
  }, [iniciarReconocedor]);

  const apagar = useCallback(() => {
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
    transcripcion,
    mensaje,
    alternar: estado === 'sinSoporte' ? () => {} : estado === 'apagado' ? encender : apagar,
    guardar,
    decir,
  };
}
