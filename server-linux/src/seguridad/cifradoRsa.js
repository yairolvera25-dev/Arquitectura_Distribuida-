import {
  constants,
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
} from 'node:crypto';
import { readFileSync } from 'node:fs';

// Cifrado híbrido AES + RSA de los registros del clima (Actividad 2, Parcial 2 — Ruta A).
// RSA solo puede cifrar unos cuantos bytes (con 2048 bits y OAEP-SHA256, máximo 190), así que
// cada registro se cifra con una clave AES-256 nueva y aleatoria, y lo que se cifra con la
// CLAVE PÚBLICA RSA es esa clave AES. Para leer el registro hace falta la CLAVE PRIVADA,
// que vive en un archivo PEM fuera del repo (RSA_CLAVE_PRIVADA en el .env).
//
// Formato guardado en la columna Cifrado (Base64):
//   rsaoaep+aes256gcm$<clave AES cifrada con RSA>$<nonce>$<cifrado + etiqueta>
// RSA-OAEP con SHA-256 (también en MGF1) y AES-GCM, igual que los programas de
// practicas-python/, así que descifrar_registro.py lo descifra con la misma clave privada.
const FORMATO = 'rsaoaep+aes256gcm';
const BYTES_NONCE = 12;
const BYTES_ETIQUETA = 16;
const OAEP = { padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' };

let claves = null;

/** Lee la clave privada (PEM) y de ella saca la pública. Devuelve el tamaño en bits. */
export function cargarClaves(ruta) {
  const privada = createPrivateKey(readFileSync(ruta));
  if (privada.asymmetricKeyType !== 'rsa') throw new Error(`${ruta} no es una clave RSA.`);
  const bits = privada.asymmetricKeyDetails.modulusLength;
  if (bits < 2048) throw new Error(`La clave RSA es de ${bits} bits; el mínimo es 2048.`);
  claves = { privada, publica: createPublicKey(privada) };
  return bits;
}

/** Cifra un objeto (se pasa a JSON) con una clave AES nueva, protegida con la clave pública. */
export function cifrar(datos) {
  const claveAes = randomBytes(32);
  const nonce = randomBytes(BYTES_NONCE);
  const cifrador = createCipheriv('aes-256-gcm', claveAes, nonce);
  const cifrado = Buffer.concat([cifrador.update(JSON.stringify(datos), 'utf8'), cifrador.final(), cifrador.getAuthTag()]);
  const claveCifrada = publicEncrypt({ key: claves.publica, ...OAEP }, claveAes);
  return [FORMATO, ...[claveCifrada, nonce, cifrado].map((parte) => parte.toString('base64'))].join('$');
}

/** Devuelve el objeto original. Lanza un error si el valor está alterado o se cifró con otra clave. */
export function descifrar(guardado) {
  const [formato, claveCifrada, nonce, cifrado] = guardado.split('$');
  if (formato !== FORMATO) throw new Error('Formato de cifrado desconocido');
  const claveAes = privateDecrypt({ key: claves.privada, ...OAEP }, Buffer.from(claveCifrada, 'base64'));
  const bytes = Buffer.from(cifrado, 'base64');
  const descifrador = createDecipheriv('aes-256-gcm', claveAes, Buffer.from(nonce, 'base64'));
  descifrador.setAuthTag(bytes.subarray(-BYTES_ETIQUETA));
  const texto = Buffer.concat([descifrador.update(bytes.subarray(0, -BYTES_ETIQUETA)), descifrador.final()]);
  return JSON.parse(texto.toString('utf8'));
}
