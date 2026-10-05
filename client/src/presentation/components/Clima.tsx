import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { RegistroClima } from '../../data/services/clima';
import { iconoClima, type Pronostico } from '../../data/services/pronostico';
import { colores, espacio, radio } from '../theme';
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
  style?: StyleProp<ViewStyle>;
};

export function TarjetaActual({ clima, pronostico, cargando, onActualizar, style }: ActualProps) {
  return (
    <Tarjeta style={[styles.actual, style]}>
      <View style={styles.actualArriba}>
        <Text style={styles.iconoGrande}>{iconoClima(pronostico?.codigoActual)}</Text>
        <Pressable
          onPress={onActualizar}
          disabled={cargando}
          style={styles.botonRedondo}
          accessibilityLabel="Actualizar clima"
        >
          {cargando ? (
            <ActivityIndicator size="small" color={colores.texto} />
          ) : (
            <Ionicons name="refresh" size={18} color={colores.texto} />
          )}
        </Pressable>
      </View>

      {clima ? (
        <>
          <Text style={styles.temperatura}>
            {Math.round(clima.temperatura)}
            <Text style={styles.grados}>°C</Text>
          </Text>
          <View style={styles.renglon}>
            <Ionicons name="cloud-outline" size={16} color={colores.textoSecundario} />
            <Text style={styles.condicion}>{clima.condicion}</Text>
          </View>
          <View style={styles.divisor} />
          <View style={styles.renglon}>
            <Ionicons name="location-outline" size={15} color={colores.textoSecundario} />
            <Text style={styles.detalle}>{clima.ciudad}</Text>
          </View>
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
          <Valor valor={p ? p.viento.toFixed(1) : '—'} unidad="km/h" />
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
          <Valor valor={p ? p.uv.toFixed(1) : '—'} unidad="uv" />
        </View>

        <View style={[estilosTarjeta.interna, styles.grande]}>
          <Text style={estilosTarjeta.etiqueta}>Amanecer y atardecer</Text>
          <View style={styles.relleno}>
            <Barra progreso={p ? progresoDelDia(p.amanecer, p.atardecer) : 0} color={colores.sol} punto />
          </View>
          <View style={styles.solFila}>
            <Sol icono="sunny-outline" etiqueta="Amanecer" hora={p ? horaDeIso(p.amanecer) : '—'} />
            <Sol icono="moon-outline" etiqueta="Atardecer" hora={p ? horaDeIso(p.atardecer) : '—'} />
          </View>
        </View>
      </View>

      <View style={styles.cuadricula}>
        <Pequena etiqueta="Humedad" valor={clima ? `${clima.humedad}` : '—'} unidad="%" icono="water-outline" />
        <Pequena
          etiqueta="Visibilidad"
          valor={p ? p.visibilidadKm.toFixed(1) : '—'}
          unidad="km"
          icono="eye-outline"
        />
        <Pequena
          etiqueta="Sensación"
          valor={p ? `${Math.round(p.sensacion)}°` : '—'}
          icono="thermometer-outline"
        />
      </View>
    </Tarjeta>
  );
}

function progresoDelDia(amanecer: string, atardecer: string) {
  const inicio = new Date(amanecer).getTime();
  const fin = new Date(atardecer).getTime();
  return Math.min(1, Math.max(0, (Date.now() - inicio) / (fin - inicio)));
}

function BarrasViento({ valores }: { valores: number[] }) {
  const maximo = Math.max(1, ...valores);
  return (
    <View style={styles.barras}>
      {valores.map((valor, i) => (
        <View
          key={i}
          style={[
            styles.barraViento,
            { height: 6 + (valor / maximo) * 34, backgroundColor: i === 0 ? colores.primario : colores.textoTenue },
          ]}
        />
      ))}
    </View>
  );
}

function Barra({ progreso, color, punto }: { progreso: number; color: string; punto?: boolean }) {
  return (
    <View style={styles.pista}>
      <View style={[styles.progreso, { width: `${progreso * 100}%`, backgroundColor: color }]} />
      {punto ? <View style={[styles.punto, { left: `${progreso * 100}%`, backgroundColor: color }]} /> : null}
    </View>
  );
}

function Valor({ valor, unidad }: { valor: string; unidad?: string }) {
  return (
    <Text style={styles.valor}>
      {valor}
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
  valor: string;
  unidad?: string;
  icono: keyof typeof Ionicons.glyphMap;
};

function Pequena({ etiqueta, valor, unidad, icono }: PequenaProps) {
  return (
    <View style={[estilosTarjeta.interna, styles.pequena]}>
      <View>
        <Text style={estilosTarjeta.etiqueta}>{etiqueta}</Text>
        <Valor valor={valor} unidad={unidad} />
      </View>
      <Ionicons name={icono} size={22} color={colores.primario} />
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
            <View key={dia.fecha} style={styles.dia}>
              <Text style={styles.diaIcono}>{iconoClima(dia.codigo)}</Text>
              <Text style={styles.diaTemp}>
                {Math.round(dia.maxima)}°<Text style={styles.diaMin}>/{Math.round(dia.minima)}°</Text>
              </Text>
              <Text style={styles.diaFecha}>
                {fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
              </Text>
              <Text style={styles.diaNombre}>
                {i === 0 ? 'Hoy' : mayuscula(fecha.toLocaleDateString('es-MX', { weekday: 'long' }))}
              </Text>
            </View>
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
  },
  punto: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
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
