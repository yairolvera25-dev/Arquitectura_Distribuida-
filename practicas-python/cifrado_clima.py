"""
SEGURIDAD INFORMATICA - UPP
ACTIVIDAD 2 PARCIAL 2: CRIPTOGRAFIA APLICADA AL ALMACENAMIENTO DISTRIBUIDO

Funciones de cifrado de los registros del clima, con el MISMO formato que usan
los servidores (server-windows/src/seguridad/cifradoAes.js y
server-linux/src/seguridad/cifradoRsa.js). Lo que cifra uno lo descifra el otro.

  Windows (SQL Server)  ->  aes256gcm$<nonce>$<cifrado+etiqueta>
  Linux (PostgreSQL)    ->  rsaoaep+aes256gcm$<clave AES cifrada con RSA>$<nonce>$<cifrado+etiqueta>

Todas las partes van en Base64. Los datos cifrados son un JSON con estado,
municipio, latitud, longitud, temperatura, humedad y viento.
"""

import base64
import json
import os

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

FORMATO_AES = "aes256gcm"
FORMATO_HIBRIDO = "rsaoaep+aes256gcm"

# RSA-OAEP con SHA-256, igual que en rsa_seguridad.py
OAEP = padding.OAEP(
    mgf=padding.MGF1(algorithm=hashes.SHA256()),
    algorithm=hashes.SHA256(),
    label=None,
)


def b64(datos):
    return base64.b64encode(datos).decode("ascii")


def de_b64(texto):
    return base64.b64decode(texto)


def leer_clave_aes(texto_base64):
    """Clave AES-256 en Base64 (CLAVE_AES del .env de Windows) -> 32 bytes."""
    clave = de_b64(texto_base64.strip())
    if len(clave) != 32:
        raise ValueError("La clave AES debe tener 32 bytes (256 bits).")
    return clave


def leer_clave_privada(ruta):
    with open(ruta, "rb") as archivo:
        return serialization.load_pem_private_key(archivo.read(), password=None)


# ----------------------------------------------------------- AES (Windows)

def cifrar_aes(datos, clave):
    nonce = os.urandom(12)
    cifrado = AESGCM(clave).encrypt(nonce, json.dumps(datos).encode("utf-8"), None)
    return "$".join([FORMATO_AES, b64(nonce), b64(cifrado)])


def descifrar_aes(guardado, clave):
    formato, nonce, cifrado = guardado.strip().split("$")
    if formato != FORMATO_AES:
        raise ValueError("No es un registro aes256gcm.")
    texto = AESGCM(clave).decrypt(de_b64(nonce), de_b64(cifrado), None)
    return json.loads(texto.decode("utf-8"))


# ------------------------------------------------------ AES + RSA (Linux)

def cifrar_hibrido(datos, clave_publica):
    # 1. Clave AES nueva solo para este registro
    clave_aes = AESGCM.generate_key(bit_length=256)
    nonce = os.urandom(12)
    # 2. Los datos se cifran con AES (RSA no puede cifrar tanto)
    cifrado = AESGCM(clave_aes).encrypt(nonce, json.dumps(datos).encode("utf-8"), None)
    # 3. La clave AES se cifra con la clave PUBLICA RSA
    clave_cifrada = clave_publica.encrypt(clave_aes, OAEP)
    return "$".join([FORMATO_HIBRIDO, b64(clave_cifrada), b64(nonce), b64(cifrado)])


def descifrar_hibrido(guardado, clave_privada):
    formato, clave_cifrada, nonce, cifrado = guardado.strip().split("$")
    if formato != FORMATO_HIBRIDO:
        raise ValueError("No es un registro rsaoaep+aes256gcm.")
    # 1. La clave PRIVADA RSA recupera la clave AES del registro
    clave_aes = clave_privada.decrypt(de_b64(clave_cifrada), OAEP)
    # 2. Con esa clave AES se descifran los datos
    texto = AESGCM(clave_aes).decrypt(de_b64(nonce), de_b64(cifrado), None)
    return json.loads(texto.decode("utf-8"))
