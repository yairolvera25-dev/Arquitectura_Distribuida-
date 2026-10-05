import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colores, espacio, radio, vidrio } from '../theme';

type Props = {
  titulo?: string;
  accion?: ReactNode;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** Tarjeta oscura base del dashboard. */
export function Tarjeta({ titulo, accion, style, children }: Props) {
  return (
    <View style={[styles.tarjeta, style]}>
      {titulo ? (
        <View style={styles.encabezado}>
          <Text style={styles.titulo}>{titulo}</Text>
          {accion}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Título de sección fuera de una tarjeta. */
export function TituloSeccion({ children }: { children: string }) {
  return <Text style={styles.seccion}>{children}</Text>;
}

export const estilosTarjeta = StyleSheet.create({
  interna: {
    backgroundColor: colores.tarjetaAlta,
    borderRadius: radio.md,
    padding: espacio.md,
  },
  etiqueta: {
    fontSize: 13,
    color: colores.textoSecundario,
  },
  nota: {
    fontSize: 11,
    color: colores.textoTenue,
  },
});

const styles = StyleSheet.create({
  tarjeta: {
    ...vidrio,
    borderRadius: radio.lg,
    padding: espacio.md,
    gap: espacio.md,
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titulo: {
    fontSize: 14,
    fontWeight: '600',
    color: colores.texto,
  },
  seccion: {
    fontSize: 14,
    fontWeight: '600',
    color: colores.texto,
  },
});
