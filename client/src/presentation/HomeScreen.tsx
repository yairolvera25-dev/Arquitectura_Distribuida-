import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { GEMINI, type ServidorId } from '../config';
import { cerrarSesion } from '../data/services/autenticacion';
import { bitacora, cronometro } from '../data/services/bitacora';
import { obtenerClima, type RegistroClima } from '../data/services/clima';
import { conversarConBarbie } from '../data/services/gemini';
import { obtenerPronostico, type Pronostico } from '../data/services/pronostico';
import { consultarBitacora, respaldarBitacora } from '../data/services/respaldo';
import { consultarRegistros, guardarClima, type DatoClima } from '../data/services/servidores';
import { ChipEstado, DETALLE_SERVIDOR, ListaServidores, PanelAsistente, type EstadoServidor } from './components/Asistente';
import { BarraLateral, Logo } from './components/BarraLateral';
import { Destacados, PronosticoSemana, TarjetaActual } from './components/Clima';
import { PanelRegistro } from './components/Registro';
import { useEscuchaContinua } from './hooks/useEscuchaContinua';
import { useSesion } from './hooks/useSesion';
import { colores, espacio, radio } from './theme';

const ANCHO_ESCRITORIO = 1024;
const ANCHO_COLUMNA_IZQUIERDA = 320;

const hora = () => new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const escritorio = width >= ANCHO_ESCRITORIO;
  const usuario = useSesion()?.usuario;
  const iniciales = usuario
    ? [usuario.nombre, usuario.paterno].filter(Boolean).map((parte) => parte!.charAt(0).toUpperCase()).join('')
    : '';

  const [clima, setClima] = useState<RegistroClima | null>(null);
  const [pronostico, setPronostico] = useState<Pronostico | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorClima, setErrorClima] = useState('');
  const [servidores, setServidores] = useState<Partial<Record<ServidorId, EstadoServidor>>>({});

  const cargarClima = useCallback(async () => {
    setCargando(true);
    const tiempo = cronometro();
    try {
      const nuevo = await obtenerClima();
      setClima(nuevo);
      setErrorClima('');
      bitacora.exito('clima', `Clima obtenido: ${nuevo.ciudad}, ${nuevo.temperatura} °C`, {
        detalle: `${nuevo.latitud.toFixed(4)}, ${nuevo.longitud.toFixed(4)} · humedad ${nuevo.humedad} % · viento ${nuevo.viento} km/h`,
        duracionMs: tiempo(),
      });
      // El pronóstico es solo visual: si falla, el dashboard sigue funcionando.
      obtenerPronostico(nuevo.latitud, nuevo.longitud).then(setPronostico, (error) => {
        setPronostico(null);
        bitacora.aviso('clima', 'No se pudo cargar el pronóstico', {
          detalle: error instanceof Error ? error.message : String(error),
        });
      });
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No se pudo obtener el clima.';
      bitacora.error('clima', mensaje, { duracionMs: tiempo() });
      setErrorClima(mensaje);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarClima();
  }, [cargarClima]);

  const guardarEn = useCallback(
    async (servidor: ServidorId, datos?: DatoClima[]) => {
      if (!clima) {
        bitacora.error('clima', 'No hay datos del clima para guardar', { detalle: 'La ubicación o el clima no han cargado' });
        throw new Error('Todavía no tengo el clima para guardar, espera tantito.');
      }
      try {
        const guardado = await guardarClima(servidor, clima, datos);
        setServidores((previo) => ({ ...previo, [servidor]: { ok: true, detalle: `Guardado ${hora()}` } }));
        return guardado;
      } catch (error) {
        setServidores((previo) => ({ ...previo, [servidor]: { ok: false, detalle: 'Error' } }));
        throw error;
      }
    },
    [clima],
  );

  const onGuardar = useCallback(
    async (servidor: ServidorId) => {
      await guardarEn(servidor);
      return `¡Listo! Guardé el clima en el ${DETALLE_SERVIDOR[servidor].titulo.toLowerCase()}.`;
    },
    [guardarEn],
  );

  const onPreguntar = useCallback(
    (texto: string) =>
      conversarConBarbie(texto, { clima, pronostico }, { guardar: guardarEn, consultar: consultarRegistros, respaldarBitacora, consultarBitacora }),
    [clima, pronostico, guardarEn],
  );

  const voz = useEscuchaContinua({ onGuardar, onPreguntar: GEMINI.apiKey ? onPreguntar : undefined });

  const asistente = (
    <PanelAsistente
      estado={voz.estado}
      transcripcion={voz.transcripcion}
      mensaje={voz.mensaje || errorClima}
      onAlternar={voz.alternar}
    />
  );
  const listaServidores = (
    <ListaServidores
      estados={servidores}
      deshabilitado={!clima || voz.estado === 'procesando'}
      onGuardar={voz.guardar}
    />
  );
  const actual = (
    <TarjetaActual
      clima={clima}
      pronostico={pronostico}
      cargando={cargando}
      onActualizar={cargarClima}
      style={escritorio && styles.columnaIzquierda}
    />
  );

  if (escritorio) {
    return (
      <View style={styles.fondo}>
        <StatusBar style="light" />
        <View style={styles.marco}>
          <BarraLateral
            estadoVoz={voz.estado}
            servidores={servidores}
            cargando={cargando}
            onAlternarVoz={voz.alternar}
            onActualizar={cargarClima}
            iniciales={iniciales}
            onCerrarSesion={cerrarSesion}
          />
          <ScrollView style={styles.flex} contentContainerStyle={styles.principal}>
            <View style={styles.fila}>
              {actual}
              <Destacados clima={clima} pronostico={pronostico} style={styles.flex} />
            </View>
            <View style={styles.fila}>
              <PronosticoSemana pronostico={pronostico} style={styles.columnaIzquierda} />
              <View style={[styles.flex, styles.columna]}>
                {asistente}
                {listaServidores}
                <PanelRegistro />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.fondoMovil} contentContainerStyle={styles.movil}>
      <StatusBar style="light" />
      <View style={styles.encabezadoMovil}>
        <Logo horizontal />
        <View style={styles.encabezadoDerecha}>
          <ChipEstado estado={voz.estado} />
          <Pressable onPress={cerrarSesion} style={styles.sesionMovil} accessibilityLabel="Cerrar sesión">
            <Text style={styles.sesionMovilTexto}>{iniciales}</Text>
            <Ionicons name="log-out-outline" size={16} color={colores.textoSecundario} />
          </Pressable>
        </View>
      </View>
      {actual}
      {asistente}
      {listaServidores}
      <PanelRegistro />
      <Destacados clima={clima} pronostico={pronostico} />
      <PronosticoSemana pronostico={pronostico} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  fondo: {
    flex: 1,
    backgroundColor: colores.fondo,
    padding: espacio.lg,
  },
  marco: {
    flex: 1,
    flexDirection: 'row',
    gap: espacio.md,
    backgroundColor: colores.marco,
    borderRadius: radio.xl,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: espacio.md,
  },
  principal: {
    gap: espacio.md,
  },
  fila: {
    flexDirection: 'row',
    gap: espacio.md,
    alignItems: 'stretch',
  },
  columna: {
    gap: espacio.md,
  },
  columnaIzquierda: {
    width: ANCHO_COLUMNA_IZQUIERDA,
  },
  fondoMovil: {
    flex: 1,
    backgroundColor: colores.fondo,
  },
  movil: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    gap: espacio.md,
    paddingHorizontal: espacio.md,
    paddingTop: Platform.select({ ios: 64, android: 48, default: espacio.lg }),
    paddingBottom: espacio.xl,
  },
  encabezadoDerecha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
  },
  sesionMovil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colores.tarjetaAlta,
  },
  sesionMovilTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: colores.texto,
  },
  encabezadoMovil: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espacio.xs,
  },
});
