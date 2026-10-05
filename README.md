# Arquitectura_Distribuida-

Examen Parcial 1 de Seguridad Informática (Universidad Politécnica de Pachuca): cliente móvil que obtiene geolocalización y clima, y guarda el registro por comando de voz en la base de datos de la VM Windows Server o de la VM Ubuntu Server.

## Estado del proyecto

| Componente | Estado |
|---|---|
| `client/` | Código base listo; falta probarlo en un teléfono |
| `server-windows/` | Código listo; falta instalarlo en la VM Windows |
| `server-linux/` | Código listo y probado con PostgreSQL; falta instalarlo en la VM Ubuntu |
| `docs/` | Pendiente |

## Arquitectura

```
                      ┌──────────────┐
                      │  Open-Meteo  │  clima (API pública)
                      └──────▲───────┘
                             │
                    ┌────────┴────────┐
                    │  client (Expo)  │  geolocalización + voz
                    └───┬─────────┬───┘
   "servidor uno/windows"│         │"servidor dos/linux"
                        ▼         ▼
          ┌──────────────────┐ ┌──────────────────┐
          │ VM Windows Server│ │ VM Ubuntu Server │
          │ Express :3000    │ │ Express :3000    │
          │ SQL Server       │ │ PostgreSQL       │
          └──────────────────┘ └──────────────────┘
```

Flujo de la aplicación:

1. Obtiene la geolocalización del usuario.
2. Consulta el clima: ciudad, temperatura, humedad y condición.
3. Muestra la información en pantalla junto con fecha y hora.
4. Escucha e interpreta un comando de voz.
5. Envía el registro al servicio web del servidor elegido, que lo guarda en su base de datos.
6. Confirma al usuario en qué servidor se guardó.

## Equipo

| Carpeta | Responsable | Componente |
|---|---|---|
| `client/` | Compañera | App móvil |
| `server-windows/` | Yair | Servidor 1: Windows Server |
| `server-linux/` | Compañero | Servidor 2: Ubuntu Server |

Cada quien trabaja solo en su carpeta para evitar conflictos al hacer push.

## Stack

| Parte | Tecnología |
|---|---|
| App | React Native 0.86 con Expo SDK 57 y TypeScript (development build) |
| Geolocalización y ciudad | `expo-location` |
| Clima | Open-Meteo |
| Reconocimiento de voz | `expo-speech-recognition` (`es-MX`) |
| Confirmación por voz | `expo-speech` |
| Servicio web (ambos servidores) | Node.js + Express |
| BD Servidor 1 | SQL Server Express (`mssql`) |
| BD Servidor 2 | PostgreSQL (`pg`) |

## Estructura

```
client/                 App móvil (React Native + Expo)
  App.tsx               Pantalla principal
  app.json              Configuración de Expo, permisos y plugins
  .env.example          Plantilla de variables de entorno
  src/
    config.ts           URLs de los servidores y API key
    services/
      clima.ts          Geolocalización, ciudad y consulta a Open-Meteo
      comandos.ts       Interpretación del comando de voz
      servidores.ts     Envío del registro al servidor elegido
server-windows/         Servicio web del Servidor 1 (Windows Server + SQL Server)
  src/
    routes/             Endpoints (/api/clima)
    db/                 Conexión y consultas a la BD
    middleware/         API key, validación de datos
  sql/                  Script de creación de BD, tabla y usuario
server-linux/           Servicio web del Servidor 2 (Ubuntu Server + PostgreSQL)
  src/
    routes/
    db/
    middleware/
  sql/
docs/                   Diagrama de arquitectura y reporte PDF
```

## Cliente: instalación y ejecución

### Requisitos

- Node.js 20 o superior y npm.
- Android Studio con el SDK de Android y un JDK 17.
- Variable de entorno `ANDROID_HOME` apuntando al SDK.
- Teléfono Android con la depuración USB activada. En emulador el GPS y el micrófono no son confiables.

La app no funciona en Expo Go, porque el reconocimiento de voz usa código nativo. Hay que compilar un development build.

### Instalación

```bash
git clone <url-del-repo>
cd Arquitectura_Distribuida-/client
npm install
cp .env.example .env
```

Para agregar librerías usa siempre `npx expo install <paquete>` en lugar de `npm install <paquete>`, porque elige la versión compatible con el SDK.

### Configuración

Edita `client/.env` con los datos reales:

```
EXPO_PUBLIC_SERVIDOR_WINDOWS_URL=http://IP_DE_LA_VM_WINDOWS:3000
EXPO_PUBLIC_SERVIDOR_LINUX_URL=http://IP_DE_LA_VM_LINUX:3000
EXPO_PUBLIC_API_KEY=la-misma-clave-que-usan-los-servidores
```

- Las URLs van sin diagonal al final.
- El `.env` no se sube al repo.
- Después de cambiarlo hay que reiniciar el servidor de Expo.

### Ejecución

Primera vez, o cada vez que cambie `app.json` o se agregue una librería nativa:

```bash
npx expo run:android
```

Compila la app, la instala en el teléfono conectado y arranca el servidor de desarrollo.

Las veces siguientes, con la app ya instalada:

```bash
npx expo start
```

### Uso

1. Al abrir la app, acepta el permiso de ubicación. Se muestra el clima actual.
2. Toca "Dar comando de voz" y acepta el permiso del micrófono.
3. Di uno de los comandos de la tabla de abajo.
4. La app confirma en pantalla y por voz en qué servidor se guardó, o explica por qué no pudo.

### Verificación

```bash
npx tsc --noEmit      # revisa los tipos
npx expo-doctor       # revisa dependencias y configuración
```

### Problemas comunes

| Síntoma | Causa probable |
|---|---|
| "No se pudo conectar con…" | El teléfono no alcanza la VM: revisa que ZeroTier esté conectado en el teléfono, la IP del `.env`, que el servicio esté corriendo y el puerto 3000 en el firewall |
| "…La base de datos no está disponible" | El servicio corre pero no entra a la BD: revisa `DB_PASSWORD`, que el SGBD esté encendido y, en Windows, TCP/IP en el puerto 1433 |
| "Falta configurar la URL de…" | No existe el `.env` o no se reinició Expo después de editarlo |
| "…respondió 401" | La API key del `.env` no coincide con la del servidor |
| "No entendí el comando" | La frase debe incluir "guardar" y un solo servidor |
| La app no abre en Expo Go | Es lo esperado; usa `npx expo run:android` |
| `SDK location not found` al compilar | Falta definir `ANDROID_HOME` |

## Servidores: instalación y ejecución

Cada VM corre su propio servicio web (Node.js + Express, puerto `3000`) que recibe los registros de la app y los guarda en su base de datos **local**. La base de datos nunca se expone a la app; solo el servicio web.

| | Servidor uno | Servidor dos |
|---|---|---|
| VM | Windows Server 2022 (`SRV-WIN-UPP`) | Ubuntu Server 24.04 (`SRV-UBUNTU-UPP`) |
| IP ZeroTier | `10.191.84.109` | `10.191.84.219` |
| SGBD | SQL Server Express (`localhost:1433`) | PostgreSQL (`127.0.0.1:5432`) |
| Usuario de BD del servicio | `upp_api` (solo `SELECT` e `INSERT`) | `upp_api` (solo `SELECT` e `INSERT`) |

La **API key** debe ser la misma en `client/.env` (`EXPO_PUBLIC_API_KEY`) y en el `.env` de ambos servidores (`API_KEY`). Se genera una vez con `openssl rand -hex 24` y se comparte por un medio privado, nunca en el repo.

### Servidor dos — Ubuntu Server (`server-linux/`)

Por SSH en la VM Ubuntu:

```bash
# 1. Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git

# 2. Código en /opt/clima-api, con un usuario del sistema sin shell
sudo useradd --system --home /opt/clima-api --shell /usr/sbin/nologin clima-api
sudo git clone <url-del-repo> /tmp/repo
sudo cp -r /tmp/repo/server-linux /opt/clima-api
cd /opt/clima-api && sudo npm ci --omit=dev

# 3. Usuario de BD con permisos mínimos (la tabla UPP.Georreferencia ya existe)
sudo -u postgres psql -d UPP -f sql/02_usuario_api.sql
sudo -u postgres psql -c "\password upp_api"

# 4. Configuración (pon la API key y la contraseña de upp_api)
sudo cp .env.example .env && sudo nano .env
sudo chown -R root:clima-api /opt/clima-api && sudo chmod 640 .env

# 5. Firewall: puerto 3000 solo desde la red del equipo
sudo ufw allow from 10.191.84.0/24 to any port 3000 proto tcp

# 6. Servicio que arranca solo con el servidor
sudo cp deploy/clima-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now clima-api
systemctl status clima-api        # debe decir active (running)
journalctl -u clima-api -f        # ver los registros que llegan
```

### Servidor uno — Windows Server (`server-windows/`)

1. **SQL Server:** en SQL Server Configuration Manager confirma que TCP/IP está habilitado para `SQLEXPRESS` con el puerto fijo `1433` (es el que se abrió en la Actividad 2).
2. **Usuario de BD:** abre `sql/02_usuario_api.sql` en SSMS, reemplaza `<CONTRASEÑA_ROBUSTA>`, ejecútalo y cierra sin guardar.
3. **Node.js:** instala Node.js 22 LTS desde https://nodejs.org.
4. **Código:** copia la carpeta `server-windows` a `C:\clima-api`. Tiene que estar fuera de `C:\Users`, porque el servicio corre con la cuenta *NETWORK SERVICE*, que no puede leer los perfiles de usuario.
5. **Configuración:** en PowerShell, dentro de `C:\clima-api`:
   ```powershell
   npm ci --omit=dev
   copy .env.example .env
   notepad .env      # API key y contraseña de upp_api
   npm start         # prueba manual; Ctrl+C para detener
   ```
6. **Firewall y arranque automático:** en PowerShell **como Administrador**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File deploy\instalar.ps1
   ```
   Crea la regla de firewall `API Clima UPP 3000`, que solo admite tráfico de `10.191.84.0/24`, y una tarea programada que inicia la API al encender el servidor.

### Verificar desde el cliente

Con ZeroTier conectado:

```bash
curl http://10.191.84.109:3000/api/salud   # {"ok":true,"servidor":"windows","baseDeDatos":"conectada"}
curl http://10.191.84.219:3000/api/salud   # {"ok":true,"servidor":"linux","baseDeDatos":"conectada"}
curl -H "x-api-key: TU_CLAVE" http://10.191.84.219:3000/api/clima   # últimos registros
```

## Contrato de los servicios

Ambos servidores exponen lo mismo, para que el cliente solo cambie la URL base.

`POST /api/clima` (header `x-api-key`)

```json
{
  "usuario": "haideni",
  "nombre": "Hai Deni",
  "paterno": "Moctezuma",
  "materno": "Perez",
  "estado": "Hidalgo",
  "municipio": "Pachuca de Soto",
  "latitud": 20.1011,
  "longitud": -98.7591,
  "temperatura": 18.4,
  "humedad": 62,
  "viento": 7.9
}
```

- Obligatorios: `usuario`, `nombre`, `latitud`, `longitud`, `temperatura` y `humedad`. Los campos de más (`ciudad`, `condicion`, `fecha_hora`) se ignoran.
- `FechaHora` la pone la base de datos al insertar.
- Datos del usuario: salen de `EXPO_PUBLIC_USUARIO`, `EXPO_PUBLIC_NOMBRE`, `EXPO_PUBLIC_PATERNO` y `EXPO_PUBLIC_MATERNO` en `client/.env`.

Respuestas:

| Código | Cuándo | Cuerpo |
|---|---|---|
| `201` | Registro guardado | `{ "ok": true, "servidor": "windows" \| "linux", "id": 1, "fechaHora": "…" }` |
| `400` | Datos inválidos | `{ "ok": false, "error": "Datos inválidos.", "errores": ["…"] }` |
| `401` | API key incorrecta | `{ "ok": false, "error": "API key inválida." }` |
| `503` | La BD no responde | `{ "ok": false, "error": "La base de datos no está disponible." }` |

`GET /api/clima?limite=50` (header `x-api-key`) devuelve los últimos registros de ese servidor.

`GET /api/salud` (sin API key) indica si el servicio y su base de datos responden.

## Comandos de voz

| Comando | Destino |
|---|---|
| "Guardar en servidor uno" / "Guardar en Windows" | `server-windows` |
| "Guardar en servidor dos" / "Guardar en Linux" | `server-linux` |

El cliente normaliza el texto (minúsculas, sin acentos), exige la palabra "guardar" y busca `uno`, `1` o `windows` para el Servidor 1, y `dos`, `2` o `linux` para el Servidor 2. Si no coincide, o si se mencionan los dos servidores, pide repetir el comando.

## Red

Las dos VMs están en computadoras distintas y el celular debe alcanzar ambas.

- Red virtual **ZeroTier** `3b19b3a7160c920d` (`10.191.84.0/24`): las dos VMs, la computadora cliente y el **celular** deben estar unidos y autorizados en ZeroTier Central. En Android se usa la app *ZeroTier One*.
- El puerto `3000` se abre en Windows Firewall y en `ufw` solo para `10.191.84.0/24`.
- Android bloquea HTTP sin cifrar; ya está habilitado en `client/app.json` con `usesCleartextTraffic`.

## Seguridad

- API key en el header `x-api-key`; las peticiones sin ella se rechazan con `401`.
- Validación de datos en el servidor y consultas parametrizadas.
- Usuario de BD `upp_api` con permisos mínimos (`INSERT` y `SELECT` sobre la tabla), nunca `sa` ni `postgres`. Si alguien roba la API key puede insertar registros, pero no borrar ni modificar.
- Las peticiones con datos inválidos se rechazan con `400` antes de llegar a la BD.
- En Ubuntu, el servicio corre con un usuario de sistema sin shell y con el endurecimiento de systemd (`NoNewPrivileges`, `ProtectSystem`).
- La BD escucha solo en `localhost`; hacia la red se expone únicamente el servicio web.
- Credenciales y API key en `.env`, que no se sube al repo.
- Limitación conocida: las variables `EXPO_PUBLIC_*` quedan dentro de la app, así que la API key del cliente se puede extraer del APK.

## Entregables

- Video de 6 a 7 minutos con el funcionamiento de la aplicación y la explicación de la arquitectura.
- Reporte en PDF con portada y códigos de desarrollo (en `docs/`).
