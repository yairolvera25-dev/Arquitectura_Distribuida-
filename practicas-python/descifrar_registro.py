from cryptography.exceptions import InvalidTag
import getpass
import os
import sys

from cifrado_clima import (
    FORMATO_AES,
    FORMATO_HIBRIDO,
    descifrar_aes,
    descifrar_hibrido,
    leer_clave_aes,
    leer_clave_privada,
)

# ==========================================
# SEGURIDAD INFORMATICA - UPP
# ACTIVIDAD 2 PARCIAL 2: DESCIFRAR UN REGISTRO DE LA BASE DE DATOS
# ==========================================
# Uso: copia el valor de la columna Cifrado de una consulta directa
# (SSMS en Windows o psql en Ubuntu) y pegalo cuando lo pida.
#
#   aes256gcm$...           -> pide la CLAVE_AES (o la lee de la variable CLAVE_AES)
#   rsaoaep+aes256gcm$...   -> usa la clave privada RSA (por defecto claves/privada.pem,
#                              o la ruta que pases:  python descifrar_registro.py ruta/privada.pem)

print("====================================")
print("   DESCIFRAR REGISTRO DEL CLIMA")
print("====================================")

# PASO 1: Valor cifrado tal como esta en la base de datos
guardado = input("\nPega el valor de la columna Cifrado: ").strip()
formato = guardado.split("$")[0]

try:
    # PASO 2: Elegir el algoritmo segun el formato
    if formato == FORMATO_AES:
        print("\nAlgoritmo: AES-256-GCM (servidor Windows / SQL Server)")
        clave_texto = os.environ.get("CLAVE_AES") or getpass.getpass("Clave AES (Base64, no se muestra): ")
        datos = descifrar_aes(guardado, leer_clave_aes(clave_texto))
    elif formato == FORMATO_HIBRIDO:
        print("\nAlgoritmo: RSA-OAEP + AES-256-GCM (servidor Linux / PostgreSQL)")
        ruta = sys.argv[1] if len(sys.argv) > 1 else os.path.join("claves", "privada.pem")
        print("Clave privada:", ruta)
        datos = descifrar_hibrido(guardado, leer_clave_privada(ruta))
    else:
        print("\nERROR: no reconozco el formato (debe empezar con aes256gcm$ o rsaoaep+aes256gcm$).")
        sys.exit(1)

    # PASO 3: Mostrar los valores originales
    print("\nREGISTRO DESCIFRADO:")
    for campo, valor in datos.items():
        print(f"  {campo:<12} {valor}")

except InvalidTag:
    print("\nERROR: Clave incorrecta o datos alterados (la etiqueta GCM no coincide)")
except ValueError as error:
    # RSA con otra clave privada, Base64 roto o partes faltantes
    print(f"\nERROR: {error}")

print("\nFIN DEL PROGRAMA")
