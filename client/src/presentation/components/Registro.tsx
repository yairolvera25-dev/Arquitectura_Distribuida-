import { Ionicons } from '@expo/vector-icons';
import { Fragment, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { ServidorId } from '../../config';
import { limpiarBitacora, type Evento, type Nivel, type Orden, type Origen } from '../../data/services/bitacora';
import { respaldarBitacora } from '../../data/services/respaldo';
import { useBitacora } from '../hooks/useBitacora';
import { colores, espacio, radio } from '../theme';
import { estilosTarjeta, Tarjeta } from './Tarjeta';

type Icono = keyof typeof Ionicons.glyphMap;

const ORIGENES: Record<Origen, { etiqueta: string; icono: Icono }> = {
  voz: { etiqueta: 'Voz', icono: 'mic' },
  barbie: { etiqueta: 'Barbie', icono: 'sparkles' },
  gemini: { etiqueta: 'Gemini', icono: 'hardware-chip' },
  servidor: { etiqueta: 'Servidor', icono: 'server' },
  clima: { etiqueta: 'Clima', icono: 'partly-sunny' },
  cuenta: { etiqueta: 'Cuenta', icono: 'person-circle' },
  app: { etiqueta: 'App', icono: 'apps' },
};

const COLOR: Record<Nivel, string> = {
  info: colores.primario,
  exito: colores.exito,
  aviso: colores.sol,
  error: colores.error,
};

const ICONO_NIVEL: Record<Nivel, Icono> = {
  info: 'ellipse',
  exito: 'checkmark-circle',
  aviso: 'warning',
  error: 'close-circle',
};

const GRAVEDAD: Record<Nivel, number> = { info: 0, exito: 1, aviso: 2, error: 3 };

const peor = (niveles: Nivel[]): Nivel =>
  niveles.reduce<Nivel>((actual, nivel) => (GRAVEDAD[nivel] > GRAVEDAD[actual] ? nivel : actual), 'info');

const horaExacta = (fecha: number) =>
  new Date(fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const duracion = (ms?: number) => (ms === undefined ? '' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

/* ───────────── Cadena de pasos de la última orden (va en el panel de Barbie) ───────────── */

/** Voz → Gemini → Servidor… con el paso que falló en rojo y su explicación debajo. */
export function CadenaOrden() {
  const { eventos, ordenes } = useBitacora();
  const orden = ordenes.at(-1);
  if (!orden) return null;

  const pasos = eventos.filter((evento) => evento.orden === orden.id);
  // Un paso por origen, en el orden en que aparecieron, con su peor nivel.
  const origenes = [...new Set(pasos.map((paso) => paso.origen))];
  const estados = origenes.map((origen) => ({
    origen,
    nivel: peor(pasos.filter((paso) => paso.origen === origen).map((paso) => paso.nivel)),
  }));
  const fallo = pasos.find((paso) => paso.nivel === 'error') ?? pasos.find((paso) => paso.nivel === 'aviso');
  const enCurso = !orden.fin;

  return (
    <View style={styles.cadena}>
      <View style={styles.cadenaFila}>
        {estados.map(({ origen, nivel }, i) => (
          <Fragment key={origen}>
            {i > 0 ? <View style={[styles.conector, { backgroundColor: COLOR[estados[i - 1].nivel] }]} /> : null}
            <View style={[styles.paso, { borderColor: COLOR[nivel] }]}>
              <Ionicons name={ORIGENES[origen].icono} size={13} color={COLOR[nivel]} />
              <Text style={[styles.pasoTexto, { color: COLOR[nivel] }]}>{ORIGENES[origen].etiqueta}</Text>
              {nivel === 'error' || nivel === 'aviso' ? (
                <Ionicons name={ICONO_NIVEL[nivel]} size={13} color={COLOR[nivel]} />
              ) : null}
            </View>
          </Fragment>
        ))}
        {enCurso ? <Text style={styles.enCurso}>…</Text> : null}
      </View>

      {fallo && !enCurso ? (
        <View style={[styles.fallo, { borderColor: COLOR[fallo.nivel] }]}>
          <Ionicons name={ICONO_NIVEL[fallo.nivel]} size={18} color={COLOR[fallo.nivel]} />
          <View style={styles.flex}>
            <Text style={[styles.falloTitulo, { color: COLOR[fallo.nivel] }]}>
              {fallo.nivel === 'error' ? `Falló en: ${ORIGENES[fallo.origen].etiqueta}` : 'Aviso'}
            </Text>
            <Text style={styles.falloTexto}>{fallo.mensaje}</Text>
            {fallo.detalle ? <Text style={styles.detalle}>{fallo.detalle}</Text> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/* ───────────── Registro de actividad completo ───────────── */

type Elemento = { tipo: 'orden'; orden: Orden; pasos: Evento[] } | { tipo: 'evento'; evento: Evento };

const POR_PAGINA = 8;

export function PanelRegistro({ style }: { style?: StyleProp<ViewStyle> }) {
  const { eventos, ordenes } = useBitacora();
  const [soloErrores, setSoloErrores] = useState(false);
  const [mostrar, setMostrar] = useState(POR_PAGINA);

  // Órdenes con sus pasos y eventos sueltos, lo más reciente primero.
  const elementos = useMemo(() => {
    const lista: (Elemento & { fecha: number })[] = [
      ...ordenes.map((orden) => ({
        tipo: 'orden' as const,
        orden,
        pasos: eventos.filter((evento) => evento.orden === orden.id),
        fecha: orden.inicio,
      })),
      ...eventos
        .filter((evento) => evento.orden === undefined)
        .map((evento) => ({ tipo: 'evento' as const, evento, fecha: evento.fecha })),
    ];
    return lista
      .filter((elemento) =>
        !soloErrores
          ? true
          : elemento.tipo === 'orden'
            ? elemento.orden.resultado === 'error' || elemento.pasos.some((paso) => paso.nivel === 'error')
            : elemento.evento.nivel === 'error',
      )
      .sort((a, b) => b.fecha - a.fecha);
  }, [eventos, ordenes, soloErrores]);

  const errores = eventos.filter((evento) => evento.nivel === 'error').length;
  const [respaldando, setRespaldando] = useState(false);
  const [elegirServidor, setElegirServidor] = useState(false);

  const respaldar = async (servidores: ServidorId[]) => {
    setElegirServidor(false);
    setRespaldando(true);
    await respaldarBitacora(servidores);
    setRespaldando(false);
  };

  return (
    <Tarjeta
      titulo="Registro de actividad"
      style={style}
      accion={
        <View style={styles.acciones}>
          <Filtro activo={!soloErrores} texto="Todo" onPress={() => setSoloErrores(false)} />
          <Filtro
            activo={soloErrores}
            texto={`Errores${errores ? ` (${errores})` : ''}`}
            color={errores ? colores.error : undefined}
            onPress={() => setSoloErrores(true)}
          />
          <Pressable
            onPress={() => setElegirServidor((v) => !v)}
            disabled={respaldando || !eventos.length}
            hitSlop={8}
            accessibilityLabel="Respaldar la bitácora en los servidores"
          >
            <Ionicons
              name={respaldando ? 'sync' : 'cloud-upload-outline'}
              size={18}
              color={eventos.length ? colores.primario : colores.textoTenue}
            />
          </Pressable>
          <Pressable onPress={limpiarBitacora} hitSlop={8} accessibilityLabel="Limpiar registro">
            <Ionicons name="trash-outline" size={18} color={colores.textoSecundario} />
          </Pressable>
        </View>
      }
    >
      {elegirServidor ? (
        <View style={styles.respaldo}>
          <Text style={styles.respaldoTexto}>Respaldar los logs en:</Text>
          <Filtro activo={false} texto="Servidor 1" onPress={() => respaldar(['windows'])} />
          <Filtro activo={false} texto="Servidor 2" onPress={() => respaldar(['linux'])} />
          <Filtro activo texto="Ambos" onPress={() => respaldar(['windows', 'linux'])} />
        </View>
      ) : null}
      {elementos.length === 0 ? (
        <Text style={estilosTarjeta.etiqueta}>
          {soloErrores ? 'Sin errores registrados.' : 'Aquí aparecerá cada orden que le des a Barbie, paso a paso.'}
        </Text>
      ) : (
        elementos.slice(0, mostrar).map((elemento) =>
          elemento.tipo === 'orden' ? (
            <TarjetaOrden key={`o${elemento.orden.id}`} orden={elemento.orden} pasos={elemento.pasos} />
          ) : (
            <FilaEvento key={`e${elemento.evento.id}`} evento={elemento.evento} suelto />
          ),
        )
      )}
      {elementos.length > mostrar ? (
        <Pressable onPress={() => setMostrar((n) => n + POR_PAGINA)}>
          <Text style={styles.verMas}>Ver más ({elementos.length - mostrar})</Text>
        </Pressable>
      ) : null}
    </Tarjeta>
  );
}

function Filtro({ activo, texto, color, onPress }: { activo: boolean; texto: string; color?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.filtro, activo && styles.filtroActivo]}>
      <Text style={[styles.filtroTexto, { color: color ?? (activo ? colores.primario : colores.textoSecundario) }]}>
        {texto}
      </Text>
    </Pressable>
  );
}

function TarjetaOrden({ orden, pasos }: { orden: Orden; pasos: Evento[] }) {
  const nivel: Nivel = orden.resultado ?? 'info';
  const [abierta, setAbierta] = useState(nivel === 'error');

  return (
    <View style={[styles.orden, { borderLeftColor: orden.fin ? COLOR[nivel] : colores.primario }]}>
      <Pressable onPress={() => setAbierta((valor) => !valor)} style={styles.ordenCabecera}>
        <Ionicons
          name={orden.fin ? ICONO_NIVEL[nivel] : 'time-outline'}
          size={18}
          color={orden.fin ? COLOR[nivel] : colores.primario}
        />
        <View style={styles.flex}>
          <Text style={styles.ordenTexto} numberOfLines={abierta ? undefined : 1}>
            “{orden.texto}”
          </Text>
          <Text style={styles.meta}>
            {horaExacta(orden.inicio)}
            {orden.fin ? ` · ${duracion(orden.fin - orden.inicio)}` : ' · en curso'} · {pasos.length} pasos
          </Text>
        </View>
        <Ionicons name={abierta ? 'chevron-up' : 'chevron-down'} size={16} color={colores.textoSecundario} />
      </Pressable>
      {abierta ? (
        <View style={styles.linea}>
          {pasos.map((paso, i) => (
            <FilaEvento key={paso.id} evento={paso} ultimo={i === pasos.length - 1} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function FilaEvento({ evento, suelto, ultimo }: { evento: Evento; suelto?: boolean; ultimo?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const color = COLOR[evento.nivel];
  return (
    <Pressable
      onPress={() => evento.detalle && setAbierto((valor) => !valor)}
      style={[styles.evento, suelto && styles.eventoSuelto]}
    >
      {/* Punto de la línea de tiempo */}
      <View style={styles.marcador}>
        <View style={[styles.punto, { backgroundColor: color }]} />
        {!suelto && !ultimo ? <View style={styles.trazo} /> : null}
      </View>
      <View style={styles.eventoCuerpo}>
        <View style={styles.eventoCabecera}>
          <Ionicons name={ORIGENES[evento.origen].icono} size={12} color={colores.textoSecundario} />
          <Text style={styles.origen}>{ORIGENES[evento.origen].etiqueta}</Text>
          <Text style={styles.meta}>
            {horaExacta(evento.fecha)}
            {evento.duracionMs !== undefined ? ` · ${duracion(evento.duracionMs)}` : ''}
          </Text>
        </View>
        <Text style={[styles.eventoTexto, evento.nivel === 'error' && { color: colores.error }]}>{evento.mensaje}</Text>
        {evento.detalle && (abierto || evento.nivel === 'error') ? (
          <Text style={styles.detalle}>{evento.detalle}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  cadena: {
    gap: espacio.sm,
    marginTop: espacio.sm,
  },
  cadenaFila: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    rowGap: 6,
  },
  paso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pasoTexto: {
    fontSize: 12,
    fontWeight: '600',
  },
  conector: {
    width: 14,
    height: 2,
    borderRadius: 1,
  },
  enCurso: {
    marginLeft: 6,
    color: colores.textoSecundario,
  },
  fallo: {
    flexDirection: 'row',
    gap: espacio.sm,
    borderWidth: 1,
    borderRadius: radio.sm,
    padding: espacio.sm,
    backgroundColor: 'rgba(255,107,107,0.08)',
  },
  falloTitulo: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  falloTexto: {
    fontSize: 13,
    color: colores.texto,
    marginTop: 2,
  },
  detalle: {
    fontSize: 11,
    color: colores.textoSecundario,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  acciones: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
  },
  filtro: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  filtroActivo: {
    backgroundColor: colores.primarioSuave,
  },
  filtroTexto: {
    fontSize: 12,
    fontWeight: '600',
  },
  orden: {
    backgroundColor: colores.tarjetaAlta,
    borderRadius: radio.sm,
    borderLeftWidth: 3,
    padding: espacio.sm + 2,
    gap: espacio.sm,
  },
  ordenCabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
  },
  ordenTexto: {
    fontSize: 14,
    fontWeight: '600',
    color: colores.texto,
  },
  meta: {
    fontSize: 11,
    color: colores.textoTenue,
  },
  linea: {
    paddingLeft: 4,
  },
  evento: {
    flexDirection: 'row',
    gap: espacio.sm,
  },
  eventoSuelto: {
    paddingHorizontal: espacio.sm,
  },
  marcador: {
    width: 10,
    alignItems: 'center',
  },
  punto: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  trazo: {
    flex: 1,
    width: 2,
    backgroundColor: colores.borde,
    marginVertical: 2,
  },
  eventoCabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  origen: {
    fontSize: 11,
    fontWeight: '700',
    color: colores.textoSecundario,
    marginRight: 4,
  },
  eventoCuerpo: {
    flex: 1,
    paddingBottom: espacio.sm,
  },
  eventoTexto: {
    fontSize: 13,
    color: colores.texto,
  },
  respaldo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: espacio.sm,
    padding: espacio.sm,
    borderRadius: radio.sm,
    backgroundColor: colores.primarioSuave,
  },
  respaldoTexto: {
    fontSize: 12,
    fontWeight: '600',
    color: colores.texto,
  },
  verMas: {
    fontSize: 13,
    fontWeight: '600',
    color: colores.primario,
    textAlign: 'center',
  },
});
