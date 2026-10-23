import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Cifrado simétrico de los registros del clima (Actividad 2, Parcial 2 — Ruta A).
// AES-256-GCM: la misma clave secreta cifra y descifra, y la etiqueta de 16 bytes detecta si
// alguien alteró el texto cifrado. La clave (32 bytes en Base64) vive solo en CLAVE_AES del .env;
// quien copie la base de datos no puede leer nada sin ella.
//
// Formato guardado en la columna Cifrado:  aes256gcm$<nonce>$<cifrado + etiqueta>  (Base64)
// Es el mismo orden que usa AESGCM de Python (cryptography), así que practicas-python/descifrar_registro.py
// lo descifra con la misma clave.
const FORMATO = 'aes256gcm';
const BYTES_NONCE = 12;
const BYTES_ETIQUETA = 16;

let clave = null;

/** Lee la clave de CLAVE_AES; lanza un error si no son 32 bytes en Base64. */
export function cargarClave(base64) {
  const bytes = Buffer.from(base64 ?? '', 'base64');
  if (bytes.length !== 32) throw new Error('CLAVE_AES debe ser una clave de 32 bytes (256 bits) en Base64.');
  clave = bytes;
}

/** Cifra un objeto (se pasa a JSON). Cada llamada usa un nonce aleatorio nuevo. */
export function cifrar(datos) {
  const nonce = randomBytes(BYTES_NONCE);
  const cifrador = createCipheriv('aes-256-gcm', clave, nonce);
  const cifrado = Buffer.concat([cifrador.update(JSON.stringify(datos), 'utf8'), cifrador.final(), cifrador.getAuthTag()]);
  return [FORMATO, nonce.toString('base64'), cifrado.toString('base64')].join('$');
}

/** Devuelve el objeto original. Lanza un error si el valor está alterado o se cifró con otra clave. */
export function descifrar(guardado) {
  const [formato, nonce, cifrado] = guardado.split('$');
  if (formato !== FORMATO) throw new Error('Formato de cifrado desconocido');
  const bytes = Buffer.from(cifrado, 'base64');
  const descifrador = createDecipheriv('aes-256-gcm', clave, Buffer.from(nonce, 'base64'));
  descifrador.setAuthTag(bytes.subarray(-BYTES_ETIQUETA));
  const texto = Buffer.concat([descifrador.update(bytes.subarray(0, -BYTES_ETIQUETA)), descifrador.final()]);
  return JSON.parse(texto.toString('utf8'));
}
