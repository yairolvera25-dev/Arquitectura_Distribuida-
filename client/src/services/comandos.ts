import type { ServidorId } from '../config';

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// "Guardar en servidor uno / Windows" o "Guardar en servidor dos / Linux"
export function interpretarComando(texto: string): ServidorId | null {
  const comando = normalizar(texto);
  if (!/\bguarda/.test(comando)) return null;

  const esWindows = /\b(uno|1|windows)\b/.test(comando);
  const esLinux = /\b(dos|2|linux)\b/.test(comando);
  if (esWindows === esLinux) return null;
  return esWindows ? 'windows' : 'linux';
}
