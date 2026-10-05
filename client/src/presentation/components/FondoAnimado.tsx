import { useEffect, useMemo, useRef } from 'react';
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
  return ahora < new Date(pronostico.amanecer).getTime() || ahora > new Date(pronostico.atardecer).getTime();
}

// Paleta de las manchas de fondo según el cielo (siempre en tonos azules, con su acento).
const PALETAS: Record<Cielo | 'noche', [string, string, string]> = {
  despejado: ['#2F7BFF', '#F6C453', '#22D3EE'],
  nublado: ['#3B6FD1', '#6B7FA8', '#2DB7D6'],
  niebla: ['#56708F', '#8193AD', '#3C5A80'],
  lluvia: ['#1F5FBF', '#3A4FA8', '#1BA3C6'],
  tormenta: ['#3D2FA8', '#1F4FBF', '#7C5CFF'],
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
      <View style={[StyleSheet.absoluteFill, styles.velo]} />
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
  if (cielo !== 'lluvia' && cielo !== 'tormenta' && cielo !== 'nieve') return null;
  return (
    <View style={[StyleSheet.absoluteFill, styles.primerPlano]} pointerEvents="none">
      {cielo === 'nieve' ? <Nieve cantidad={12} /> : <Lluvia cantidad={cielo === 'tormenta' ? 24 : 16} rapida={cielo === 'tormenta'} />}
    </View>
  );
}

/* ───────────── Efectos del clima ───────────── */

export function EfectoClima({ cielo, noche }: { cielo: Cielo; noche: boolean }) {
  switch (cielo) {
    case 'tormenta':
      return (
        <>
          <Lluvia cantidad={70} rapida />
          <Relampagos />
        </>
      );
    case 'lluvia':
      return <Lluvia cantidad={60} />;
    case 'nieve':
      return <Nieve cantidad={40} />;
    case 'niebla':
      return <Nubes cantidad={5} opacidad={0.09} />;
    case 'nublado':
      return (
        <>
          {noche ? <Estrellas cantidad={18} /> : null}
          <Nubes cantidad={4} opacidad={0.07} />
        </>
      );
    default:
      return noche ? <Estrellas cantidad={40} /> : <Sol />;
  }
}

const azar = (min: number, max: number) => min + Math.random() * (max - min);

function Lluvia({ cantidad, rapida = false }: { cantidad: number; rapida?: boolean }) {
  const gotas = useMemo(
    () =>
      Array.from({ length: cantidad }, (_, i) => ({
        id: i,
        x: Math.random(),
        largo: azar(14, 28),
        duracion: azar(rapida ? 450 : 650, rapida ? 800 : 1150),
        retraso: azar(0, 1500),
        opacidad: azar(0.4, 0.85),
      })),
    [cantidad, rapida],
  );
  return (
    <>
      {gotas.map((gota) => (
        <Gota key={gota.id} {...gota} />
      ))}
    </>
  );
}

function Gota({ x, largo, duracion, retraso, opacidad }: { x: number; largo: number; duracion: number; retraso: number; opacidad: number }) {
  const { width, height } = useWindowDimensions();
  const t = useBucle(duracion, { retraso });
  return (
    <Animated.View
      style={[
        styles.gota,
        {
          height: largo,
          opacity: opacidad,
          left: x * (width + 120) - 60,
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-60, height + 40] }) },
            { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, -height * 0.18] }) },
            { rotate: '10deg' },
          ],
        },
      ]}
    />
  );
}

function Relampagos() {
  const destello = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let temporizador: ReturnType<typeof setTimeout>;
    const disparar = () => {
      Animated.sequence([
        Animated.timing(destello, { toValue: 0.55, duration: 60, useNativeDriver: NATIVO }),
        Animated.timing(destello, { toValue: 0.05, duration: 90, useNativeDriver: NATIVO }),
        Animated.timing(destello, { toValue: 0.35, duration: 50, useNativeDriver: NATIVO }),
        Animated.timing(destello, { toValue: 0, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: NATIVO }),
      ]).start();
      temporizador = setTimeout(disparar, azar(3500, 9000));
    };
    temporizador = setTimeout(disparar, 1500);
    return () => clearTimeout(temporizador);
  }, [destello]);
  return <Animated.View style={[StyleSheet.absoluteFill, styles.relampago, { opacity: destello }]} />;
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

function Nubes({ cantidad, opacidad }: { cantidad: number; opacidad: number }) {
  const nubes = useMemo(
    () =>
      Array.from({ length: cantidad }, (_, i) => ({
        id: i,
        y: azar(0.02, 0.6),
        escala: azar(0.7, 1.5),
        duracion: azar(45000, 80000),
        retraso: azar(0, 20000),
      })),
    [cantidad],
  );
  return (
    <>
      {nubes.map((nube) => (
        <Nube key={nube.id} {...nube} opacidad={opacidad} />
      ))}
    </>
  );
}

function Nube({ y, escala, duracion, retraso, opacidad }: { y: number; escala: number; duracion: number; retraso: number; opacidad: number }) {
  const { width, height } = useWindowDimensions();
  const t = useBucle(duracion, { retraso });
  const color = `rgba(255,255,255,${opacidad})`;
  return (
    <Animated.View
      style={[
        styles.nube,
        {
          top: y * height,
          transform: [
            { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-320, width + 40] }) },
            { scale: escala },
          ],
        },
      ]}
    >
      <View style={[styles.nubeBase, { backgroundColor: color }]} />
      <View style={[styles.nubeBola, { width: 110, height: 110, left: 40, top: -50, backgroundColor: color }]} />
      <View style={[styles.nubeBola, { width: 80, height: 80, left: 120, top: -30, backgroundColor: color }]} />
    </Animated.View>
  );
}

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
    width: 240,
    height: 70,
  },
  nubeBase: {
    position: 'absolute',
    bottom: 0,
    width: 240,
    height: 70,
    borderRadius: 35,
  },
  nubeBola: {
    position: 'absolute',
    borderRadius: 999,
  },
  estrella: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
});
