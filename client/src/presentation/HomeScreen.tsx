import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import type { ServidorId } from '../config';
import { obtenerClima, type RegistroClima } from '../data/services/clima';
import { obtenerPronostico, type Pronostico } from '../data/services/pronostico';
import { guardarClima } from '../data/services/servidores';
import { ChipEstado, DETALLE_SERVIDOR, ListaServidores, PanelAsistente, type EstadoServidor } from './components/Asistente';
import { BarraLateral, Logo } from './components/BarraLateral';
import { Destacados, PronosticoSemana, TarjetaActual } from './components/Clima';
import { useEscuchaContinua } from './hooks/useEscuchaContinua';
import { colores, espacio, radio } from './theme';

const ANCHO_ESCRITORIO = 1024;
const ANCHO_COLUMNA_IZQUIERDA = 320;

const hora = () => new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const escritorio = width >= ANCHO_ESCRITORIO;

  const [clima, setClima] = useState<RegistroClima | null>(null);
  const [pronostico, setPronostico] = useState<Pronostico | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorClima, setErrorClima] = useState('');
  const [servidores, setServidores] = useState<Partial<Record<ServidorId, EstadoServidor>>>({});

  const cargarClima = useCallback(async () => {
    setCargando(true);
    try {
      const nuevo = await obtenerClima();
      setClima(nuevo);
      setErrorClima('');
      // El pronóstico es solo visual: si falla, el dashboard sigue funcionando.
      obtenerPronostico(nuevo.latitud, nuevo.longitud).then(setPronostico, () => setPronostico(null));
    } catch (error) {
      setErrorClima(error instanceof Error ? error.message : 'No se pudo obtener el clima.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarClima();
  }, [cargarClima]);

  const onGuardar = useCallback(
    async (servidor: ServidorId) => {
      if (!clima) return 'Todavía no tengo el clima para guardar, espera tantito.';
      const { titulo } = DETALLE_SERVIDOR[servidor];
      try {
        await guardarClima(servidor, clima);
        setServidores((previo) => ({ ...previo, [servidor]: { ok: true, detalle: `Guardado ${hora()}` } }));
        return `¡Listo! Guardé el clima en el ${titulo.toLowerCase()}.`;
      } catch (error) {
        setServidores((previo) => ({ ...previo, [servidor]: { ok: false, detalle: 'Error' } }));
        throw error;
      }
    },
    [clima],
  );

  const voz = useEscuchaContinua({ onGuardar });

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
        <ChipEstado estado={voz.estado} />
      </View>
      {actual}
      {asistente}
      {listaServidores}
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
  encabezadoMovil: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espacio.xs,
  },
});
