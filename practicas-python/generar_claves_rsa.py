from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
import os
import sys

# ==========================================
# SEGURIDAD INFORMATICA - UPP
# ACTIVIDAD 2 PARCIAL 2: PAR DE CLAVES RSA DEL SERVIDOR LINUX
# ==========================================
# Genera claves/privada.pem y claves/publica.pem. El instalador del servidor
# Linux (deploy/instalar.sh) ya genera las suyas con openssl; este programa es
# la alternativa en Python. La privada NO se comparte ni se sube al repo.

print("====================================")
print("   PAR DE CLAVES RSA (2048 BITS)")
print("====================================")

carpeta = sys.argv[1] if len(sys.argv) > 1 else "claves"
ruta_privada = os.path.join(carpeta, "privada.pem")
ruta_publica = os.path.join(carpeta, "publica.pem")

# Nunca se sobrescribe: con otra clave los registros ya cifrados no se pueden leer.
if os.path.exists(ruta_privada):
    print(f"\nYa existe {ruta_privada}; no la reemplazo.")
    sys.exit(1)

# PASO 1: Generar la clave privada (igual que en rsa_seguridad.py)
clave_privada = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048
)

# PASO 2: Sacar la clave publica de la privada
clave_publica = clave_privada.public_key()

# PASO 3: Guardar ambas en formato PEM
os.makedirs(carpeta, exist_ok=True)
descriptor = os.open(ruta_privada, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(descriptor, "wb") as archivo:
    archivo.write(clave_privada.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    ))

with open(ruta_publica, "wb") as archivo:
    archivo.write(clave_publica.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ))

print(f"\n[OK] Clave privada: {ruta_privada}  (solo lectura para ti)")
print(f"[OK] Clave publica: {ruta_publica}")
print("\nPara usarla en el servidor Linux copia privada.pem a /opt/clima-api/claves/")
print("y vuelve a correr: sudo bash deploy/instalar.sh")
