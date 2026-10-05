import type { ServidorId } from '../../config';

export type ResultadoComando =
  | { tipo: 'ignorado' } // No se dijo la palabra clave (y no estaba activado)
  | { tipo: 'activado' } // Se dijo la palabra clave, pero todavía sin servidor
  | { tipo: 'guardar'; servidor: ServidorId };

// El reconocedor a veces transcribe "Barbie" de distintas formas.
const PALABRA_CLAVE = /\b(barbie|barbi|barby|barbe|varbie|varbi|bar bie|bar bi)\b/;

const SERVIDOR_UNO = /\b(servidor (uno|1)|windows)\b/;
const SERVIDOR_DOS = /\b(servidor (dos|2)|linux|ubuntu)\b/;

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Interpreta lo que dijo el usuario.
 * - `yaActivado`: true si en una frase anterior ya se dijo "Barbie" y se está
 *   esperando el servidor (p. ej. "Barbie" … "guardar en servidor uno").
 */
export function interpretarComando(texto: string, yaActivado = false): ResultadoComando {
  const frase = normalizar(texto);
  const coincidencia = PALABRA_CLAVE.exec(frase);

  if (!coincidencia && !yaActivado) {
    return { tipo: 'ignorado' };
  }

  // Solo se toma en cuenta lo que se dijo después de la palabra clave.
  const resto = coincidencia ? frase.slice(coincidencia.index + coincidencia[0].length) : frase;

  if (SERVIDOR_UNO.test(resto)) {
    return { tipo: 'guardar', servidor: 'windows' };
  }
  if (SERVIDOR_DOS.test(resto)) {
    return { tipo: 'guardar', servidor: 'linux' };
  }
  return { tipo: 'activado' };
}
