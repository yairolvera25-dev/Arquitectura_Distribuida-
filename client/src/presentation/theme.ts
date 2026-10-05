import { Platform, type ViewStyle } from 'react-native';

export const colores = {
  fondo: '#070A10',
  // Vidrio (glassmorfismo): superficies translúcidas sobre el fondo animado.
  marco: 'rgba(12,16,24,0.35)',
  tarjeta: 'rgba(22,28,40,0.55)',
  tarjetaAlta: 'rgba(255,255,255,0.06)',
  borde: 'rgba(255,255,255,0.10)',
  brillo: 'rgba(255,255,255,0.18)',
  texto: '#EEF2F7',
  textoSecundario: '#8B95A5',
  textoTenue: '#5B6475',
  primario: '#4C9EFF',
  primarioSuave: 'rgba(76,158,255,0.14)',
  primarioOscuro: '#1F5FBF',
  sol: '#F6C453',
  exito: '#3DD68C',
  error: '#FF6B6B',
};

export const espacio = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

/** Estilo de vidrio esmerilado. En web desenfoca lo que hay detrás; en el celular es translúcido. */
export const vidrio: ViewStyle = {
  backgroundColor: colores.tarjeta,
  borderWidth: 1,
  borderColor: colores.borde,
  borderTopColor: colores.brillo,
  boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
  ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(22px) saturate(160%)' } as ViewStyle) : {}),
};

export const radio = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
};
