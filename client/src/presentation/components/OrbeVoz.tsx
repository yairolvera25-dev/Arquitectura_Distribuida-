import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';

import type { EstadoVoz } from '../hooks/useEscuchaContinua';
import { colores } from '../theme';

const TAMANO = 96;

type Props = {
  estado: EstadoVoz;
  onPress: () => void;
};

/** Círculo del micrófono: late suave mientras espera "Barbie" y fuerte cuando se activa. */
export function OrbeVoz({ estado, onPress }: Props) {
  const pulso = useRef(new Animated.Value(0)).current;
  const encendido = estado !== 'apagado' && estado !== 'sinSoporte';
  const activo = estado === 'activo' || estado === 'procesando';

  useEffect(() => {
    if (!encendido) {
      pulso.stopAnimation();
      pulso.setValue(0);
      return;
    }
    const animacion = Animated.loop(
      Animated.timing(pulso, {
        toValue: 1,
        duration: activo ? 1100 : 2400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    pulso.setValue(0);
    animacion.start();
    return () => animacion.stop();
  }, [encendido, activo, pulso]);

  const anillo = {
    transform: [{ scale: pulso.interpolate({ inputRange: [0, 1], outputRange: [1, activo ? 1.55 : 1.3] }) }],
    opacity: pulso.interpolate({ inputRange: [0, 1], outputRange: [activo ? 0.45 : 0.25, 0] }),
  };

  const colorFondo = activo ? colores.primario : encendido ? colores.primarioSuave : colores.tarjetaAlta;
  const colorIcono = activo ? colores.fondo : encendido ? colores.primario : colores.textoSecundario;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Pausar o reanudar la escucha">
      <View style={styles.contenedor}>
        {encendido && <Animated.View style={[styles.anillo, anillo]} />}
        <View style={[styles.orbe, { backgroundColor: colorFondo }]}>
          <Microfono color={colorIcono} />
        </View>
      </View>
    </Pressable>
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
  contenedor: {
    width: TAMANO * 1.6,
    height: TAMANO * 1.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anillo: {
    position: 'absolute',
    width: TAMANO,
    height: TAMANO,
    borderRadius: TAMANO / 2,
    backgroundColor: colores.primario,
  },
  orbe: {
    width: TAMANO,
    height: TAMANO,
    borderRadius: TAMANO / 2,
    alignItems: 'center',
    justifyContent: 'center',
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
