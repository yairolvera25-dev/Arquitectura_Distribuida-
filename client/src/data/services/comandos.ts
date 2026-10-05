import type { ServidorId } from '../../config';

export type ResultadoComando =
  | { tipo: 'ignorado' } // No se dijo la palabra clave (y no estaba activado)
  | { tipo: 'activado' } // Se dijo la palabra clave, pero todavía sin servidor
  | { tipo: 'guardar'; servidor: ServidorId };

// El reconocedor a veces transcribe "Barbie" de distintas formas.
const PALABRA_CLAVE = /\b(barbie|barbi|barby|barbe|varbie|varbi|bar bie|bar bi)\b/;

const SERVIDOR_UNO = /\b(servidor (uno|1)|windows)\b/;
const SERVIDOR_DOS = /\b(servidor (dos|2)|linux|ubuntu)\b/;

// Sin Gemini (sin internet o sin cuota) solo vale la orden directa de guardar todo,
// "Barbie, guarda en el servidor uno", para que una pregunta como
// "¿qué hay en el servidor uno?" nunca se tome como un guardado.
const ORDEN_GUARDAR = /^(guarda|guardar|guardalo|guardame|salva)\b/;
const SOLO_UNA_PARTE = /\b(solo|solamente|unicamente|nada mas)\b/;

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
 * Lo que se dijo después de la palabra clave (normalizado), o null si la frase no es para la app.
 * - `yaActivado`: true si en una frase anterior ya se dijo "Barbie"; entonces cuenta la frase entera.
 */
export function despuesDeLaPalabraClave(texto: string, yaActivado = false): string | null {
  const frase = normalizar(texto);
  const coincidencia = PALABRA_CLAVE.exec(frase);

  if (!coincidencia && !yaActivado) {
    return null;
  }
  // Solo se toma en cuenta lo que se dijo después de la palabra clave.
  return coincidencia ? frase.slice(coincidencia.index + coincidencia[0].length).trim() : frase;
}

/**
 * Interpreta lo que dijo el usuario (modo sin Gemini).
 * - `yaActivado`: true si en una frase anterior ya se dijo "Barbie" y se está
 *   esperando el servidor (p. ej. "Barbie" … "guardar en servidor uno").
 */
export function interpretarComando(texto: string, yaActivado = false): ResultadoComando {
  const resto = despuesDeLaPalabraClave(texto, yaActivado);

  if (resto === null) {
    return { tipo: 'ignorado' };
  }
  if (SERVIDOR_UNO.test(resto)) {
    return { tipo: 'guardar', servidor: 'windows' };
  }
  if (SERVIDOR_DOS.test(resto)) {
    return { tipo: 'guardar', servidor: 'linux' };
  }
  return { tipo: 'activado' };
}

/** Servidor de una orden directa de guardar ("Barbie, guarda en el servidor uno"), o null. */
export function ordenDeGuardar(texto: string): ServidorId | null {
  const resto = despuesDeLaPalabraClave(texto, true) ?? '';
  if (!ORDEN_GUARDAR.test(resto) || SOLO_UNA_PARTE.test(resto)) {
    return null;
  }
  const uno = SERVIDOR_UNO.test(resto);
  const dos = SERVIDOR_DOS.test(resto);
  if (uno === dos) return null; // Ninguno o los dos
  return uno ? 'windows' : 'linux';
}
