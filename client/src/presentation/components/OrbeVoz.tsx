import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';

import type { EstadoVoz } from '../hooks/useEscuchaContinua';
import { colores } from '../theme';
import { useBucle } from './animaciones';

const TAMANO = 92; // Esfera
const LIENZO = 190; // Espacio para anillos y ondas

type Props = {
  estado: EstadoVoz;
  hablando?: boolean;
  onPress: () => void;
};

/**
 * Orbe 3D de Barbie:
 * - reposo: respira y los anillos orbitan despacio;
 * - escuchando ("Barbie" ya dicho): lanza ondas;
 * - hablando: ecualizador dentro de la esfera y anillos rápidos.
 */
export function OrbeVoz({ estado, hablando = false, onPress }: Props) {
  const encendido = estado !== 'apagado' && estado !== 'sinSoporte';
  const activo = estado === 'activo' || estado === 'procesando';

  const respira = useBucle(2600, { vaiven: true, activo: encendido });
  const giroA = useBucle(hablando ? 2200 : activo ? 4000 : 9000, { activo: encendido });
  const giroB = useBucle(hablando ? 3000 : activo ? 5500 : 12000, { activo: encendido });
  const onda = useBucle(activo || hablando ? 1300 : 2600, { activo: encendido });

  const color = hablando ? '#8F7BFF' : activo ? colores.primario : encendido ? '#2F6FD6' : '#2A3342';
  const brillo = hablando ? 'rgba(143,123,255,0.55)' : activo ? 'rgba(76,158,255,0.55)' : 'rgba(76,158,255,0.25)';

  const gira = (valor: Animated.Value) => valor.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Pausar o reanudar la escucha">
      <View style={styles.lienzo}>
        {/* Halo de luz detrás */}
        {encendido ? (
          <Animated.View
            style={[
              styles.halo,
              Platform.OS === 'web' ? ({ filter: 'blur(28px)' } as object) : null,
              {
                backgroundColor: brillo,
                transform: [{ scale: respira.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] }) }],
              },
            ]}
          />
        ) : null}

        {/* Ondas que salen al escuchar o hablar */}
        {encendido
          ? [0, 0.5].map((desfase) => (
              <Animated.View
                key={desfase}
                style={[
                  styles.onda,
                  {
                    borderColor: color,
                    opacity: onda.interpolate({
                      inputRange: [0, desfase, Math.min(desfase + 0.5, 1), 1],
                      outputRange: activo || hablando ? [0, 0.5, 0, 0] : [0, 0.22, 0, 0],
                    }),
                    transform: [
                      {
                        scale: onda.interpolate({
                          inputRange: [0, desfase, 1],
                          outputRange: [1, 1, desfase ? 1.5 : 1.9],
                        }),
                      },
                    ],
                  },
                ]}
              />
            ))
          : null}

        {/* Anillos orbitando en 3D */}
        <Animated.View
          style={[
            styles.anillo,
            {
              borderColor: encendido ? color : colores.borde,
              transform: [{ perspective: 600 }, { rotateX: '72deg' }, { rotateZ: gira(giroA) }],
            },
          ]}
        >
          <View style={[styles.satelite, { backgroundColor: encendido ? '#CFE3FF' : colores.textoTenue }]} />
        </Animated.View>
        <Animated.View
          style={[
            styles.anillo,
            styles.anilloB,
            {
              borderColor: encendido ? color : colores.borde,
              transform: [{ perspective: 600 }, { rotateY: '70deg' }, { rotateZ: gira(giroB) }],
            },
          ]}
        />

        {/* Esfera */}
        <Animated.View
          style={[
            styles.esfera,
            {
              backgroundColor: color,
              boxShadow: encendido ? `0 0 34px ${brillo}` : undefined,
              transform: [{ scale: respira.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }],
            },
          ]}
        >
          <View style={styles.reflejo} />
          <View style={styles.sombraInferior} />
          {hablando ? <Ecualizador /> : <Microfono color={encendido ? '#FFFFFF' : colores.textoSecundario} />}
        </Animated.View>
      </View>
    </Pressable>
  );
}

function Ecualizador() {
  const DURACIONES = [420, 300, 520, 360, 460];
  return (
    <View style={styles.ecualizador}>
      {DURACIONES.map((duracion, i) => (
        <BarraVoz key={i} duracion={duracion} />
      ))}
    </View>
  );
}

function BarraVoz({ duracion }: { duracion: number }) {
  const t = useBucle(duracion, { vaiven: true });
  return (
    <Animated.View
      style={[styles.barraVoz, { transform: [{ scaleY: t.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }]}
    />
  );
}

function Microfono({ color }: { color: string }) {
  return (
    <View style={styles.microfono}>
      <View style={[styles.capsula, { backgroundColor: color }]} />
      <View style={[styles.arco, { borderColor: color }]} />
      <View style={[styles.base, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  lienzo: {
    width: LIENZO,
    height: LIENZO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: TAMANO * 1.6,
    height: TAMANO * 1.6,
    borderRadius: TAMANO,
  },
  onda: {
    position: 'absolute',
    width: TAMANO,
    height: TAMANO,
    borderRadius: TAMANO / 2,
    borderWidth: 2,
  },
  anillo: {
    position: 'absolute',
    width: TAMANO * 1.75,
    height: TAMANO * 1.75,
    borderRadius: TAMANO,
    borderWidth: 1.5,
    opacity: 0.7,
    alignItems: 'center',
  },
  anilloB: {
    width: TAMANO * 1.5,
    height: TAMANO * 1.5,
    opacity: 0.45,
  },
  satelite: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: -5,
  },
  esfera: {
    width: TAMANO,
    height: TAMANO,
    borderRadius: TAMANO / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // Luz arriba a la izquierda y sombra abajo: dan volumen de esfera.
  reflejo: {
    position: 'absolute',
    top: 10,
    left: 20,
    width: TAMANO * 0.3,
    height: TAMANO * 0.14,
    borderRadius: TAMANO,
    backgroundColor: 'rgba(255,255,255,0.22)',
    transform: [{ rotate: '-30deg' }],
  },
  sombraInferior: {
    position: 'absolute',
    bottom: -TAMANO * 0.35,
    width: TAMANO * 1.2,
    height: TAMANO * 0.7,
    borderRadius: TAMANO,
    backgroundColor: 'rgba(0,0,20,0.25)',
  },
  ecualizador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
  },
  barraVoz: {
    width: 5,
    height: 34,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  microfono: {
    alignItems: 'center',
  },
  capsula: {
    width: 16,
    height: 26,
    borderRadius: 8,
  },
  arco: {
    width: 28,
    height: 16,
    marginTop: -10,
    borderWidth: 2.5,
    borderTopWidth: 0,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  base: {
    width: 2.5,
    height: 7,
  },
});
