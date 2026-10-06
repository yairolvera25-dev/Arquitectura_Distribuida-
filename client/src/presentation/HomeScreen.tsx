import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { GEMINI, type ServidorId } from '../config';
import { cerrarSesion } from '../data/services/autenticacion';
import { bitacora, cronometro } from '../data/services/bitacora';
import { buscarLugar, obtenerClima, obtenerClimaDe, type LugarElegido, type RegistroClima } from '../data/services/clima';
import { conversarConBarbie } from '../data/services/gemini';
import { obtenerPronostico, type Pronostico } from '../data/services/pronostico';
import { consultarBitacora, respaldarBitacora } from '../data/services/respaldo';
import { consultarRegistros, guardarClima, type DatoClima } from '../data/services/servidores';
import { ChipEstado, DETALLE_SERVIDOR, ListaServidores, PanelAsistente, type EstadoServidor } from './components/Asistente';
import { BarraLateral, Logo } from './components/BarraLateral';
import { Destacados, PronosticoSemana, TarjetaActual } from './components/Clima';
import { Aparecer } from './components/animaciones';
import { cieloDe, esDeNoche, FondoAnimado, PrimerPlanoClima } from './components/FondoAnimado';
import { PanelRegistro } from './components/Registro';
import { useEscuchaContinua } from './hooks/useEscuchaContinua';
import { useSesion } from './hooks/useSesion';
import { colores, espacio, radio, vidrio } from './theme';

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
  // Ciudad elegida ("Barbie, ¿cuál es el clima en Londres?"); null = ubicación real del GPS.
  const [lugarElegido, setLugarElegido] = useState<LugarElegido | null>(null);
  const lugarRef = useRef<LugarElegido | null>(null);
  // Último clima cargado: Barbie puede cambiar de ciudad y guardar en la misma frase, así que
  // guardar lee el clima de aquí y no del estado de React (que se actualiza hasta el siguiente render).
  const climaRef = useRef<RegistroClima | null>(null);

  /** Carga el clima del lugar elegido (o del GPS) y devuelve el clima nuevo. */
  const cargarClima = useCallback(async (): Promise<RegistroClima | null> => {
    setCargando(true);
    const tiempo = cronometro();
    const lugar = lugarRef.current;
    try {
      const nuevo = lugar ? await obtenerClimaDe(lugar) : await obtenerClima();
      climaRef.current = nuevo;
      setClima(nuevo);
      setErrorClima('');
      bitacora.exito('clima', `Clima obtenido: ${nuevo.ciudad}, ${nuevo.temperatura} °C${lugar ? ' (ubicación elegida)' : ''}`, {
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
      return nuevo;
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No se pudo obtener el clima.';
      bitacora.error('clima', mensaje, { duracionMs: tiempo() });
      setErrorClima(mensaje);
      throw error;
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarClima().catch(() => {});
  }, [cargarClima]);

  /** Cambia el dashboard a otra ciudad del mundo. Devuelve su clima. */
  const cambiarUbicacion = useCallback(
    async (nombre: string) => {
      const lugar = await buscarLugar(nombre);
      bitacora.info('clima', `Ubicación cambiada a ${lugar.ciudad}`, {
        detalle: `${lugar.latitud.toFixed(4)}, ${lugar.longitud.toFixed(4)}`,
      });
      lugarRef.current = lugar;
      setLugarElegido(lugar);
      setPronostico(null);
      return (await cargarClima())!;
    },
    [cargarClima],
  );

  /** Vuelve a la ubicación real (GPS). */
  const volverAMiUbicacion = useCallback(async () => {
    lugarRef.current = null;
    setLugarElegido(null);
    setPronostico(null);
    bitacora.info('clima', 'De vuelta a la ubicación real (GPS)');
    return (await cargarClima())!;
  }, [cargarClima]);

  // Para los botones: el error ya queda en pantalla y en la bitácora.
  const actualizar = useCallback(() => {
    cargarClima().catch(() => {});
  }, [cargarClima]);

  const guardarEn = useCallback(
    async (servidor: ServidorId, datos?: DatoClima[]) => {
      const clima = climaRef.current;
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
    [],
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
      conversarConBarbie(
        texto,
        { clima, pronostico, ubicacionElegida: Boolean(lugarElegido) },
        {
          guardar: guardarEn,
          consultar: consultarRegistros,
          respaldarBitacora,
          consultarBitacora,
          cambiarUbicacion,
          volverAMiUbicacion,
        },
      ),
    [clima, pronostico, lugarElegido, guardarEn, cambiarUbicacion, volverAMiUbicacion],
  );

  const voz = useEscuchaContinua({ onGuardar, onPreguntar: GEMINI.apiKey ? onPreguntar : undefined });

  const asistente = (
    <PanelAsistente
      estado={voz.estado}
      hablando={voz.hablando}
      transcripcion={voz.transcripcion}
      mensaje={voz.mensaje || errorClima}
      onAlternar={voz.alternar}
    />
  );
  const listaServidores = (
    <ListaServidores
      estados={servidores}
      deshabilitado={!clima || voz.estado === 'procesando' || voz.hablando}
      onGuardar={voz.guardar}
    />
  );
  const actual = (
    <TarjetaActual
      clima={clima}
      pronostico={pronostico}
      cargando={cargando}
      onActualizar={actualizar}
      lugarElegido={lugarElegido}
      onBuscar={cambiarUbicacion}
      onVolver={volverAMiUbicacion}
      style={styles.llenar}
    />
  );
  const cielo = cieloDe(pronostico?.codigoActual);
  const fondo = <FondoAnimado cielo={cielo} noche={esDeNoche(pronostico)} />;
  const primerPlano = <PrimerPlanoClima cielo={cielo} />;

  if (escritorio) {
    return (
      <View style={styles.fondo}>
        <StatusBar style="light" />
        {fondo}
        <View style={styles.marco}>
          <BarraLateral
            estadoVoz={voz.estado}
            servidores={servidores}
            cargando={cargando}
            onAlternarVoz={voz.alternar}
            onActualizar={actualizar}
            iniciales={iniciales}
            onCerrarSesion={cerrarSesion}
          />
          <ScrollView style={styles.flex} contentContainerStyle={styles.principal}>
            <View style={styles.fila}>
              <Aparecer style={styles.columnaIzquierda}>{actual}</Aparecer>
              <Aparecer retraso={120} style={styles.flex}>
                <Destacados clima={clima} pronostico={pronostico} style={styles.llenar} />
              </Aparecer>
            </View>
            <View style={styles.fila}>
              <Aparecer retraso={240} style={styles.columnaIzquierda}>
                <PronosticoSemana pronostico={pronostico} style={styles.llenar} />
              </Aparecer>
              <View style={[styles.flex, styles.columna]}>
                <Aparecer retraso={320}>{asistente}</Aparecer>
                <Aparecer retraso={420}>{listaServidores}</Aparecer>
                <Aparecer retraso={520}>
                  <PanelRegistro />
                </Aparecer>
              </View>
            </View>
          </ScrollView>
        </View>
        {primerPlano}
      </View>
    );
  }

  return (
    <View style={styles.fondoMovil}>
      <StatusBar style="light" />
      {fondo}
      <ScrollView style={styles.flex} contentContainerStyle={styles.movil}>
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
      <Aparecer>{actual}</Aparecer>
      <Aparecer retraso={100}>{asistente}</Aparecer>
      <Aparecer retraso={200}>{listaServidores}</Aparecer>
      <Aparecer retraso={300}>
        <Destacados clima={clima} pronostico={pronostico} />
      </Aparecer>
      <Aparecer retraso={400}>
        <PanelRegistro />
      </Aparecer>
      <Aparecer retraso={500}>
        <PronosticoSemana pronostico={pronostico} />
      </Aparecer>
      </ScrollView>
      {primerPlano}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  llenar: {
    flexGrow: 1,
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
    ...vidrio,
    backgroundColor: colores.marco,
    borderRadius: radio.xl,
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
