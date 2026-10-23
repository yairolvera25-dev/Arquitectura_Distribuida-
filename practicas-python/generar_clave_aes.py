from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import base64

# ==========================================
# SEGURIDAD INFORMATICA - UPP
# ACTIVIDAD 2 PARCIAL 2: CLAVE AES DEL SERVIDOR WINDOWS
# ==========================================
# Genera la clave secreta que cifra los registros del clima en SQL Server.
# Se genera UNA sola vez: si se cambia, los registros ya cifrados no se
# pueden volver a leer. No la pongas en el repo, la app ni en capturas.

print("====================================")
print("   CLAVE AES-256 DEL SERVIDOR UNO")
print("====================================")

# PASO 1: Generar clave secreta AES de 256 bits (32 bytes aleatorios)
clave_secreta = AESGCM.generate_key(bit_length=256)

# PASO 2: Convertir a Base64 para poder escribirla en el .env
clave_base64 = base64.b64encode(clave_secreta).decode("ascii")

print("\nAgrega esta linea al archivo server-windows/.env de la VM Windows:\n")
print("CLAVE_AES=" + clave_base64)
print("\nGuardala tambien en un lugar seguro: sin ella no se pueden descifrar los registros.")
