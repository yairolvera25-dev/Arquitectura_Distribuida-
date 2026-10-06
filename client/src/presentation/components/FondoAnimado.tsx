import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import type { Pronostico } from '../../data/services/pronostico';
import { NATIVO, useBucle } from './animaciones';

export type Cielo = 'despejado' | 'nublado' | 'niebla' | 'lluvia' | 'tormenta' | 'nieve';

/** Tipo de cielo a partir del código WMO de Open-Meteo. */
export function cieloDe(codigo: number | undefined): Cielo {
  if (codigo === undefined) return 'despejado';
  if (codigo >= 95) return 'tormenta';
  if ((codigo >= 51 && codigo <= 67) || (codigo >= 80 && codigo <= 82)) return 'lluvia';
  if ((codigo >= 71 && codigo <= 77) || codigo === 85 || codigo === 86) return 'nieve';
  if (codigo === 45 || codigo === 48) return 'niebla';
  if (codigo === 2 || codigo === 3) return 'nublado';
  return 'despejado';
}

export function esDeNoche(pronostico: Pronostico | null): boolean {
  if (!pronostico) return false;
  const ahora = Date.now();
  return ahora < pronostico.amanecerMs || ahora > pronostico.atardecerMs;
}

// Paleta de las manchas de fondo según el cielo (siempre en tonos azules, con su acento).
const PALETAS: Record<Cielo | 'noche', [string, string, string]> = {
  despejado: ['#2F7BFF', '#F6C453', '#22D3EE'],
  nublado: ['#3B6FD1', '#6B7FA8', '#2DB7D6'],
  niebla: ['#56708F', '#8193AD', '#3C5A80'],
  lluvia: ['#1F5FBF', '#3A4FA8', '#1BA3C6'],
  tormenta: ['#2A1F7A', '#152E7A', '#5B3FD1'],
  nieve: ['#7FB2FF', '#B8D4FF', '#4C9EFF'],
  noche: ['#1B2F7A', '#4B2FA8', '#0E6E8C'],
};

const DESENFOQUE = Platform.OS === 'web' ? ({ filter: 'blur(70px)' } as object) : {};

type Props = { cielo: Cielo; noche?: boolean };

/** Fondo vivo: aurora de manchas de color que se mueven lento + el efecto del clima actual. */
export function FondoAnimado({ cielo, noche = false }: Props) {
  const paleta = PALETAS[noche && (cielo === 'despejado' || cielo === 'nublado') ? 'noche' : cielo];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Mancha color={paleta[0]} tamano={520} desde={{ x: -0.15, y: -0.1 }} hacia={{ x: 0.1, y: 0.05 }} duracion={14000} />
      <Mancha color={paleta[1]} tamano={420} desde={{ x: 0.7, y: 0.05 }} hacia={{ x: 0.55, y: 0.25 }} duracion={17000} />
      <Mancha color={paleta[2]} tamano={480} desde={{ x: 0.25, y: 0.7 }} hacia={{ x: 0.45, y: 0.55 }} duracion={20000} />
      <View style={[StyleSheet.absoluteFill, styles.velo, cielo === 'tormenta' && styles.veloTormenta]} />
      <EfectoClima cielo={cielo} noche={noche} />
    </View>
  );
}

function Mancha({
  color,
  tamano,
  desde,
  hacia,
  duracion,
}: {
  color: string;
  tamano: number;
  desde: { x: number; y: number };
  hacia: { x: number; y: number };
  duracion: number;
}) {
  const { width, height } = useWindowDimensions();
  const t = useBucle(duracion, { vaiven: true });
  return (
    <Animated.View
      style={[
        styles.mancha,
        DESENFOQUE,
        {
          width: tamano,
          height: tamano,
          borderRadius: tamano / 2,
          backgroundColor: color,
          transform: [
            { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [desde.x * width, hacia.x * width] }) },
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [desde.y * height, hacia.y * height] }) },
            { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) },
          ],
        },
      ]}
    />
  );
}

/**
 * Capa delante de las tarjetas: unas cuantas gotas o copos translúcidos, para que la lluvia
 * se vea "sobre el vidrio" y no solo detrás (donde el desenfoque la borra).
 */
export function PrimerPlanoClima({ cielo }: { cielo: Cielo }) {
  if (cielo === 'despejado') return null;
  if (cielo === 'nublado' || cielo === 'niebla') {
    // Unas nubes tenues cruzando por encima del vidrio.
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Nubes cantidad={cielo === 'niebla' ? 3 : 2} opacidad={cielo === 'niebla' ? 0.16 : 0.13} lentas />
      </View>
    );
  }
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, styles.primerPlano]}>
        {cielo === 'nieve' ? (
          <Nieve cantidad={12} />
        ) : cielo === 'tormenta' ? (
          <Lluvia cantidad={45} rapida viento={0.45} />
        ) : (
          <Lluvia cantidad={16} />
        )}
      </View>
      {cielo === 'tormenta' ? <DestelloFrente /> : null}
    </View>
  );
}

/* ───────────── Efectos del clima ───────────── */

export function EfectoClima({ cielo, noche }: { cielo: Cielo; noche: boolean }) {
  switch (cielo) {
    case 'tormenta':
      return (
        <>
          <Lluvia cantidad={120} rapida viento={0.45} />
          <Relampagos />
        </>
      );
    case 'lluvia':
      return <Lluvia cantidad={60} />;
    case 'nieve':
      return <Nieve cantidad={40} />;
    case 'niebla':
      return <Nubes cantidad={7} opacidad={0.3} />;
    case 'nublado':
      return (
        <>
          {noche ? <Estrellas cantidad={18} /> : null}
          <Nubes cantidad={6} opacidad={noche ? 0.18 : 0.26} />
        </>
      );
    default:
      return noche ? <Estrellas cantidad={40} /> : <Sol />;
  }
}

const azar = (min: number, max: number) => min + Math.random() * (max - min);

function Lluvia({ cantidad, rapida = false, viento = 0.18 }: { cantidad: number; rapida?: boolean; viento?: number }) {
  const gotas = useMemo(
    () =>
      Array.from({ length: cantidad }, (_, i) => ({
        id: i,
        x: Math.random(),
        largo: azar(rapida ? 20 : 14, rapida ? 38 : 28),
        duracion: azar(rapida ? 380 : 650, rapida ? 700 : 1150),
        retraso: azar(0, 1500),
        opacidad: azar(0.4, 0.85),
      })),
    [cantidad, rapida],
  );
  return (
    <>
      {gotas.map((gota) => (
        <Gota key={gota.id} {...gota} viento={viento} />
      ))}
    </>
  );
}

function Gota({
  x,
  largo,
  duracion,
  retraso,
  opacidad,
  viento,
}: {
  x: number;
  largo: number;
  duracion: number;
  retraso: number;
  opacidad: number;
  viento: number;
}) {
  const { width, height } = useWindowDimensions();
  const t = useBucle(duracion, { retraso });
  return (
    <Animated.View
      style={[
        styles.gota,
        {
          height: largo,
          opacity: opacidad,
          // Con más viento las gotas empiezan más a la derecha, caen más inclinadas y se desvían más.
          left: x * (width + height * viento + 120) - 60,
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-60, height + 40] }) },
            { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, -height * viento] }) },
            { rotate: `${(Math.atan(viento) * 180) / Math.PI}deg` },
          ],
        },
      ]}
    />
  );
}

/* Tormenta eléctrica: rayos en zigzag con resplandor y destellos que también iluminan por delante. */

// Avisa a la capa de enfrente cuándo cae un rayo, para que su destello vaya sincronizado.
const oyentesRayo = new Set<(fuerza: number, segmentos: Segmento[]) => void>();

type Segmento = { x: number; y: number; largo: number; angulo: number; grosor: number };

/** Un rayo como lista de segmentos en zigzag (con una rama), desde arriba hasta `fondo`. */
function generarRayo(ancho: number, alto: number): Segmento[] {
  const segmentos: Segmento[] = [];
  const trazo = (x0: number, y0: number, pasos: number, bajada: number, grosor: number, rama: boolean) => {
    let x = x0;
    let y = y0;
    for (let i = 0; i < pasos; i++) {
      const nx = x + azar(-ancho * 0.05, ancho * 0.05);
      const ny = y + bajada * azar(0.7, 1.3);
      const dx = nx - x;
      const dy = ny - y;
      segmentos.push({ x, y, largo: Math.hypot(dx, dy), angulo: (Math.atan2(dy, dx) * 180) / Math.PI - 90, grosor });
      if (rama && i === 2) trazo(nx, ny, 3, bajada * 0.8, grosor * 0.55, false);
      x = nx;
      y = ny;
    }
  };
  trazo(azar(ancho * 0.12, ancho * 0.88), -10, 7, azar(alto * 0.07, alto * 0.1), 3.5, true);
  return segmentos;
}

function Relampagos() {
  const { width, height } = useWindowDimensions();
  const destello = useRef(new Animated.Value(0)).current;
  const rayo = useRef(new Animated.Value(0)).current;
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);

  useEffect(() => {
    let temporizador: ReturnType<typeof setTimeout>;
    const caer = (doble: boolean) => {
      const nuevo = generarRayo(width, height);
      setSegmentos(nuevo);
      oyentesRayo.forEach((oyente) => oyente(doble ? 1 : 0.8, nuevo));
      Animated.parallel([
        // Parpadeo del cielo: fuerte, se apaga, vuelve a encender y se desvanece.
        Animated.sequence([
          Animated.timing(destello, { toValue: 0.75, duration: 50, useNativeDriver: NATIVO }),
          Animated.timing(destello, { toValue: 0.1, duration: 70, useNativeDriver: NATIVO }),
          Animated.timing(destello, { toValue: 0.6, duration: 50, useNativeDriver: NATIVO }),
          Animated.timing(destello, { toValue: 0, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: NATIVO }),
        ]),
        // El rayo aparece de golpe, titila y se apaga un poco después que el cielo.
        Animated.sequence([
          Animated.timing(rayo, { toValue: 1, duration: 40, useNativeDriver: NATIVO }),
          Animated.timing(rayo, { toValue: 0.3, duration: 60, useNativeDriver: NATIVO }),
          Animated.timing(rayo, { toValue: 1, duration: 50, useNativeDriver: NATIVO }),
          Animated.timing(rayo, { toValue: 0, duration: 750, easing: Easing.in(Easing.quad), useNativeDriver: NATIVO }),
        ]),
      ]).start();
    };
    const siguiente = () => {
      caer(false);
      // A veces cae un segundo rayo casi enseguida.
      if (Math.random() < 0.35) setTimeout(() => caer(true), azar(250, 600));
      temporizador = setTimeout(siguiente, azar(2000, 5000));
    };
    temporizador = setTimeout(siguiente, 900);
    return () => clearTimeout(temporizador);
  }, [destello, rayo, width, height]);

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, styles.relampago, { opacity: destello }]} />
      <Rayo segmentos={segmentos} opacidad={rayo} />
    </>
  );
}

function Rayo({ segmentos, opacidad }: { segmentos: Segmento[]; opacidad: Animated.Value | Animated.AnimatedInterpolation<number> }) {
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacidad }]}>
      {segmentos.map((segmento, i) => (
        <View
          key={i}
          style={[
            styles.rayoSegmento,
            {
              left: segmento.x - segmento.grosor / 2,
              top: segmento.y,
              width: segmento.grosor,
              height: segmento.largo,
              transformOrigin: 'top',
              transform: [{ rotate: `${segmento.angulo}deg` }],
            },
          ]}
        />
      ))}
    </Animated.View>
  );
}

/**
 * Por delante de las tarjetas: el mismo rayo (para que no lo borre el desenfoque del vidrio)
 * y un destello más suave que el del fondo, sincronizados con cada caída.
 */
function DestelloFrente() {
  const destello = useRef(new Animated.Value(0)).current;
  const rayo = useRef(new Animated.Value(0)).current;
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  useEffect(() => {
    const oyente = (fuerza: number, nuevos: Segmento[]) => {
      setSegmentos(nuevos);
      Animated.sequence([
        Animated.timing(rayo, { toValue: 0.9, duration: 40, useNativeDriver: NATIVO }),
        Animated.timing(rayo, { toValue: 0.25, duration: 60, useNativeDriver: NATIVO }),
        Animated.timing(rayo, { toValue: 0.85, duration: 50, useNativeDriver: NATIVO }),
        Animated.timing(rayo, { toValue: 0, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: NATIVO }),
      ]).start();
      Animated.sequence([
        Animated.timing(destello, { toValue: 0.32 * fuerza, duration: 50, useNativeDriver: NATIVO }),
        Animated.timing(destello, { toValue: 0.05, duration: 70, useNativeDriver: NATIVO }),
        Animated.timing(destello, { toValue: 0.22 * fuerza, duration: 50, useNativeDriver: NATIVO }),
        Animated.timing(destello, { toValue: 0, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: NATIVO }),
      ]).start();
    };
    oyentesRayo.add(oyente);
    return () => {
      oyentesRayo.delete(oyente);
    };
  }, [destello, rayo]);
  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, styles.relampago, { opacity: destello }]} />
      <Rayo segmentos={segmentos} opacidad={rayo} />
    </>
  );
}

function Nieve({ cantidad }: { cantidad: number }) {
  const copos = useMemo(
    () =>
      Array.from({ length: cantidad }, (_, i) => ({
        id: i,
        x: Math.random(),
        tamano: azar(3, 7),
        duracion: azar(5000, 9000),
        retraso: azar(0, 6000),
      })),
    [cantidad],
  );
  return (
    <>
      {copos.map((copo) => (
        <Copo key={copo.id} {...copo} />
      ))}
    </>
  );
}

function Copo({ x, tamano, duracion, retraso }: { x: number; tamano: number; duracion: number; retraso: number }) {
  const { width, height } = useWindowDimensions();
  const t = useBucle(duracion, { retraso });
  return (
    <Animated.View
      style={[
        styles.copo,
        {
          width: tamano,
          height: tamano,
          borderRadius: tamano / 2,
          left: x * width,
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-20, height + 20] }) },
            {
              translateX: t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 14, 0, -14, 0] }),
            },
          ],
        },
      ]}
    />
  );
}

function Sol() {
  const giro = useBucle(40000);
  const pulso = useBucle(3200, { vaiven: true });
  const RAYOS = 12;
  return (
    <View style={styles.sol}>
      <Animated.View
        style={[
          styles.solHalo,
          DESENFOQUE,
          { transform: [{ scale: pulso.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }] },
        ]}
      />
      <Animated.View
        style={[
          styles.rayos,
          { transform: [{ rotate: giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] },
        ]}
      >
        {Array.from({ length: RAYOS }, (_, i) => (
          <View key={i} style={[styles.rayo, { transform: [{ rotate: `${(360 / RAYOS) * i}deg` }, { translateY: -150 }] }]} />
        ))}
      </Animated.View>
      <Animated.View
        style={[styles.solNucleo, { transform: [{ scale: pulso.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] }) }] }]}
      />
    </View>
  );
}

function Nubes({ cantidad, opacidad, lentas = false }: { cantidad: number; opacidad: number; lentas?: boolean }) {
  const nubes = useMemo(
    () =>
      Array.from({ length: cantidad }, (_, i) => ({
        id: i,
        y: azar(-0.05, 0.75),
        escala: azar(0.8, 1.7),
        duracion: azar(lentas ? 70000 : 40000, lentas ? 110000 : 70000),
        // Repartidas a lo ancho desde el inicio: no hay que esperar a que entren por la izquierda.
        inicio: (i + Math.random() * 0.6) / cantidad,
        opacidad: opacidad * azar(0.7, 1.15),
      })),
    [cantidad, opacidad, lentas],
  );
  return (
    <>
      {nubes.map((nube) => (
        <Nube key={nube.id} {...nube} />
      ))}
    </>
  );
}

/** Bucle de 0 a 1 que empieza en `inicio` (para que cada nube arranque a media pantalla). */
function useBucleDesde(duracion: number, inicio: number) {
  const valor = useRef(new Animated.Value(inicio)).current;
  useEffect(() => {
    let detenido = false;
    const vuelta = () => {
      if (detenido) return;
      valor.setValue(0);
      Animated.timing(valor, { toValue: 1, duration: duracion, easing: Easing.linear, useNativeDriver: NATIVO }).start(
        ({ finished }) => finished && vuelta(),
      );
    };
    Animated.timing(valor, {
      toValue: 1,
      duration: duracion * (1 - inicio),
      easing: Easing.linear,
      useNativeDriver: NATIVO,
    }).start(({ finished }) => finished && vuelta());
    return () => {
      detenido = true;
      valor.stopAnimation();
    };
  }, [valor, duracion, inicio]);
  return valor;
}

function Nube({ y, escala, duracion, inicio, opacidad }: { y: number; escala: number; duracion: number; inicio: number; opacidad: number }) {
  const { width, height } = useWindowDimensions();
  const t = useBucleDesde(duracion, inicio);
  const mece = useBucle(azarFijo(y) * 3000 + 5000, { vaiven: true });
  return (
    <Animated.View
      style={[
        styles.nube,
        // La opacidad va en el contenedor y las piezas son opacas: así la nube se ve pareja,
        // sin manchas donde se enciman los círculos.
        { top: y * height, opacity: opacidad },
        Platform.OS === 'web' ? ({ filter: 'blur(10px)' } as object) : null,
        {
          transform: [
            { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-420 * escala, width + 60] }) },
            { translateY: mece.interpolate({ inputRange: [0, 1], outputRange: [-8, 8] }) },
            { scale: escala },
          ],
        },
      ]}
    >
      <View style={styles.nubeBase} />
      <View style={[styles.nubeBola, { width: 140, height: 140, left: 50, top: -70 }]} />
      <View style={[styles.nubeBola, { width: 110, height: 110, left: 150, top: -45 }]} />
      <View style={[styles.nubeBola, { width: 90, height: 90, left: 0, top: -30 }]} />
    </Animated.View>
  );
}

const azarFijo = (semilla: number) => Math.abs(Math.sin(semilla * 9301 + 49297)) % 1;

function Estrellas({ cantidad }: { cantidad: number }) {
  const estrellas = useMemo(
    () =>
      Array.from({ length: cantidad }, (_, i) => ({
        id: i,
        x: Math.random(),
        y: Math.random() * 0.7,
        tamano: azar(1.5, 3),
        duracion: azar(1500, 4000),
        retraso: azar(0, 3000),
      })),
    [cantidad],
  );
  return (
    <>
      {estrellas.map((estrella) => (
        <Estrella key={estrella.id} {...estrella} />
      ))}
    </>
  );
}

function Estrella({ x, y, tamano, duracion, retraso }: { x: number; y: number; tamano: number; duracion: number; retraso: number }) {
  const { width, height } = useWindowDimensions();
  const t = useBucle(duracion, { vaiven: true, retraso });
  return (
    <Animated.View
      style={[
        styles.estrella,
        {
          left: x * width,
          top: y * height,
          width: tamano,
          height: tamano,
          borderRadius: tamano,
          opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.9] }),
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  mancha: {
    position: 'absolute',
    opacity: Platform.OS === 'web' ? 0.55 : 0.22,
  },
  primerPlano: {
    opacity: 0.35,
  },
  veloTormenta: {
    backgroundColor: 'rgba(3,4,12,0.55)',
  },
  velo: {
    backgroundColor: 'rgba(5,8,14,0.35)',
  },
  gota: {
    position: 'absolute',
    top: 0,
    width: 2,
    borderRadius: 1,
    backgroundColor: '#C4E2FF',
    boxShadow: '0 0 6px rgba(160,210,255,0.6)',
  },
  relampago: {
    backgroundColor: '#DCE8FF',
  },
  rayoSegmento: {
    position: 'absolute',
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    boxShadow: '0 0 8px #E4ECFF, 0 0 22px #9C8BFF, 0 0 46px #6A5CFF',
  },
  copo: {
    position: 'absolute',
    top: 0,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  sol: {
    position: 'absolute',
    top: -110,
    right: -110,
    width: 420,
    height: 420,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solHalo: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(246,196,83,0.35)',
  },
  rayos: {
    position: 'absolute',
    width: 420,
    height: 420,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rayo: {
    position: 'absolute',
    width: 6,
    height: 90,
    borderRadius: 3,
    backgroundColor: 'rgba(255,214,110,0.22)',
  },
  solNucleo: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,207,90,0.55)',
    boxShadow: '0 0 80px 30px rgba(255,200,80,0.35)',
  },
  nube: {
    position: 'absolute',
    left: 0,
    width: 280,
    height: 80,
  },
  nubeBase: {
    position: 'absolute',
    bottom: 0,
    width: 280,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F1FF',
  },
  nubeBola: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#E8F1FF',
  },
  estrella: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
});
