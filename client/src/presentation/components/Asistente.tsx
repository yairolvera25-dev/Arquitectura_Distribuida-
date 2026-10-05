import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { SERVIDORES, type ServidorId } from '../../config';
import type { EstadoVoz } from '../hooks/useEscuchaContinua';
import { colores, espacio, radio } from '../theme';
import { OrbeVoz } from './OrbeVoz';
import { estilosTarjeta, Tarjeta } from './Tarjeta';

export type EstadoServidor = { ok: boolean; detalle: string };

export const DETALLE_SERVIDOR: Record<ServidorId, { titulo: string; subtitulo: string; numero: string }> = {
  windows: { titulo: 'Servidor uno', subtitulo: 'Windows Server · SQL Server', numero: '1' },
  linux: { titulo: 'Servidor dos', subtitulo: 'Ubuntu Server', numero: '2' },
};

const TEXTO_ESTADO: Record<EstadoVoz, { titulo: string; ayuda: string }> = {
  apagado: { titulo: 'Micrófono apagado', ayuda: 'Toca el círculo para empezar a escuchar' },
  sinSoporte: { titulo: 'Voz no disponible', ayuda: 'Puedes guardar tocando un servidor' },
  esperando: { titulo: 'Di «Barbie» para activar', ayuda: '«Barbie, guardar en servidor uno»' },
  activo: { titulo: 'Te escucho ✨', ayuda: '¿Servidor uno o servidor dos?' },
  procesando: { titulo: 'Guardando…', ayuda: 'Enviando el registro al servidor' },
};

export const microfonoApagado = (estado: EstadoVoz) => estado === 'apagado' || estado === 'sinSoporte';

/* ───────────── Asistente Barbie ───────────── */

type PanelProps = {
  estado: EstadoVoz;
  transcripcion: string;
  mensaje: string;
  onAlternar: () => void;
  style?: StyleProp<ViewStyle>;
};

export function PanelAsistente({ estado, transcripcion, mensaje, onAlternar, style }: PanelProps) {
  const texto = TEXTO_ESTADO[estado];
  return (
    <Tarjeta titulo="Asistente Barbie" accion={<ChipEstado estado={estado} />} style={style}>
      <View style={styles.panel}>
        <OrbeVoz estado={estado} onPress={onAlternar} />
        <View style={styles.panelTexto}>
          <Text style={styles.estado}>{texto.titulo}</Text>
          <Text style={estilosTarjeta.etiqueta}>{texto.ayuda}</Text>
          <Text style={styles.transcripcion} numberOfLines={2}>
            {transcripcion ? `“${transcripcion}”` : ' '}
          </Text>
          {mensaje ? (
            <View style={styles.burbuja}>
              <Text style={styles.burbujaTexto}>{mensaje}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Tarjeta>
  );
}

export function ChipEstado({ estado }: { estado: EstadoVoz }) {
  const apagado = microfonoApagado(estado);
  return (
    <View style={[styles.chip, apagado && styles.chipApagado]}>
      <View style={[styles.chipPunto, { backgroundColor: apagado ? colores.textoTenue : colores.primario }]} />
      <Text style={[styles.chipTexto, apagado && { color: colores.textoSecundario }]}>
        {apagado ? 'Apagado' : 'Escuchando'}
      </Text>
    </View>
  );
}

/* ───────────── Servidores ───────────── */

type ServidoresProps = {
  estados: Partial<Record<ServidorId, EstadoServidor>>;
  deshabilitado: boolean;
  onGuardar: (servidor: ServidorId) => void;
  style?: StyleProp<ViewStyle>;
};

export function ListaServidores({ estados, deshabilitado, onGuardar, style }: ServidoresProps) {
  return (
    <Tarjeta titulo="Servidores" style={style}>
      <View style={styles.servidores}>
        {(Object.keys(SERVIDORES) as ServidorId[]).map((id) => {
          const { titulo, subtitulo, numero } = DETALLE_SERVIDOR[id];
          const estado = estados[id];
          return (
            <Pressable
              key={id}
              onPress={() => onGuardar(id)}
              disabled={deshabilitado}
              style={({ pressed }) => [estilosTarjeta.interna, styles.servidor, pressed && styles.presionado]}
            >
              <View style={styles.numero}>
                <Text style={styles.numeroTexto}>{numero}</Text>
              </View>
              <View style={styles.servidorInfo}>
                <Text style={styles.servidorTitulo}>{titulo}</Text>
                <Text style={estilosTarjeta.nota}>{subtitulo}</Text>
              </View>
              {estado ? (
                <Text style={[styles.servidorEstado, { color: estado.ok ? colores.exito : colores.error }]}>
                  {estado.detalle}
                </Text>
              ) : (
                <Ionicons
                  name="cloud-upload-outline"
                  size={20}
                  color={deshabilitado ? colores.textoTenue : colores.primario}
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  panel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.md,
  },
  panelTexto: {
    flexGrow: 1,
    flexBasis: 220,
    gap: espacio.xs,
  },
  estado: {
    fontSize: 20,
    fontWeight: '600',
    color: colores.texto,
  },
  transcripcion: {
    fontSize: 14,
    fontStyle: 'italic',
    color: colores.primario,
    marginTop: espacio.sm,
    minHeight: 20,
  },
  burbuja: {
    alignSelf: 'flex-start',
    backgroundColor: colores.tarjetaAlta,
    borderRadius: radio.sm,
    borderTopLeftRadius: 4,
    paddingHorizontal: espacio.md,
    paddingVertical: espacio.sm,
    marginTop: espacio.xs,
  },
  burbujaTexto: {
    fontSize: 13,
    color: colores.texto,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colores.primarioSuave,
  },
  chipApagado: {
    backgroundColor: colores.tarjetaAlta,
  },
  chipPunto: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  chipTexto: {
    fontSize: 12,
    fontWeight: '600',
    color: colores.primario,
  },
  servidores: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacio.sm + 4,
  },
  servidor: {
    flexGrow: 1,
    flexBasis: 240,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.md,
  },
  presionado: {
    opacity: 0.7,
  },
  numero: {
    width: 38,
    height: 38,
    borderRadius: radio.sm,
    backgroundColor: colores.primarioSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeroTexto: {
    fontSize: 16,
    fontWeight: '700',
    color: colores.primario,
  },
  servidorInfo: {
    flex: 1,
    gap: 2,
  },
  servidorTitulo: {
    fontSize: 15,
    fontWeight: '600',
    color: colores.texto,
  },
  servidorEstado: {
    fontSize: 12,
    fontWeight: '600',
  },
});
