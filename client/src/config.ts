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

// Datos de quien guarda los registros (campos Usuario, Nombre, Paterno y Materno de Georreferencia).
export const USUARIO = {
  usuario: process.env.EXPO_PUBLIC_USUARIO ?? '',
  nombre: process.env.EXPO_PUBLIC_NOMBRE ?? '',
  paterno: process.env.EXPO_PUBLIC_PATERNO ?? '',
  materno: process.env.EXPO_PUBLIC_MATERNO ?? '',
};
