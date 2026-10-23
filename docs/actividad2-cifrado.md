# Actividad 2, Parcial 2: criptografía aplicada al almacenamiento distribuido

Ruta elegida: **Ruta A, criptografía tradicional con AES y RSA**.

Los datos del clima de cada registro son estado, municipio, latitud, longitud, temperatura, humedad y viento. El servicio web los cifra **antes** del `INSERT` y los descifra al consultarlos. En la base de datos solo queda el texto cifrado.

| Servidor | Base de datos | Algoritmo | Código |
|---|---|---|---|
| Uno, Windows Server | SQL Server Express | AES-256-GCM (simétrico) | `server-windows/src/seguridad/cifradoAes.js` |
| Dos, Ubuntu Server | PostgreSQL | Híbrido: RSA-OAEP 2048 + AES-256-GCM | `server-linux/src/seguridad/cifradoRsa.js` |

Para los dos servidores se usa la biblioteca `node:crypto` de Node.js, que es el equivalente de `System.Security.Cryptography` en el lenguaje de los servidores. Las herramientas de `practicas-python/` usan la biblioteca `cryptography` de Python con el **mismo formato**. Lo que cifra un servidor lo descifra Python, y al revés; se comprobó en los dos sentidos.

## Qué queda guardado

```
Columna Cifrado (Windows):  aes256gcm$<nonce>$<cifrado + etiqueta>
Columna Cifrado (Linux):    rsaoaep+aes256gcm$<clave AES cifrada con RSA>$<nonce>$<cifrado + etiqueta>
```

- Todas las partes van en Base64.
- El contenido cifrado es un JSON con los siete datos del clima.
- Las columnas en texto (`Estado`, `Municipio`, `Latitud`, `Temperatura`…) quedan en `NULL` en los registros nuevos.
- `Usuario`, `Nombre`, `Paterno`, `Materno` y `FechaHora` siguen en claro, para poder filtrar por ellos en SQL.
- Los registros guardados **antes** de esta actividad siguen en texto plano: no se migraron. La API los devuelve igual, con `"protegido": false`.

## Flujo

```
 App ── POST /api/clima (JSON en claro, HTTP + API key + sesión) ──▶ Servicio web
                                                                   │
        Windows: JSON ──AES-256-GCM(CLAVE_AES, nonce nuevo)──▶ Cifrado ──▶ SQL Server
        Linux:   JSON ──AES-256-GCM(clave nueva, nonce)──────▶ Cifrado ─┐
                 clave nueva ──RSA-OAEP(clave PÚBLICA)───────▶ clave ───┴─▶ PostgreSQL

 App ◀── GET /api/clima (JSON en claro) ── Servicio web ◀── descifra (CLAVE_AES / clave PRIVADA)
```

## Manejo de claves (requisito 6)

| Elemento | Dónde vive | Para qué sirve | ¿Es secreto? |
|---|---|---|---|
| **Clave secreta AES** (Windows) | `CLAVE_AES` en `server-windows/.env`: 32 bytes aleatorios en Base64 | Cifra y descifra todos los registros del servidor uno: es la misma clave para las dos cosas | **Sí.** Nunca va en la BD, la app, el repo ni las capturas |
| **Nonce** (los dos servidores) | Junto al cifrado, en la misma columna | 12 bytes aleatorios nuevos en cada registro. Hace que el mismo dato cifrado dos veces dé resultados distintos | No es secreto, pero **nunca debe repetirse** con la misma clave. Por eso se genera al azar cada vez |
| **Etiqueta GCM** | Al final del cifrado (16 bytes) | Detecta cualquier alteración del cifrado o del nonce. Si no coincide, no se descifra nada | No |
| **Clave pública RSA** (Linux) | Se saca de la privada; también queda en `/opt/clima-api/claves/publica.pem` | Cifra la clave AES de cada registro | No; se puede compartir |
| **Clave privada RSA** (Linux) | `/opt/clima-api/claves/privada.pem` (`RSA_CLAVE_PRIVADA` en el `.env`), permisos `640 root:clima-api` y carpeta `750` | Recupera la clave AES de cada registro para descifrarlo | **Sí.** No sale de la VM salvo como respaldo |
| **Clave AES de cada registro** (Linux) | Solo cifrada con RSA, dentro de la columna | Cifra los datos de ese registro: es nueva y aleatoria en cada uno | Sí; nunca se guarda en claro |

¿Por qué el servidor Linux usa cifrado híbrido y no RSA directo? RSA de 2048 bits con OAEP-SHA256 cifra como máximo 190 bytes, y el JSON de un registro ronda los 150 a 200. Además, RSA es lento. Por eso los datos se cifran con AES y RSA solo protege la clave AES, que es de 32 bytes.

**Si se pierde o se cambia** `CLAVE_AES` o `privada.pem`, los registros cifrados ya no se pueden leer. Ninguno de los dos instaladores reemplaza una clave que ya existe. Hay que guardar un respaldo fuera de la VM, en un lugar seguro y **nunca en el repo**: `.gitignore` excluye `.env`, `claves/` y `*.pem`.

## Instalación

### Servidor uno (Windows)

1. Ejecuta `git pull` en la carpeta del repo. No hay dependencias nuevas.
2. En SSMS, conectado como administrador, ejecuta `server-windows\sql\06_cifrado.sql`. Agrega la columna `Cifrado`.
3. Genera la clave **una sola vez**, con cualquiera de estas dos opciones:
   - En tu laptop: `cd practicas-python`, luego `source .venv/bin/activate.fish` y luego `python generar_clave_aes.py`.
   - En la VM: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
4. Abre el archivo con `notepad server-windows\.env`, agrega la línea `CLAVE_AES=...` y guarda una copia de la clave en un lugar seguro.
5. Reinicia la API. En PowerShell como Administrador, dentro de `server-windows`:
   ```powershell
   Stop-ScheduledTask -TaskName 'API Clima UPP'
   powershell -ExecutionPolicy Bypass -File deploy\instalar.ps1
   ```
   `instalar.ps1` no sigue si falta `CLAVE_AES`, y el servicio tampoco arranca sin ella.

### Servidor dos (Ubuntu)

```bash
cd <repo>/server-linux
git pull
sudo bash deploy/instalar.sh
```

El instalador hace todo esto:

- Agrega la columna `"Cifrado"`.
- Si todavía no existe, genera el par de claves RSA de 2048 bits con `openssl`.
- Agrega `RSA_CLAVE_PRIVADA` al `.env`.
- Reinicia el servicio. En el log debe aparecer `Clave RSA de 2048 bits cargada.`

Alternativa en Python: `python practicas-python/generar_claves_rsa.py`. Luego se copia `claves/privada.pem` a `/opt/clima-api/claves/` **antes** de correr el instalador.

## Pruebas obligatorias (Ruta A)

| Prueba | Cómo hacerla | Resultado esperado |
|---|---|---|
| **1. Captura de datos climáticos** | Abre la app (`npx expo start --web`) e inicia sesión | El dashboard muestra la ubicación, la temperatura, la humedad, la condición, la fecha y la hora |
| **2. Cifrado AES** | "Barbie, guarda el clima en el servidor uno" | `201`, con el `id` del registro |
| **3. Cifrado RSA o híbrido** | "Barbie, guarda el clima en el servidor dos" | `201`, con el `id` del registro |
| **4. Consulta directa a las BD** | Las dos consultas que siguen esta tabla | `Municipio` y `Temperatura` en `NULL`; `Cifrado` ilegible |
| **5. Descifrado** | "Barbie, muéstrame mis registros del servidor uno" (y del dos) o `descifrar_registro.py`, más abajo | Los valores originales, con `"protegido": true` |
| **6. Windows y Linux** | Las pruebas 2 a 5 en los dos servidores | Los dos funcionan |

Consultas directas para la prueba 4:

```sql
-- Windows, en SSMS:
SELECT TOP 5 Id, Usuario, Municipio, Temperatura, Cifrado FROM dbo.Georreferencia ORDER BY Id DESC;
```

```bash
# Ubuntu:
sudo -u postgres psql -d UPP -c 'SELECT "Id", "Usuario", "Municipio", "Temperatura", left("Cifrado", 70) AS "Cifrado" FROM "Georreferencia" ORDER BY "Id" DESC LIMIT 5;'
```

### Descifrar a mano lo que salió de la consulta (prueba 5)

Copia el valor de la columna `Cifrado` y pégalo cuando el programa lo pida.

```fish
# En la laptop, con un valor de Windows (pide la clave AES sin mostrarla):
cd practicas-python; source .venv/bin/activate.fish
python descifrar_registro.py
```

```bash
# En la VM Ubuntu, con un valor de Linux (la clave privada no sale de la VM):
sudo apt install python3-cryptography
cd <repo>/practicas-python
sudo python3 descifrar_registro.py /opt/clima-api/claves/privada.pem
```

### Demostración sin las VMs

`python demo_cifrado_clima.py` hace en la laptop el mismo proceso que los dos servidores, con claves de prueba nuevas:

1. Cifra un registro del clima como lo hace Windows y como lo hace Linux.
2. Lo descifra y verifica que sea igual al original.
3. Altera un carácter del cifrado y muestra que se detecta.
4. Intenta descifrar con otra clave privada RSA y muestra que no funciona.

Sirve para el vídeo y para explicar el proceso frente al grupo.

### Extra: alteración en la base de datos real

Solo con un registro de prueba, y conectado como administrador (`upp_api` no tiene `UPDATE`):

```sql
UPDATE dbo.Georreferencia SET Cifrado = STUFF(Cifrado, 30, 1, 'A') WHERE Id = <id de prueba>;
```

Al consultarlo, la API lo devuelve con `"alterado": true` y sin datos, porque la etiqueta GCM no coincide.

## Limitaciones

- La clave vive en el mismo servidor que los datos. El cifrado protege contra quien lea la base de datos: un respaldo filtrado, una consulta directa o el puerto 1433 o 5432 expuesto. **No** protege contra quien tome el control de la VM completa, porque podría leer el `.env` o el `.pem`.
- No hay rotación de claves: cambiar una clave obliga a descifrar y volver a cifrar todos los registros.
- Como `Municipio` y `Estado` van cifrados, la base de datos ya no puede buscar en ellos. El filtro `lugar` descifra en el servicio los registros que pasan los demás filtros y busca ahí.
- Los datos viajan sin cifrar entre la app y el servidor (HTTP dentro de ZeroTier). ZeroTier cifra el túnel, pero el servicio no usa HTTPS.
- Los registros anteriores a esta actividad siguen en texto plano.
