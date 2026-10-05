export type ServidorId = 'windows' | 'linux';

export type Servidor = {
  id: ServidorId;
  nombre: string;
  url: string;
};

export const SERVIDORES: Record<ServidorId, Servidor> = {
  windows: {
    id: 'windows',
    nombre: 'Servidor uno (Windows Server)',
    url: process.env.EXPO_PUBLIC_SERVIDOR_WINDOWS_URL ?? '',
  },
  linux: {
    id: 'linux',
    nombre: 'Servidor dos (Linux Ubuntu Server)',
    url: process.env.EXPO_PUBLIC_SERVIDOR_LINUX_URL ?? '',
  },
};

export const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? '';

// Gemini, la inteligencia de Barbie. Sin API key, Barbie solo entiende "guardar en servidor uno/dos".
export const GEMINI = {
  apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '',
  // Cadena de modelos: primero el principal y, si falla (sin cuota, saturado, no existe o muy lento),
  // los respaldos en orden. Cada modelo gratis tiene su propia cuota (~20 peticiones al día).
  modelos: [
    ...new Set(
      [
        process.env.EXPO_PUBLIC_GEMINI_MODELO || 'gemini-3.8-flash',
        ...(
          process.env.EXPO_PUBLIC_GEMINI_MODELO_RESPALDO ??
          'gemini-3.5-flash,gemini-2.5-flash,gemini-2.5-flash-lite,gemini-3-flash-preview'
        ).split(','),
      ]
        .map((modelo) => modelo.trim())
        .filter(Boolean),
    ),
  ],
};

