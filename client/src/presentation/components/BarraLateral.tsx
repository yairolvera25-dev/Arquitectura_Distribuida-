import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ServidorId } from '../../config';
import type { EstadoVoz } from '../hooks/useEscuchaContinua';
import { colores, espacio, radio } from '../theme';
import { DETALLE_SERVIDOR, microfonoApagado, type EstadoServidor } from './Asistente';

type Props = {
  estadoVoz: EstadoVoz;
  servidores: Partial<Record<ServidorId, EstadoServidor>>;
  cargando: boolean;
  onAlternarVoz: () => void;
  onActualizar: () => void;
};

/** Barra lateral para escritorio/tablet (como en el diseño de referencia). */
export function BarraLateral({ estadoVoz, servidores, cargando, onAlternarVoz, onActualizar }: Props) {
  const apagado = microfonoApagado(estadoVoz);
  return (
    <View style={styles.barra}>
      <Logo />

      <View style={styles.grupo}>
        <Boton icono="grid" activo etiqueta="Dashboard" />
        <Boton icono="refresh" etiqueta="Actualizar clima" onPress={onActualizar} deshabilitado={cargando} />
        <Boton
          icono={apagado ? 'mic-off-outline' : 'mic'}
          etiqueta={apagado ? 'Encender micrófono' : 'Apagar micrófono'}
          activo={!apagado}
          onPress={onAlternarVoz}
        />
      </View>

      <View style={styles.espaciador} />

      <View style={styles.grupo}>
        {(Object.keys(DETALLE_SERVIDOR) as ServidorId[]).map((id) => {
          const estado = servidores[id];
          const color = !estado ? colores.textoTenue : estado.ok ? colores.exito : colores.error;
          return (
            <View key={id} style={styles.servidor} accessibilityLabel={DETALLE_SERVIDOR[id].titulo}>
              <Text style={styles.servidorTexto}>{DETALLE_SERVIDOR[id].numero}</Text>
              <View style={[styles.servidorPunto, { backgroundColor: color }]} />
            </View>
          );
        })}
      </View>

      <View style={styles.avatar}>
        <Text style={styles.avatarTexto}>UPP</Text>
      </View>
    </View>
  );
}

export function Logo({ horizontal }: { horizontal?: boolean }) {
  return (
    <View style={[styles.logo, horizontal && styles.logoHorizontal]}>
      <Ionicons name="sparkles" size={22} color={colores.primario} />
      <Text style={styles.logoTexto}>Barbie</Text>
    </View>
  );
}

type BotonProps = {
  icono: keyof typeof Ionicons.glyphMap;
  etiqueta: string;
  activo?: boolean;
  deshabilitado?: boolean;
  onPress?: () => void;
};

function Boton({ icono, etiqueta, activo, deshabilitado, onPress }: BotonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado || !onPress}
      accessibilityLabel={etiqueta}
      style={({ pressed }) => [styles.boton, activo && styles.botonActivo, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name={icono} size={20} color={activo ? colores.primario : colores.textoSecundario} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  barra: {
    width: 76,
    alignItems: 'center',
    backgroundColor: colores.tarjeta,
    borderRadius: radio.lg,
    borderWidth: 1,
    borderColor: colores.borde,
    paddingVertical: espacio.lg,
    gap: espacio.xl,
  },
  logo: {
    alignItems: 'center',
    gap: 4,
  },
  logoHorizontal: {
    flexDirection: 'row',
    gap: espacio.sm,
  },
  logoTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: colores.texto,
  },
  grupo: {
    gap: espacio.md,
    alignItems: 'center',
  },
  boton: {
    width: 44,
    height: 44,
    borderRadius: radio.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonActivo: {
    backgroundColor: colores.primarioSuave,
  },
  espaciador: {
    flex: 1,
  },
  servidor: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colores.tarjetaAlta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servidorTexto: {
    fontSize: 14,
    fontWeight: '700',
    color: colores.texto,
  },
  servidorPunto: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colores.tarjeta,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colores.primarioOscuro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: {
    fontSize: 11,
    fontWeight: '700',
    color: colores.texto,
  },
});
