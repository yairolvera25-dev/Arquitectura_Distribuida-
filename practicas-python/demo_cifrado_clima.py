from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import json

from cifrado_clima import (
    cifrar_aes,
    cifrar_hibrido,
    descifrar_aes,
    descifrar_hibrido,
)

# ==========================================
# SEGURIDAD INFORMATICA - UPP
# ACTIVIDAD 2 PARCIAL 2: DEMOSTRACION RUTA A (AES Y RSA)
# ==========================================
# Hace en la computadora lo mismo que los servidores con un registro del clima:
# lo cifra como el servidor Windows (AES) y como el servidor Linux (AES + RSA),
# lo descifra y comprueba que una alteracion se detecta. Usa claves de prueba
# nuevas en cada ejecucion; no toca las claves reales de los servidores.

print("=============================================")
print("  CIFRADO DE UN REGISTRO DEL CLIMA (RUTA A)")
print("=============================================")

# PASO 1: Registro del clima (Enter = valor de ejemplo)
def pedir(texto, ejemplo, convertir=str):
    valor = input(f"{texto} [{ejemplo}]: ").strip()
    return convertir(valor) if valor else ejemplo

print("\nDatos del registro:")
registro = {
    "estado": pedir("  Estado", "Hidalgo"),
    "municipio": pedir("  Municipio", "Pachuca de Soto"),
    "latitud": pedir("  Latitud", 20.1011, float),
    "longitud": pedir("  Longitud", -98.7591, float),
    "temperatura": pedir("  Temperatura (C)", 18.4, float),
    "humedad": pedir("  Humedad (%)", 62.0, float),
    "viento": pedir("  Viento (km/h)", 7.9, float),
}

print("\nREGISTRO ORIGINAL:")
print(json.dumps(registro, ensure_ascii=False))

# PASO 2: Claves de prueba
clave_aes = AESGCM.generate_key(bit_length=256)
clave_privada = rsa.generate_private_key(public_exponent=65537, key_size=2048)
clave_publica = clave_privada.public_key()
print("\n[OK] Clave AES-256 y par de claves RSA 2048 de prueba generados")

# PASO 3: Servidor Windows -> AES-256-GCM con la clave secreta
cifrado_windows = cifrar_aes(registro, clave_aes)
print("\nSERVIDOR WINDOWS (SQL Server) guarda en la columna Cifrado:")
print(cifrado_windows)

# PASO 4: Servidor Linux -> AES con clave nueva + esa clave cifrada con la publica RSA
cifrado_linux = cifrar_hibrido(registro, clave_publica)
print("\nSERVIDOR LINUX (PostgreSQL) guarda en la columna Cifrado:")
print(cifrado_linux)

# PASO 5: Descifrar
recuperado_windows = descifrar_aes(cifrado_windows, clave_aes)
recuperado_linux = descifrar_hibrido(cifrado_linux, clave_privada)

print("\nDESCIFRADO WINDOWS (clave secreta AES):")
print(json.dumps(recuperado_windows, ensure_ascii=False))
print("\nDESCIFRADO LINUX (clave privada RSA -> clave AES -> datos):")
print(json.dumps(recuperado_linux, ensure_ascii=False))

# PASO 6: Verificar
print("\nVERIFICACION:")
print("Windows recupera el original:", recuperado_windows == registro)
print("Linux recupera el original:  ", recuperado_linux == registro)

# PASO 7: Alterar un caracter del cifrado y comprobar que se detecta
formato, nonce, datos = cifrado_windows.split("$")
datos = ("A" if datos[0] != "A" else "B") + datos[1:]
alterado = "$".join([formato, nonce, datos])
print("\nPRUEBA DE ALTERACION (se cambio un caracter del cifrado):")
try:
    descifrar_aes(alterado, clave_aes)
    print("No se detecto la alteracion")
except InvalidTag:
    print("Alteracion detectada: la etiqueta GCM no coincide")

# PASO 8: Otra clave privada no sirve
otra_privada = rsa.generate_private_key(public_exponent=65537, key_size=2048)
print("\nPRUEBA CON OTRA CLAVE PRIVADA RSA:")
try:
    descifrar_hibrido(cifrado_linux, otra_privada)
    print("Se pudo descifrar con otra clave")
except ValueError:
    print("No se puede descifrar: solo la clave privada correcta recupera la clave AES")

print("\nFIN DEL PROGRAMA")
