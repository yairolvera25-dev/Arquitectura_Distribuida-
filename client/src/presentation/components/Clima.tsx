import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import type { LugarElegido, RegistroClima } from '../../data/services/clima';
import { iconoClima, type Pronostico } from '../../data/services/pronostico';
import { colores, espacio, radio } from '../theme';
import { Aparecer, Flotar, useBucle, useContador, useProgreso } from './animaciones';
import { estilosTarjeta, Tarjeta } from './Tarjeta';

const horaDeIso = (iso: string) => iso.slice(11, 16); // "2026-10-04T06:26" → "06:26"

const fechaLarga = (fecha: string | Date) =>
  new Date(fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/* ───────────── Clima actual ───────────── */

type ActualProps = {
  clima: RegistroClima | null;
  pronostico: Pronostico | null;
  cargando: boolean;
  onActualizar: () => void;
  /** Ciudad elegida (null = ubicación real del GPS). */
  lugarElegido: LugarElegido | null;
  onBuscar: (nombre: string) => Promise<unknown>;
  onVolver: () => Promise<unknown>;
  style?: StyleProp<ViewStyle>;
};

export function TarjetaActual({
  clima,
  pronostico,
  cargando,
  onActualizar,
  lugarElegido,
  onBuscar,
  onVolver,
  style,
}: ActualProps) {
  const [buscando, setBuscando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [errorBusqueda, setErrorBusqueda] = useState('');

  const buscar = async () => {
    if (!busqueda.trim()) return;
    setErrorBusqueda('');
    try {
      await onBuscar(busqueda);
      setBuscando(false);
      setBusqueda('');
    } catch (error) {
      setErrorBusqueda(error instanceof Error ? error.message : 'No se pudo buscar ese lugar.');
    }
  };

  return (
    <Tarjeta style={[styles.actual, style]}>
      <View style={styles.actualArriba}>
        <Flotar altura={8}>
          <Text style={styles.iconoGrande}>{iconoClima(pronostico?.codigoActual)}</Text>
        </Flotar>
        <View style={styles.botones}>
          <Pressable
            onPress={() => {
              setBuscando((valor) => !valor);
              setErrorBusqueda('');
            }}
            style={[styles.botonRedondo, buscando && styles.botonActivo]}
            accessibilityLabel="Buscar el clima de otra ciudad"
          >
            <Ionicons name={buscando ? 'close' : 'search'} size={18} color={colores.texto} />
          </Pressable>
          <Pressable onPress={onActualizar} disabled={cargando} style={styles.botonRedondo} accessibilityLabel="Actualizar clima">
            {cargando ? <ActivityIndicator size="small" color={colores.texto} /> : <Ionicons name="refresh" size={18} color={colores.texto} />}
          </Pressable>
        </View>
      </View>

      {buscando ? (
        <View style={styles.buscador}>
          <View style={styles.buscadorCampo}>
            <Ionicons name="earth-outline" size={16} color={colores.textoSecundario} />
            <TextInput
              style={styles.buscadorEntrada}
              placeholder="Londres, Tokio, Nueva York…"
              placeholderTextColor={colores.textoTenue}
              value={busqueda}
              onChangeText={(texto) => {
                setBusqueda(texto);
                setErrorBusqueda('');
              }}
              onSubmitEditing={buscar}
              returnKeyType="search"
              autoFocus
              autoCorrect={false}
            />
            <Pressable onPress={buscar} disabled={cargando} hitSlop={8} accessibilityLabel="Buscar">
              <Ionicons name="arrow-forward-circle" size={22} color={colores.primario} />
            </Pressable>
          </View>
          {errorBusqueda ? <Text style={styles.errorBusqueda}>{errorBusqueda}</Text> : null}
        </View>
      ) : null}

      {clima ? (
        <>
          <Temperatura valor={clima.temperatura} />
          <View style={styles.renglon}>
            <Ionicons name="cloud-outline" size={16} color={colores.textoSecundario} />
            <Text style={styles.condicion}>{clima.condicion}</Text>
          </View>
          <View style={styles.divisor} />
          <View style={styles.renglon}>
            <Ionicons name={lugarElegido ? 'earth' : 'location-outline'} size={15} color={lugarElegido ? colores.primario : colores.textoSecundario} />
            <Text style={[styles.detalle, styles.flex]}>{[clima.ciudad, lugarElegido ? null : clima.estado].filter(Boolean).join(', ')}</Text>
          </View>
          {lugarElegido ? (
            <View style={styles.elegida}>
              <Text style={styles.elegidaTexto}>Ubicación elegida</Text>
              <Pressable onPress={() => onVolver().catch(() => {})} disabled={cargando} style={styles.volver}>
                <Ionicons name="navigate" size={13} color={colores.primario} />
                <Text style={styles.volverTexto}>Mi ubicación</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.renglon}>
            <Ionicons name="calendar-outline" size={15} color={colores.textoSecundario} />
            <Text style={styles.detalle}>
              {fechaLarga(clima.fecha_hora)}{' '}
              <Text style={styles.detalleFuerte}>{new Date(clima.fecha_hora).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</Text>
            </Text>
          </View>
        </>
      ) : (
        <Text style={styles.detalle}>{cargando ? 'Obteniendo ubicación…' : 'Sin información del clima'}</Text>
      )}
    </Tarjeta>
  );
}

/* ───────────── Resumen de hoy ───────────── */

type DestacadosProps = {
  clima: RegistroClima | null;
  pronostico: Pronostico | null;
  style?: StyleProp<ViewStyle>;
};

export function Destacados({ clima, pronostico: p, style }: DestacadosProps) {
  return (
    <Tarjeta titulo="Resumen de hoy" style={style}>
      <View style={styles.cuadricula}>
        <View style={[estilosTarjeta.interna, styles.grande]}>
          <Text style={estilosTarjeta.etiqueta}>Viento</Text>
          <BarrasViento valores={p?.vientoPorHora ?? []} />
          <ValorAnimado numero={p?.viento} decimales={1} unidad="km/h" />
        </View>

        <View style={[estilosTarjeta.interna, styles.grande]}>
          <Text style={estilosTarjeta.etiqueta}>Índice UV</Text>
          <View style={styles.relleno}>
            <Barra progreso={p ? p.uv / 11 : 0} color={colores.primario} />
            <View style={styles.escala}>
              <Text style={estilosTarjeta.nota}>0</Text>
              <Text style={estilosTarjeta.nota}>6</Text>
              <Text style={estilosTarjeta.nota}>11+</Text>
            </View>
          </View>
          <ValorAnimado numero={p?.uv} decimales={1} unidad="uv" />
        </View>

        <View style={[estilosTarjeta.interna, styles.grande]}>
          <Text style={estilosTarjeta.etiqueta}>Amanecer y atardecer</Text>
          <View style={styles.relleno}>
            <Barra progreso={p ? progresoDelDia(p.amanecerMs, p.atardecerMs) : 0} color={colores.sol} punto />
          </View>
          <View style={styles.solFila}>
            <Sol icono="sunny-outline" etiqueta="Amanecer" hora={p ? horaDeIso(p.amanecer) : '—'} />
            <Sol icono="moon-outline" etiqueta="Atardecer" hora={p ? horaDeIso(p.atardecer) : '—'} />
          </View>
        </View>
      </View>

      <View style={styles.cuadricula}>
        <Pequena etiqueta="Humedad" numero={clima?.humedad} unidad="%" icono="water-outline" progreso={(clima?.humedad ?? 0) / 100} color="#38BDF8" />
        <Pequena
          etiqueta="Visibilidad"
          numero={p?.visibilidadKm}
          decimales={1}
          unidad="km"
          icono="eye-outline"
          progreso={Math.min((p?.visibilidadKm ?? 0) / 10, 1)}
          color="#A78BFA"
        />
        <Pequena
          etiqueta="Sensación"
          numero={p?.sensacion}
          unidad="°"
          icono="thermometer-outline"
          progreso={Math.min(Math.max(((p?.sensacion ?? -10) + 10) / 50, 0), 1)}
          color={(p?.sensacion ?? 0) >= 28 ? '#FB923C' : colores.primario}
        />
      </View>
    </Tarjeta>
  );
}

function progresoDelDia(inicio: number, fin: number) {
  return Math.min(1, Math.max(0, (Date.now() - inicio) / (fin - inicio)));
}

function Temperatura({ valor }: { valor: number }) {
  const texto = useContador(Math.round(valor), 1400);
  return (
    <Text style={styles.temperatura}>
      {texto}
      <Text style={styles.grados}>°C</Text>
    </Text>
  );
}

function BarrasViento({ valores }: { valores: number[] }) {
  const maximo = Math.max(1, ...valores);
  return (
    <View style={styles.barras}>
      {valores.map((valor, i) => (
        <BarraViento key={i} alto={6 + (valor / maximo) * 34} actual={i === 0} retraso={i * 70} />
      ))}
    </View>
  );
}

/** Barra que crece desde abajo al aparecer; la de la hora actual además late. */
/**
 * Barra del viento: crece al aparecer y después "respira" sin parar (sube y baja un poco con su
 * propio ritmo), como una gráfica en vivo. La de la hora actual además brilla.
 */
function BarraViento({ alto, actual, retraso }: { alto: number; actual: boolean; retraso: number }) {
  const crece = useProgreso(1, retraso, 700);
  const ola = useBucle(900 + (retraso % 7) * 110, { vaiven: true, retraso: retraso + 700 });
  // Alto (animación de diseño) y escala/opacidad (animación nativa) van en capas distintas.
  return (
    <Animated.View style={[styles.barraViento, { height: crece.interpolate({ inputRange: [0, 1], outputRange: [0, alto] }) }]}>
      <Animated.View
        style={[
          styles.barraRelleno,
          {
            backgroundColor: actual ? colores.primario : 'rgba(150,190,255,0.28)',
            boxShadow: actual ? `0 0 10px ${colores.primario}` : undefined,
            opacity: ola.interpolate({ inputRange: [0, 1], outputRange: actual ? [0.8, 1] : [0.65, 1] }),
            transformOrigin: 'bottom',
            transform: [{ scaleY: ola.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }],
          },
        ]}
      />
    </Animated.View>
  );
}

/** Destello de luz que recorre una barra cada pocos segundos. */
function Destello({ ancho, retraso = 0 }: { ancho: number; retraso?: number }) {
  const t = useBucle(2600, { retraso, activo: ancho > 0 });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.destello,
        {
          transform: [
            { translateX: t.interpolate({ inputRange: [0, 0.6, 1], outputRange: [-50, ancho + 10, ancho + 10] }) },
            { skewX: '-20deg' },
          ],
        },
      ]}
    />
  );
}

function Barra({ progreso, color, punto }: { progreso: number; color: string; punto?: boolean }) {
  const ancho = useProgreso(progreso, 300, 1400);
  const brillo = useBucle(1800, { vaiven: true, activo: Boolean(punto) });
  const [anchoPista, setAnchoPista] = useState(0);
  const porcentaje = ancho.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={styles.pista} onLayout={(e) => setAnchoPista(e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.progreso, { width: porcentaje, backgroundColor: color, boxShadow: `0 0 10px ${color}` }]}>
        <Destello ancho={anchoPista * progreso} retraso={1800} />
      </Animated.View>
      {punto ? (
        <Animated.View style={[styles.puntoPosicion, { left: porcentaje }]}>
          <Animated.View
            style={[
              styles.punto,
              {
                backgroundColor: color,
                boxShadow: `0 0 12px ${color}`,
                transform: [{ scale: brillo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
              },
            ]}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

function ValorAnimado({ numero, decimales = 0, unidad }: { numero: number | null | undefined; decimales?: number; unidad?: string }) {
  const texto = useContador(numero, 1200, decimales);
  return (
    <Text style={styles.valor}>
      {texto}
      {unidad ? <Text style={styles.unidad}> {unidad}</Text> : null}
    </Text>
  );
}

function Sol({ icono, etiqueta, hora }: { icono: 'sunny-outline' | 'moon-outline'; etiqueta: string; hora: string }) {
  return (
    <View style={styles.sol}>
      <Ionicons name={icono} size={16} color={colores.sol} />
      <View>
        <Text style={estilosTarjeta.nota}>{etiqueta}</Text>
        <Text style={styles.solHora}>{hora}</Text>
      </View>
    </View>
  );
}

type PequenaProps = {
  etiqueta: string;
  numero: number | null | undefined;
  decimales?: number;
  unidad?: string;
  icono: keyof typeof Ionicons.glyphMap;
  progreso: number;
  color: string;
};

function Pequena({ etiqueta, numero, decimales, unidad, icono, progreso, color }: PequenaProps) {
  return (
    <View style={[estilosTarjeta.interna, styles.pequena]}>
      <View style={styles.flex}>
        <Text style={estilosTarjeta.etiqueta}>{etiqueta}</Text>
        <ValorAnimado numero={numero} decimales={decimales} unidad={unidad} />
        <View style={styles.miniBarra}>
          <Barra progreso={numero === null || numero === undefined ? 0 : progreso} color={color} />
        </View>
      </View>
      <Flotar altura={4} duracion={3000}>
        <Ionicons name={icono} size={22} color={colores.primario} />
      </Flotar>
    </View>
  );
}

/* ───────────── Pronóstico 7 días ───────────── */

export function PronosticoSemana({ pronostico, style }: { pronostico: Pronostico | null; style?: StyleProp<ViewStyle> }) {
  return (
    <Tarjeta titulo="Pronóstico 7 días" style={style}>
      {pronostico ? (
        pronostico.dias.map((dia, i) => {
          const fecha = new Date(`${dia.fecha}T12:00:00`);
          return (
            <Aparecer key={dia.fecha} retraso={250 + i * 90} style={styles.dia}>
              <Flotar altura={3} duracion={2400 + i * 200}>
                <Text style={styles.diaIcono}>{iconoClima(dia.codigo)}</Text>
              </Flotar>
              <Text style={styles.diaTemp}>
                {Math.round(dia.maxima)}°<Text style={styles.diaMin}>/{Math.round(dia.minima)}°</Text>
              </Text>
              <Text style={styles.diaFecha}>
                {fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
              </Text>
              <Text style={styles.diaNombre}>
                {i === 0 ? 'Hoy' : mayuscula(fecha.toLocaleDateString('es-MX', { weekday: 'long' }))}
              </Text>
            </Aparecer>
          );
        })
      ) : (
        <Text style={estilosTarjeta.etiqueta}>Cargando pronóstico…</Text>
      )}
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  actual: {
    gap: espacio.sm,
  },
  actualArriba: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  iconoGrande: {
    fontSize: 64,
  },
  botones: {
    flexDirection: 'row',
    gap: espacio.sm,
  },
  botonActivo: {
    backgroundColor: colores.primarioSuave,
  },
  buscador: {
    gap: 6,
  },
  buscadorCampo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
    backgroundColor: colores.tarjetaAlta,
    borderWidth: 1,
    borderColor: colores.primario,
    borderRadius: radio.sm,
    paddingHorizontal: espacio.sm + 2,
  },
  buscadorEntrada: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    fontSize: 14,
    color: colores.texto,
  },
  errorBusqueda: {
    fontSize: 12,
    color: colores.error,
  },
  elegida: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colores.primarioSuave,
    borderRadius: radio.sm,
    paddingHorizontal: espacio.sm + 2,
    paddingVertical: 6,
  },
  elegidaTexto: {
    fontSize: 12,
    fontWeight: '600',
    color: colores.primario,
  },
  volver: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  volverTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: colores.primario,
  },
  botonRedondo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colores.tarjetaAlta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  temperatura: {
    fontSize: 56,
    fontWeight: '300',
    color: colores.texto,
  },
  grados: {
    fontSize: 28,
    fontWeight: '300',
  },
  renglon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
  },
  condicion: {
    fontSize: 14,
    color: colores.texto,
  },
  divisor: {
    height: 1,
    backgroundColor: colores.borde,
    marginVertical: espacio.sm,
  },
  detalle: {
    fontSize: 13,
    color: colores.textoSecundario,
  },
  detalleFuerte: {
    color: colores.texto,
    fontWeight: '600',
  },
  cuadricula: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacio.sm + 4,
  },
  grande: {
    flexGrow: 1,
    flexBasis: 200,
    minHeight: 150,
    justifyContent: 'space-between',
    gap: espacio.sm,
  },
  flex: {
    flex: 1,
  },
  miniBarra: {
    marginTop: 8,
    marginRight: espacio.md,
  },
  pequena: {
    flexGrow: 1,
    flexBasis: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  relleno: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  barras: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    minHeight: 44,
  },
  barraViento: {
    flex: 1,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barraRelleno: {
    flex: 1,
  },
  puntoPosicion: {
    position: 'absolute',
    width: 0,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pista: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colores.fondo,
    justifyContent: 'center',
  },
  progreso: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  destello: {
    position: 'absolute',
    top: -4,
    width: 26,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  punto: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colores.tarjetaAlta,
  },
  escala: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  valor: {
    fontSize: 26,
    fontWeight: '600',
    color: colores.texto,
  },
  unidad: {
    fontSize: 12,
    fontWeight: '400',
    color: colores.textoSecundario,
  },
  solFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  solHora: {
    fontSize: 14,
    fontWeight: '600',
    color: colores.texto,
  },
  dia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.md,
    paddingVertical: 6,
    paddingHorizontal: espacio.sm,
    borderRadius: radio.sm,
  },
  diaIcono: {
    fontSize: 22,
    width: 30,
  },
  diaTemp: {
    fontSize: 16,
    fontWeight: '600',
    color: colores.texto,
    width: 72,
  },
  diaMin: {
    fontSize: 13,
    fontWeight: '400',
    color: colores.textoSecundario,
  },
  diaFecha: {
    flex: 1,
    fontSize: 13,
    color: colores.textoSecundario,
  },
  diaNombre: {
    fontSize: 13,
    color: colores.textoSecundario,
    textAlign: 'right',
  },
});
