from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes
import base64

# ==========================================
# SEGURIDAD INFORMATICA - UPP
# PRACTICA: CIFRADO ASIMETRICO RSA
# ==========================================

print("================================")
print("    ALGORITMO DE CIFRADO RSA")
print("================================")

# PASO 1: Mensaje original
mensaje = input("\nEscribe el mensaje a cifrar: ")

# PASO 2: Generar claves RSA
clave_privada = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048
)

clave_publica = clave_privada.public_key()

print("\n[OK] Claves RSA generadas (2048 bits)")

# PASO 3: Convertir mensaje a bytes
datos = mensaje.encode("utf-8")

# PASO 4: Cifrar con clave publica
mensaje_cifrado = clave_publica.encrypt(
    datos,
    padding.OAEP(
        mgf=padding.MGF1(
            algorithm=hashes.SHA256()
        ),
        algorithm=hashes.SHA256(),
        label=None
    )
)

# PASO 5: Convertir cifrado a Base64
mensaje_base64 = base64.b64encode(
    mensaje_cifrado
).decode("ascii")

print("\nMENSAJE ORIGINAL:")
print(mensaje)

print("\nMENSAJE CIFRADO (Base64):")
print(mensaje_base64)

# PASO 6: Descifrar con clave privada
mensaje_descifrado = clave_privada.decrypt(
    mensaje_cifrado,
    padding.OAEP(
        mgf=padding.MGF1(
            algorithm=hashes.SHA256()
        ),
        algorithm=hashes.SHA256(),
        label=None
    )
)

# PASO 7: Recuperar mensaje
texto_recuperado = mensaje_descifrado.decode("utf-8")

print("\nMENSAJE DESCIFRADO:")
print(texto_recuperado)

# PASO 8: Verificar resultado
print("\nVERIFICACION:")
print("Mensaje recuperado correctamente:",
      mensaje == texto_recuperado)

print("\nFIN DEL PROGRAMA")
