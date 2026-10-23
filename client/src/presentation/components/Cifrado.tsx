import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { SERVIDORES, type ServidorId } from '../../config';
import { consultarCifrado, type RegistroGuardado } from '../../data/services/servidores';
import { colores, espacio, radio } from '../theme';
import { DETALLE_SERVIDOR } from './Asistente';
import { estilosTarjeta, Tarjeta } from './Tarjeta';

// Actividad 2, Parcial 2 (Ruta A): lo que guarda cada servidor en su columna Cifrado y lo que
// sale al descifrarlo. El servidor descifra; la app solo muestra las dos caras del registro.

const REGISTROS_POR_SERVIDOR = 3;
const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });
const MORADO = '#B98CFF';

type Parte = { etiqueta: string; color: string };

const ALGORITMO: Record<ServidorId, { nombre: string; explicacion: string; partes: Parte[] }> = {
  windows: {
    nombre: 'AES-256-GCM',
    explicacion: 'Simétrico: la misma clave secreta (CLAVE_AES, solo en el servidor) cifra y descifra.',
    partes: [
      { etiqueta: 'algoritmo', color: colores.sol },
      { etiqueta: 'nonce', color: colores.primario },
      { etiqueta: 'datos + etiqueta', color: colores.textoSecundario },
    ],
  },
  linux: {
    nombre: 'RSA-2048 + AES-256-GCM',
    explicacion: 'Híbrido: cada registro usa una clave AES nueva; la clave pública RSA la cifra y solo la privada la recupera.',
    partes: [
      { etiqueta: 'algoritmo', color: colores.sol },
      { etiqueta: 'clave AES cifrada con RSA', color: MORADO },
      { etiqueta: 'nonce', color: colores.primario },
      { etiqueta: 'datos + etiqueta', color: colores.textoSecundario },
    ],
  },
};

type EstadoColumna = { cargando: boolean; error: string; registros: RegistroGuardado[] };

const VACIO: EstadoColumna = { cargando: true, error: '', registros: [] };

const fecha = (texto: string) =>
  new Date(texto).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const recortar = (texto: string, largo: number) => (texto.length > largo ? `${texto.slice(0, largo)}…` : texto);

type Props = {
  usuario: string | undefined;
  /** Cambia cada vez que se guarda un registro, para volver a consultar. */
  version: number;
  style?: StyleProp<ViewStyle>;
};

/** Registros recientes de cada servidor: cifrados como están en la BD y descifrados. */
export function PanelCifrado({ usuario, version, style }: Props) {
  const [columnas, setColumnas] = useState<Record<ServidorId, EstadoColumna>>({ windows: VACIO, linux: VACIO });

  const cargar = useCallback(async () => {
    if (!usuario) return;
    const ids = Object.keys(SERVIDORES) as ServidorId[];
    setColumnas((previo) => ({ ...previo, ...Object.fromEntries(ids.map((id) => [id, { ...previo[id], cargando: true }])) }));
    await Promise.all(
      ids.map(async (id) => {
        let estado: EstadoColumna;
        try {
          estado = { cargando: false, error: '', registros: await consultarCifrado(id, usuario, REGISTROS_POR_SERVIDOR) };
        } catch (error) {
          estado = { cargando: false, error: error instanceof Error ? error.message : String(error), registros: [] };
        }
        setColumnas((previo) => ({ ...previo, [id]: estado }));
      }),
    );
  }, [usuario]);

  useEffect(() => {
    cargar();
  }, [cargar, version]);

  const cargando = Object.values(columnas).some((columna) => columna.cargando);

  return (
    <Tarjeta
      titulo="Cifrado en los servidores"
      style={style}
      accion={
        <Pressable onPress={cargar} disabled={cargando} style={styles.boton} accessibilityLabel="Actualizar">
          {cargando ? (
            <ActivityIndicator size="small" color={colores.primario} />
          ) : (
            <Ionicons name="refresh" size={16} color={colores.primario} />
          )}
        </Pressable>
      }
    >
      <View style={styles.columnas}>
        {(Object.keys(SERVIDORES) as ServidorId[]).map((id) => (
          <ColumnaServidor key={id} id={id} estado={columnas[id]} />
        ))}
      </View>
    </Tarjeta>
  );
}

function ColumnaServidor({ id, estado }: { id: ServidorId; estado: EstadoColumna }) {
  const { titulo, numero } = DETALLE_SERVIDOR[id];
  const algoritmo = ALGORITMO[id];
  // Un servidor sin actualizar responde, pero sin el campo `cifrado`.
  const sinActualizar = estado.registros.length > 0 && estado.registros.every((r) => r.cifrado === undefined);

  return (
    <View style={styles.columna}>
      <View style={styles.encabezado}>
        <View style={styles.numero}>
          <Text style={styles.numeroTexto}>{numero}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.titulo}>
            {titulo} · <Text style={{ color: colores.sol }}>{algoritmo.nombre}</Text>
          </Text>
          <Text style={estilosTarjeta.nota}>{algoritmo.explicacion}</Text>
        </View>
      </View>

      <View style={styles.leyenda}>
        {algoritmo.partes.map((parte) => (
          <View key={parte.etiqueta} style={styles.leyendaItem}>
            <View style={[styles.punto, { backgroundColor: parte.color }]} />
            <Text style={estilosTarjeta.nota}>{parte.etiqueta}</Text>
          </View>
        ))}
      </View>

      {estado.error ? (
        <Aviso icono="cloud-offline-outline" color={colores.error} texto={estado.error} />
      ) : sinActualizar ? (
        <Aviso icono="warning-outline" color={colores.sol} texto={`${titulo} todavía no devuelve el cifrado: hay que actualizarlo.`} />
      ) : !estado.cargando && estado.registros.length === 0 ? (
        <Aviso icono="document-outline" color={colores.textoSecundario} texto="Todavía no guardas registros aquí." />
      ) : (
        estado.registros.map((registro) => <TarjetaRegistro key={registro.id} id={id} registro={registro} />)
      )}
    </View>
  );
}

function TarjetaRegistro({ id, registro }: { id: ServidorId; registro: RegistroGuardado }) {
  const [completo, setCompleto] = useState(false);
  const { partes } = ALGORITMO[id];
  const insignia = registro.alterado
    ? { texto: 'Alterado', color: colores.error, icono: 'close-circle' as const }
    : registro.protegido
      ? { texto: 'Cifrado', color: colores.exito, icono: 'lock-closed' as const }
      : { texto: 'Texto plano', color: colores.sol, icono: 'lock-open' as const };

  const lugar = [registro.municipio, registro.estado].filter(Boolean).join(', ');
  const datos: [string, string | null][] = [
    ['Lugar', lugar || null],
    ['Temperatura', registro.temperatura === null ? null : `${registro.temperatura} °C`],
    ['Humedad', registro.humedad === null ? null : `${registro.humedad} %`],
    ['Viento', registro.viento === null ? null : `${registro.viento} km/h`],
    [
      'Coordenadas',
      registro.latitud === null || registro.longitud === null ? null : `${registro.latitud}, ${registro.longitud}`,
    ],
  ];

  return (
    <View style={[estilosTarjeta.interna, styles.registro]}>
      <View style={styles.registroEncabezado}>
        <Text style={styles.registroTitulo}>
          Registro #{registro.id} · <Text style={estilosTarjeta.nota}>{fecha(registro.fechaHora)}</Text>
        </Text>
        <View style={[styles.insignia, { borderColor: insignia.color }]}>
          <Ionicons name={insignia.icono} size={11} color={insignia.color} />
          <Text style={[styles.insigniaTexto, { color: insignia.color }]}>{insignia.texto}</Text>
        </View>
      </View>

      <Text style={styles.subtitulo}>En la base de datos (columna Cifrado)</Text>
      {registro.cifrado ? (
        <Pressable onPress={() => setCompleto((valor) => !valor)} accessibilityLabel="Ver el cifrado completo">
          <Text style={styles.cifrado} selectable>
            {registro.cifrado.split('$').map((trozo, i) => (
              <Text key={i} style={{ color: partes[i]?.color ?? colores.textoSecundario }}>
                {i > 0 ? <Text style={styles.separador}>$</Text> : null}
                {completo || i === 0 ? trozo : recortar(trozo, 28)}
              </Text>
            ))}
          </Text>
          <Text style={estilosTarjeta.nota}>{completo ? 'Toca para recortar' : 'Toca para verlo completo'}</Text>
        </Pressable>
      ) : (
        <Text style={[styles.cifrado, { color: colores.sol }]}>
          NULL: registro anterior al cifrado, sus datos están en texto plano.
        </Text>
      )}

      <View style={styles.flecha}>
        <Ionicons name="arrow-down" size={14} color={colores.textoTenue} />
        <Text style={estilosTarjeta.nota}>
          {registro.alterado
            ? 'No se pudo descifrar: la etiqueta GCM no coincide'
            : registro.protegido
              ? `Descifrado por el ${DETALLE_SERVIDOR[id].titulo.toLowerCase()}`
              : 'Leído tal cual de la BD'}
        </Text>
      </View>

      {registro.alterado ? null : (
        <View style={styles.datos}>
          {datos.map(([etiqueta, valor]) => (
            <View key={etiqueta} style={styles.dato}>
              <Text style={estilosTarjeta.nota}>{etiqueta}</Text>
              <Text style={styles.datoValor}>{valor ?? '—'}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Aviso({ icono, color, texto }: { icono: keyof typeof Ionicons.glyphMap; color: string; texto: string }) {
  return (
    <View style={[estilosTarjeta.interna, styles.aviso]}>
      <Ionicons name={icono} size={16} color={color} />
      <Text style={[styles.avisoTexto, { color }]}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  boton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.primarioSuave,
  },
  columnas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacio.md,
  },
  columna: {
    flexGrow: 1,
    flexBasis: 300,
    minWidth: 0,
    gap: espacio.sm,
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
  },
  numero: {
    width: 30,
    height: 30,
    borderRadius: radio.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.primarioSuave,
  },
  numeroTexto: {
    fontSize: 14,
    fontWeight: '700',
    color: colores.primario,
  },
  titulo: {
    fontSize: 14,
    fontWeight: '600',
    color: colores.texto,
  },
  leyenda: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacio.sm,
  },
  leyendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  punto: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  registro: {
    gap: espacio.sm,
  },
  registroEncabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacio.sm,
  },
  registroTitulo: {
    fontSize: 13,
    fontWeight: '600',
    color: colores.texto,
  },
  insignia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  insigniaTexto: {
    fontSize: 11,
    fontWeight: '600',
  },
  subtitulo: {
    fontSize: 12,
    color: colores.textoSecundario,
  },
  cifrado: {
    fontFamily: MONO,
    fontSize: 11,
    lineHeight: 16,
    padding: espacio.sm,
    borderRadius: radio.sm,
    backgroundColor: 'rgba(0,0,0,0.35)',
    ...(Platform.OS === 'web' ? ({ wordBreak: 'break-all' } as object) : {}),
  },
  separador: {
    color: colores.textoTenue,
  },
  flecha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  datos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacio.sm,
  },
  dato: {
    flexGrow: 1,
    flexBasis: 110,
    gap: 2,
  },
  datoValor: {
    fontSize: 13,
    fontWeight: '600',
    color: colores.texto,
  },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
  },
  avisoTexto: {
    flex: 1,
    fontSize: 12,
  },
});
