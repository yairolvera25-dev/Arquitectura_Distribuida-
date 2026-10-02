import { StatusBar } from 'expo-status-bar';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { SERVIDORES } from './src/config';
import { obtenerClima, type RegistroClima } from './src/services/clima';
import { interpretarComando } from './src/services/comandos';
import { guardarClima } from './src/services/servidores';

export default function App() {
  const [clima, setClima] = useState<RegistroClima | null>(null);
  const [cargando, setCargando] = useState(true);
  const [escuchando, setEscuchando] = useState(false);
  const [comando, setComando] = useState('');
  const [mensaje, setMensaje] = useState('');

  const avisar = useCallback((texto: string) => {
    setMensaje(texto);
    Speech.speak(texto, { language: 'es-MX' });
  }, []);

  const cargarClima = useCallback(async () => {
    setCargando(true);
    try {
      setClima(await obtenerClima());
      setMensaje('');
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : 'No se pudo obtener el clima.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarClima();
  }, [cargarClima]);

  const ejecutarComando = async (texto: string) => {
    setComando(texto);
    const servidorId = interpretarComando(texto);
    if (!servidorId) {
      avisar('No entendí el comando. Di "guardar en servidor uno" o "guardar en servidor dos".');
      return;
    }
    if (!clima) {
      avisar('Todavía no hay información del clima para guardar.');
      return;
    }
    try {
      await guardarClima(servidorId, clima);
      avisar(`Información guardada en ${SERVIDORES[servidorId].nombre}.`);
    } catch (error) {
      avisar(error instanceof Error ? error.message : 'No se pudo guardar la información.');
    }
  };

  useSpeechRecognitionEvent('start', () => setEscuchando(true));
  useSpeechRecognitionEvent('end', () => setEscuchando(false));
  useSpeechRecognitionEvent('result', (evento) => {
    if (evento.isFinal) {
      ejecutarComando(evento.results[0]?.transcript ?? '');
    }
  });
  useSpeechRecognitionEvent('error', (evento) => {
    if (evento.error !== 'aborted') {
      setMensaje(`No se pudo reconocer la voz (${evento.error}).`);
    }
  });

  const escuchar = async () => {
    if (escuchando) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const permiso = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permiso.granted) {
      setMensaje('Se necesita el permiso del micrófono.');
      return;
    }
    Speech.stop();
    setComando('');
    setMensaje('');
    ExpoSpeechRecognitionModule.start({ lang: 'es-MX', interimResults: false, continuous: false });
  };

  return (
    <View style={styles.contenedor}>
      <StatusBar style="auto" />
      <Text style={styles.titulo}>Clima distribuido</Text>

      <View style={styles.tarjeta}>
        {cargando ? (
          <ActivityIndicator size="large" />
        ) : clima ? (
          <>
            <Text style={styles.ciudad}>{clima.ciudad}</Text>
            <Text style={styles.temperatura}>{clima.temperatura} °C</Text>
            <Text style={styles.dato}>{clima.condicion}</Text>
            <Text style={styles.dato}>Humedad: {clima.humedad} %</Text>
            <Text style={styles.dato}>{new Date(clima.fecha_hora).toLocaleString('es-MX')}</Text>
            <Text style={styles.coordenadas}>
              {clima.latitud.toFixed(4)}, {clima.longitud.toFixed(4)}
            </Text>
          </>
        ) : (
          <Text style={styles.dato}>Sin información del clima.</Text>
        )}
      </View>

      <Pressable style={styles.botonSecundario} onPress={cargarClima} disabled={cargando}>
        <Text style={styles.textoSecundario}>Actualizar clima</Text>
      </Pressable>

      <Pressable style={[styles.boton, escuchando && styles.botonActivo]} onPress={escuchar}>
        <Text style={styles.textoBoton}>{escuchando ? 'Escuchando…' : 'Dar comando de voz'}</Text>
      </Pressable>

      {comando ? <Text style={styles.comando}>“{comando}”</Text> : null}
      {mensaje ? <Text style={styles.mensaje}>{mensaje}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: '#f4f1f8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  titulo: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4a1d6e',
  },
  tarjeta: {
    width: '100%',
    minHeight: 220,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ciudad: {
    fontSize: 22,
    fontWeight: '600',
  },
  temperatura: {
    fontSize: 48,
    fontWeight: '700',
    color: '#4a1d6e',
  },
  dato: {
    fontSize: 16,
    color: '#333',
  },
  coordenadas: {
    fontSize: 12,
    color: '#777',
  },
  boton: {
    width: '100%',
    backgroundColor: '#4a1d6e',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  botonActivo: {
    backgroundColor: '#b3261e',
  },
  textoBoton: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  botonSecundario: {
    paddingVertical: 8,
  },
  textoSecundario: {
    color: '#4a1d6e',
    fontSize: 16,
  },
  comando: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#555',
  },
  mensaje: {
    fontSize: 16,
    textAlign: 'center',
    color: '#222',
  },
});
