from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag
import os
import base64

# ==========================================
# SEGURIDAD INFORMATICA - UPP
# PRACTICA: CIFRADO SIMETRICO AES-256-GCM
# ==========================================

print("====================================")
print("     ALGORITMO DE CIFRADO AES")
print("====================================")

# PASO 1: Solicitar mensaje original
mensaje = input("\nEscribe el mensaje a cifrar: ")

# PASO 2: Generar clave secreta AES de 256 bits
clave_secreta = AESGCM.generate_key(bit_length=256)

print("\n[OK] Clave AES-256 generada")

# PASO 3: Mostrar clave en Base64
clave_base64 = base64.b64encode(
    clave_secreta
).decode("ascii")

print("\nCLAVE SECRETA AES (Base64):")
print(clave_base64)

# PASO 4: Convertir mensaje a bytes
datos = mensaje.encode("utf-8")

# PASO 5: Generar nonce aleatorio de 12 bytes
nonce = os.urandom(12)

# PASO 6: Crear instancia AES-GCM
aes = AESGCM(clave_secreta)

# PASO 7: Cifrar mensaje
mensaje_cifrado = aes.encrypt(
    nonce,
    datos,
    None
)

# PASO 8: Convertir cifrado a Base64
cifrado_base64 = base64.b64encode(
    mensaje_cifrado
).decode("ascii")

nonce_base64 = base64.b64encode(
    nonce
).decode("ascii")

print("\nMENSAJE ORIGINAL:")
print(mensaje)

print("\nNONCE (Base64):")
print(nonce_base64)

print("\nMENSAJE CIFRADO (Base64):")
print(cifrado_base64)

# PASO 9: Descifrar con la misma clave
try:
    mensaje_descifrado = aes.decrypt(
        nonce,
        mensaje_cifrado,
        None
    )

    # PASO 10: Convertir bytes a texto
    texto_recuperado = mensaje_descifrado.decode("utf-8")

    print("\nMENSAJE DESCIFRADO:")
    print(texto_recuperado)

    # PASO 11: Verificar resultado
    print("\nVERIFICACION:")
    print("Mensaje recuperado correctamente:",
          mensaje == texto_recuperado)

except InvalidTag:
    print("\nERROR: Clave incorrecta o datos alterados")

print("\nFIN DEL PROGRAMA")
