// Piezas de animación reutilizables. Solo usan la API Animated de React Native, así que
// funcionan en web y en el celular sin recompilar la app (no hace falta Reanimated).

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, type StyleProp, type ViewStyle } from 'react-native';

export const NATIVO = Platform.OS !== 'web';

/** Valor que va de 0 a 1 una y otra vez (o de ida y vuelta con `vaivén`). */
export function useBucle(duracion: number, { vaiven = false, retraso = 0, activo = true } = {}) {
  const valor = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!activo) {
      valor.stopAnimation();
      return;
    }
    const ida = Animated.timing(valor, { toValue: 1, duration: duracion, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVO });
    const vuelta = Animated.timing(valor, { toValue: 0, duration: duracion, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVO });
    const bucle = Animated.loop(
      vaiven
        ? Animated.sequence([ida, vuelta])
        : Animated.timing(valor, { toValue: 1, duration: duracion, easing: Easing.linear, useNativeDriver: NATIVO }),
      { resetBeforeIteration: !vaiven },
    );
    const temporizador = setTimeout(() => bucle.start(), retraso);
    return () => {
      clearTimeout(temporizador);
      bucle.stop();
    };
  }, [valor, duracion, vaiven, retraso, activo]);
  return valor;
}

/** Entrada en 3D: sube, aparece y se endereza (rotateX) con un retraso escalonado. */
export function Aparecer({
  children,
  retraso = 0,
  style,
}: {
  children: ReactNode;
  retraso?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const valor = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(valor, {
      toValue: 1,
      duration: 700,
      delay: retraso,
      easing: Easing.out(Easing.back(1.2)),
      useNativeDriver: NATIVO,
    }).start();
  }, [valor, retraso]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: valor,
          transform: [
            { perspective: 900 },
            { translateY: valor.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
            { rotateX: valor.interpolate({ inputRange: [0, 1], outputRange: ['14deg', '0deg'] }) },
            { scale: valor.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Flota suavemente en reposo (sube, baja y se mece un poco). */
export function Flotar({ children, altura = 6, duracion = 2600 }: { children: ReactNode; altura?: number; duracion?: number }) {
  const valor = useBucle(duracion, { vaiven: true });
  return (
    <Animated.View
      style={{
        transform: [
          { translateY: valor.interpolate({ inputRange: [0, 1], outputRange: [0, -altura] }) },
          { rotate: valor.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Número que sube animado hasta `valor` (para la temperatura y los indicadores). */
export function useContador(valor: number | null | undefined, duracion = 1200, decimales = 0) {
  const animado = useRef(new Animated.Value(0)).current;
  const [texto, setTexto] = useState('—');
  useEffect(() => {
    if (valor === null || valor === undefined || Number.isNaN(valor)) {
      setTexto('—');
      return;
    }
    const id = animado.addListener(({ value }) => setTexto(value.toFixed(decimales)));
    Animated.timing(animado, { toValue: valor, duration: duracion, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(
      () => setTexto(valor.toFixed(decimales)),
    );
    return () => animado.removeListener(id);
  }, [animado, valor, duracion, decimales]);
  return texto;
}

/** Valor de 0 a `destino` animado (para anchos de barras y progresos). */
export function useProgreso(destino: number, retraso = 0, duracion = 1100) {
  const valor = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(valor, {
      toValue: destino,
      duration: duracion,
      delay: retraso,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // Anima anchos (layout): no se puede en el hilo nativo.
    }).start();
  }, [valor, destino, retraso, duracion]);
  return valor;
}
