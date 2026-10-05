import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// Las contraseñas nunca se guardan: se guarda su hash scrypt con una sal aleatoria.
// scrypt es lento a propósito y usa mucha memoria, para que adivinarlas por fuerza bruta cueste.
// Formato guardado: scrypt$N$r$p$sal$hash (sal y hash en base64).
const N = 16384;
const R = 8;
const P = 1;
const LARGO = 64;

const scryptAsync = promisify(scrypt);

export async function cifrarContrasena(contrasena) {
  const sal = randomBytes(16);
  const hash = await scryptAsync(contrasena.normalize('NFKC'), sal, LARGO, { N, r: R, p: P });
  return ['scrypt', N, R, P, sal.toString('base64'), hash.toString('base64')].join('$');
}

// Hash de relleno: si el usuario no existe se verifica contra este, para que la respuesta
// tarde lo mismo y no revele qué usuarios existen.
const HASH_FALSO = await cifrarContrasena(randomBytes(12).toString('hex'));

export async function verificarContrasena(contrasena, guardado) {
  const [algoritmo, n, r, p, sal, hash] = (guardado ?? HASH_FALSO).split('$');
  if (algoritmo !== 'scrypt') return false;
  const esperado = Buffer.from(hash, 'base64');
  const calculado = await scryptAsync(contrasena.normalize('NFKC'), Buffer.from(sal, 'base64'), esperado.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return guardado !== null && guardado !== undefined && timingSafeEqual(calculado, esperado);
}
