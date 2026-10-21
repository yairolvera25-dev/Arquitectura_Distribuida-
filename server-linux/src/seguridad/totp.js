import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';

import QRCode from 'qrcode';

// Verificación en dos pasos con TOTP (RFC 6238), el algoritmo de Google Authenticator y
// Microsoft Authenticator: código = HMAC-SHA1(secreto, periodos de 30 s desde 1970) recortado
// a 6 dígitos. El teléfono y el servidor comparten el secreto y lo calculan cada uno por su lado.
const PERIODO_S = 30;
const DIGITOS = 6;
// Se acepta el periodo anterior y el siguiente (±30 s) por si el reloj del teléfono no está exacto.
const TOLERANCIA = 1;
// Un código de los últimos 10 minutos se rechaza como "vencido" en vez de "incorrecto".
const VENTANA_VENCIDO = 20;
const EMISOR = 'Clima UPP';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function aBase32(bytes) {
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  return bits.match(/.{1,5}/g).map((grupo) => BASE32[Number.parseInt(grupo.padEnd(5, '0'), 2)]).join('');
}

function deBase32(texto) {
  const bits = [...texto].map((letra) => BASE32.indexOf(letra).toString(2).padStart(5, '0')).join('');
  return Buffer.from(bits.match(/.{8}/g).map((byte) => Number.parseInt(byte, 2)));
}

/** Secreto nuevo: 160 bits aleatorios (lo que recomienda el RFC 4226), en base32 de 32 letras. */
export const generarSecreto = () => aBase32(randomBytes(20));

export const esSecretoValido = (secreto) => typeof secreto === 'string' && /^[A-Z2-7]{32}$/.test(secreto);

function codigoDelPeriodo(secreto, periodo) {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(periodo));
  const hmac = createHmac('sha1', deBase32(secreto)).update(contador).digest();
  // "Truncado dinámico": el último nibble dice de dónde tomar 4 bytes.
  const desde = hmac[hmac.length - 1] & 0x0f;
  return String((hmac.readUInt32BE(desde) & 0x7fffffff) % 10 ** DIGITOS).padStart(DIGITOS, '0');
}

/**
 * `{ estado: 'valido', periodo }` si el código es el de ahora (±30 s), `'vencido'` si fue válido
 * en los últimos minutos, o `'incorrecto'`.
 */
export function verificarCodigo(secreto, codigo, ahora = Date.now()) {
  if (!/^\d{6}$/.test(codigo)) return { estado: 'incorrecto' };
  const actual = Math.floor(ahora / 1000 / PERIODO_S);
  const coincide = (periodo) => timingSafeEqual(Buffer.from(codigoDelPeriodo(secreto, periodo)), Buffer.from(codigo));
  for (let d = -TOLERANCIA; d <= TOLERANCIA; d++) {
    if (coincide(actual + d)) return { estado: 'valido', periodo: actual + d };
  }
  for (let d = TOLERANCIA + 1; d <= Math.min(VENTANA_VENCIDO, actual); d++) {
    if (coincide(actual - d)) return { estado: 'vencido' };
  }
  return { estado: 'incorrecto' };
}

// Último periodo aceptado de cada usuario, para que un código no sirva dos veces aunque siga
// vigente (alguien que lo vio por encima del hombro). Vive en memoria.
const ultimoUsado = new Map();

/** Marca el periodo como usado; false si ese código (o uno más nuevo) ya se había usado. */
export function marcarUsado(usuario, periodo) {
  if (periodo <= (ultimoUsado.get(usuario) ?? -1)) return false;
  ultimoUsado.set(usuario, periodo);
  return true;
}

/** Datos para vincular la app autenticadora: enlace otpauth:// y el mismo enlace como QR (PNG). */
export async function datosParaVincular(usuario, secreto) {
  const etiqueta = `${encodeURIComponent(EMISOR)}:${encodeURIComponent(usuario)}`;
  const parametros = new URLSearchParams({ secret: secreto, issuer: EMISOR, algorithm: 'SHA1', digits: DIGITOS, period: PERIODO_S });
  const enlace = `otpauth://totp/${etiqueta}?${parametros.toString().replace(/\+/g, '%20')}`;
  const qr = await QRCode.toDataURL(enlace, { margin: 1, width: 240, errorCorrectionLevel: 'M' });
  return { secreto, enlace, qr };
}

// El secreto no se puede guardar como hash (el servidor lo necesita para calcular el código), así
// que se guarda cifrado con AES-256-GCM. La clave se deriva de TOKEN_SECRET, que vive solo en el
// .env: quien copie la base de datos no puede generar códigos. Formato: aes256gcm$iv$etiqueta$datos.
const clave = () => Buffer.from(hkdfSync('sha256', process.env.TOKEN_SECRET, 'clima-upp', 'secreto-2fa', 32));

export function cifrarSecreto(secreto) {
  const iv = randomBytes(12);
  const cifrador = createCipheriv('aes-256-gcm', clave(), iv);
  const datos = Buffer.concat([cifrador.update(secreto, 'utf8'), cifrador.final()]);
  return ['aes256gcm', iv, cifrador.getAuthTag(), datos].map((parte) => (Buffer.isBuffer(parte) ? parte.toString('base64') : parte)).join('$');
}

/** Lanza un error si el valor está alterado o se cifró con otro TOKEN_SECRET. */
export function descifrarSecreto(guardado) {
  const [algoritmo, iv, etiqueta, datos] = guardado.split('$');
  if (algoritmo !== 'aes256gcm') throw new Error('Formato de secreto desconocido');
  const descifrador = createDecipheriv('aes-256-gcm', clave(), Buffer.from(iv, 'base64'));
  descifrador.setAuthTag(Buffer.from(etiqueta, 'base64'));
  return Buffer.concat([descifrador.update(Buffer.from(datos, 'base64')), descifrador.final()]).toString('utf8');
}
