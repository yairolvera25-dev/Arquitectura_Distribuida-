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
4. Escucha a la asistente Barbie, que con Gemini entiende órdenes y preguntas en lenguaje natural.
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
| Inteligencia de Barbie | Gemini (`gemini-3.8-flash`, API REST `generateContent`) |
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
      comandos.ts       Palabra clave "Barbie" y comando de voz sin Gemini
      gemini.ts         Barbie con Gemini: conversación y herramientas (guardar, consultar)
      servidores.ts     Guardar y consultar registros en cada servidor
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
docs/                   Documentación y reporte PDF
  pasos-cliente.md      Pasos para conectar la app con los dos servidores
  probar-servidores.sh  Diagnóstico: ¿están listos los servidores?
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
EXPO_PUBLIC_GEMINI_API_KEY=clave-de-https://aistudio.google.com/apikey
```

- Las URLs van sin diagonal al final.
- Sin `EXPO_PUBLIC_GEMINI_API_KEY` la app funciona igual, pero Barbie solo entiende "guardar en servidor uno/dos".
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
| "La API key de Gemini no es válida" / "Gemini rechazó la API key" | Revisa `EXPO_PUBLIC_GEMINI_API_KEY` y reinicia Expo |
| "Gemini no tiene el modelo…" | Google retiró ese modelo: cambia `EXPO_PUBLIC_GEMINI_MODELO` por uno de https://ai.google.dev/gemini-api/docs/models |
| "Se acabó la cuota gratis de Gemini" | Límite por minuto del plan gratuito; espera un poco. Mientras, "Barbie, guarda en el servidor uno" sigue funcionando |
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

Por SSH en la VM Ubuntu. El instalador hace todos los pasos y se puede repetir
sin romper nada: respeta el `.env` que ya exista y vuelve a dejar el servicio
arrancado.

```bash
sudo apt install -y git
git clone <url-del-repo> ~/repo
cd ~/repo/server-linux
sudo bash deploy/instalar.sh
```

Pide dos cosas por teclado y nada más:

- La **API key**, que tiene que ser la misma de `EXPO_PUBLIC_API_KEY` en `client/.env`.
- Una **contraseña nueva para `upp_api`**, el usuario de PostgreSQL del servicio.

Al terminar imprime la respuesta de `/api/salud`. Si dice
`"baseDeDatos":"conectada"`, ya quedó. Para rehacer la configuración desde cero:
`sudo bash deploy/instalar.sh --reconfigurar`.

<details>
<summary>Qué hace, paso por paso (por si hay que hacerlo a mano)</summary>

1. **Zona horaria.** Si la VM está en UTC la pasa a `America/Mexico_City`.
   `FechaHora` se llena con `CURRENT_TIMESTAMP`, o sea el reloj del servidor, así
   que en UTC los registros se guardan 6 horas adelantados.
2. **Node.js 22** desde NodeSource (el `nodejs` de Ubuntu 24.04 es la versión 18).
3. **Usuario `clima-api`**, de sistema, sin shell y sin contraseña.
4. **Código a `/opt/clima-api`** y `npm ci --omit=dev`.
5. **Rol `upp_api`** con `sql/02_usuario_api.sql` (solo `SELECT` e `INSERT` sobre
   `Georreferencia`) y le asigna la contraseña con `ALTER ROLE`.
   No uses `psql -c "\password upp_api"`: con `-c` el comando no es interactivo y
   nunca llega a pedir la contraseña. A mano es `sudo -u postgres psql -d UPP` y
   dentro `\password upp_api`.
6. **`.env`** con la API key y la contraseña, en modo `640` y de `root:clima-api`.
   **La contraseña va entre comillas dobles.** Sin comillas, `dotenv` corta el
   valor en el primer `#` y la API intenta entrar con un trozo: falla con
   `password authentication failed` aunque el archivo se vea perfecto.
7. **Servicio `clima-api`** de systemd, habilitado para arrancar con la VM.
8. **Regla de firewall** para el puerto 3000 desde `10.191.84.0/24`.

</details>

> **El firewall está desactivado.** `ufw` está instalado pero en `ENABLED=no`, así
> que la regla del puerto 3000 se guarda pero no se aplica: ahora mismo el 3000 y
> el 5432 están abiertos a cualquiera que alcance la VM. Si lo vas a activar, abre
> **antes** el SSH o te quedas fuera del servidor, porque la política por omisión
> es `DROP`:
>
> ```bash
> sudo ufw allow 22/tcp                                  # SSH, primero que nada
> sudo ufw allow 9993/udp                                # ZeroTier (si no, va por relay)
> sudo ufw allow from 10.191.84.0/24 to any port 3000 proto tcp
> sudo ufw enable
> ```

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

Lo más rápido es el diagnóstico, que revisa ZeroTier, los dos servicios y si la
API key sirve en ambos:

```bash
bash docs/probar-servidores.sh
```

Los pasos para conectar la app están en [`docs/pasos-cliente.md`](docs/pasos-cliente.md).

A mano, con ZeroTier conectado:

```bash
curl http://10.191.84.109:3000/api/salud   # {"ok":true,"servidor":"windows","baseDeDatos":"conectada"}
curl http://10.191.84.219:3000/api/salud   # {"ok":true,"servidor":"linux","baseDeDatos":"conectada"}
curl -H "x-api-key: TU_CLAVE" http://10.191.84.219:3000/api/clima   # últimos registros
```

## Contrato de los servicios

Ambos servidores exponen lo mismo, para que el cliente solo cambie la URL base. Todas las rutas, salvo `/api/salud`, llevan el header `x-api-key`.

### Cuentas (`/api/auth`)

Las cuentas viven en **los dos servidores** (tabla `Usuarios`), así que se puede entrar aunque uno esté apagado. La app crea la cuenta en ambos. Si uno no respondía, se la copia la próxima vez que se inicia sesión con él encendido.

| Ruta | Cuerpo | Respuesta |
|---|---|---|
| `POST /api/auth/registro` | `{ "usuario", "nombre", "paterno"?, "materno"?, "contrasena", "codigoRecuperacion"? }` | `201 { "usuario", "codigoRecuperacion" }` · `400` datos inválidos · `409` el usuario ya existe |
| `POST /api/auth/login` | `{ "usuario", "contrasena" }` | `200 { "token", "usuario": {…} }` · `401` usuario o contraseña incorrectos · `429` demasiados intentos |
| `POST /api/auth/restablecer` | `{ "usuario", "codigo", "contrasena" }` | `200` contraseña cambiada · `400` contraseña inválida · `401` usuario o código incorrectos · `429` demasiados intentos |
| `GET /api/auth/yo` | — (con `Authorization`) | `200 { "usuario": {…} }` |

- `usuario`: de 3 a 30 caracteres `a-z 0-9 . _ -`; se guarda en minúsculas.
- `contrasena`: de 8 a 72 caracteres, con al menos una letra y un número. Se guarda como **hash scrypt** con sal aleatoria, nunca en texto.
- El token es un JWT HS256 que dura 12 horas, firmado con `TOKEN_SECRET`. **Ese secreto es el mismo en los dos servidores**, así que la sesión de uno sirve en el otro.
- Si el usuario no existe o la contraseña está mal, el mensaje es el mismo, para no revelar qué usuarios existen. Tras **5 intentos fallidos** desde la misma IP, ese usuario se bloquea 15 minutos.
- **Restablecer la contraseña:** al registrarse, el primer servidor genera un **código de recuperación** de 12 caracteres (p. ej. `K7QF-M2XP-9TRW`), que la app le pasa al segundo para que sea el mismo en ambos. Se devuelve en texto **una sola vez** para que la persona lo guarde, y se almacena con hash scrypt. Con usuario + código se pone una contraseña nueva en los dos servidores. Tiene el mismo límite de intentos que el login. `upp_api` solo puede hacer `UPDATE` de la columna `Contrasena`.

### Registros del clima (`/api/clima`), con sesión iniciada

Además de `x-api-key`, llevan el header `Authorization: Bearer <token>`. Sin él, o con el token vencido, responden `401` con `"codigo": "SESION"`.

`POST /api/clima`

```json
{
  "estado": "Hidalgo",
  "municipio": "Pachuca de Soto",
  "latitud": 20.1011,
  "longitud": -98.7591,
  "temperatura": 18.4,
  "humedad": 62,
  "viento": 7.9
}
```

- **Quién guarda** (`Usuario`, `Nombre`, `Paterno`, `Materno`) lo pone el servidor a partir del token; lo que mande la app en esos campos se ignora. Así nadie puede guardar a nombre de otro.
- Los datos del clima son opcionales, para poder guardar uno solo ("Barbie, guarda solo la temperatura"). `latitud` y `longitud` van juntas o ninguna. `FechaHora` la pone la base de datos.

`GET /api/clima?limite=50&usuario=haideni&lugar=pachuca&desde=2026-10-01&hasta=2026-10-05`: todos los filtros son opcionales. `lugar` busca en municipio o estado, y las fechas son `AAAA-MM-DD`, incluidas. Responde `{ "ok": true, "servidor": "linux", "total": 12, "registros": [ … ] }`, donde `total` cuenta los que cumplen los filtros.

| Código | Cuándo |
|---|---|
| `201` | Registro guardado: `{ "ok": true, "servidor", "id", "fechaHora" }` |
| `400` | Datos o filtros inválidos: `{ "ok": false, "error", "errores": [ … ] }` |
| `401` | API key incorrecta, o sin sesión (`"codigo": "SESION"`) |
| `503` | La BD no responde |

### Respaldo de la bitácora (`/api/bitacora`), con sesión iniciada

La app puede respaldar sus logs (cada orden a Barbie, sus pasos y sus errores) en uno o en los dos servidores, desde el botón de la nube del *Registro de actividad* o pidiéndoselo a Barbie. Solo manda los eventos que ese servidor todavía no tiene.

- `POST /api/bitacora` con `{ "eventos": [ { "fecha": <ms>, "nivel": "info|exito|aviso|error", "origen", "mensaje", "detalle"?, "orden"? } ] }` (de 1 a 200) → `201 { "guardados": n }`. Quedan a nombre de quien tiene la sesión.
- `GET /api/bitacora?limite=50&usuario=…` → `{ "total", "eventos": [ … ] }`.

`GET /api/salud` (sin API key) indica si el servicio y su base de datos responden.

### Actualizar los servidores para el inicio de sesión y el respaldo de logs

Una sola persona genera el secreto de las sesiones y se lo pasa a la otra **por privado**:

```bash
openssl rand -hex 32
```

**Servidor dos (Ubuntu):** el instalador crea las tablas `Usuarios` y `Bitacora` y pide `TOKEN_SECRET` si falta en el `.env`.

```bash
cd <repo>/server-linux
git pull
sudo bash deploy/instalar.sh
```

**Servidor uno (Windows):**

1. En SSMS, conectado como administrador, ejecuta `server-windows\sql\03_usuarios.sql` y después `server-windows\sql\04_bitacora.sql`.
2. En PowerShell como Administrador, dentro de `server-windows`:
   ```powershell
   git pull
   npm ci --omit=dev
   notepad .env      # agrega la línea TOKEN_SECRET=… (la misma que en el servidor dos)
   powershell -ExecutionPolicy Bypass -File deploy\instalar.ps1
   ```

`instalar.ps1` no arranca si falta `TOKEN_SECRET`. Sin esa línea, el servicio tampoco inicia.

## Comandos de voz

Todo empieza con la palabra clave **"Barbie"**. Lo que se dice después depende de si hay `EXPO_PUBLIC_GEMINI_API_KEY`.

### Con Gemini

La app espera a que termines la frase (o 1.5 s de silencio) y se la pasa a Gemini junto con la fecha, la hora, el clima actual y el pronóstico. Gemini contesta en voz alta y, cuando hace falta, usa dos herramientas que ejecuta la app: `guardar_clima` y `consultar_registros`.

| Lo que se dice | Qué hace |
|---|---|
| "Barbie, guarda en el servidor uno" | guarda el registro completo en `windows` |
| "Barbie, guarda solo la temperatura en el dos" | guarda una fila con la temperatura; lo demás queda en `NULL` |
| "Barbie, guarda la hora en los dos servidores" | una fila en cada servidor con quién guardó y la fecha y hora |
| "Barbie, ¿qué guardé en el servidor dos?" | lee los últimos registros y el total, y los resume |
| "Barbie, ¿y en el uno?" | recuerda las últimas 6 preguntas |
| "Barbie, ¿va a llover mañana?" / "¿qué hora es?" | contesta con el pronóstico o el reloj del teléfono |
| "Barbie, cuéntame un chiste" | platica de cualquier cosa |
| "Barbie, guarda el clima" | pregunta en qué servidor; se contesta sin repetir "Barbie" |

Si Gemini no responde (sin internet, sin cuota, clave mala), solo se acepta la orden directa "Barbie, guarda en el servidor uno/dos", que guarda el registro completo. Una pregunta como "¿qué hay en el servidor uno?" nunca se toma como guardado.

### Sin Gemini

| Comando | Destino |
|---|---|
| "Guardar en servidor uno" / "Guardar en Windows" | `server-windows` |
| "Guardar en servidor dos" / "Guardar en Linux" | `server-linux` |

El cliente normaliza el texto (minúsculas, sin acentos) y **exige la palabra clave "Barbie"**, no la palabra "guardar". El reconocedor la transcribe de varias formas, así que también valen `barbi`, `barby`, `barbe`, `varbie`, `varbi`, `bar bie` y `bar bi`.

Solo se mira lo que se dijo **después** de la palabra clave, y ahí busca `uno`, `1` o `windows` para el Servidor 1, y `dos`, `2` o `linux` para el Servidor 2.

| Lo que se dice | Resultado |
|---|---|
| "Barbie guardar en servidor uno" | guarda en `windows` |
| "Barbie servidor dos" | guarda en `linux` |
| "barbi guárdame esto en linux" | guarda en `linux` (la palabra "guardar" no hace falta) |
| "guardar en servidor uno" | **ignorado**: falta la palabra clave |
| "Barbie" | queda activado, esperando el servidor |

Si ya se dijo "Barbie" en una frase anterior (`yaActivado`), basta con decir el servidor: "servidor uno" o "en linux".

Si se mencionan los dos servidores en la misma frase, **no pide repetir**: se queda con el primero que encuentra, que es el Servidor 1.

## Red

Las dos VMs están en computadoras distintas y el celular debe alcanzar ambas.

- Red virtual **ZeroTier** `3b19b3a7160c920d` (`10.191.84.0/24`): las dos VMs, la computadora cliente y el **celular** deben estar unidos y autorizados en ZeroTier Central. En Android se usa la app *ZeroTier One*.
- El puerto `3000` se abre en Windows Firewall solo para `10.191.84.0/24`. En Ubuntu la regla de `ufw` está creada **pero `ufw` está desactivado**, así que todavía no se aplica (ver la advertencia en la sección del Servidor dos).
- Android bloquea HTTP sin cifrar; ya está habilitado en `client/app.json` con `usesCleartextTraffic`.

## Seguridad

- API key en el header `x-api-key`; las peticiones sin ella se rechazan con `401`.
- Validación de datos en el servidor y consultas parametrizadas.
- **Inicio de sesión** obligatorio para guardar y consultar: contraseñas con hash scrypt y sal, tokens JWT firmados que vencen a las 12 horas, mensaje de error único para usuario inexistente o contraseña incorrecta, y bloqueo de 15 minutos tras 5 intentos fallidos.
- Quién guarda cada registro sale del token, no del cuerpo de la petición: no se puede guardar a nombre de otro.
- Usuario de BD `upp_api` con permisos mínimos (`INSERT` y `SELECT` sobre `Georreferencia`, `Usuarios` y `Bitacora`, más `UPDATE` solo de la columna `Usuarios.Contrasena` para restablecerla), nunca `sa` ni `postgres`. No puede borrar ni modificar registros, logs ni ningún otro dato de las cuentas.
- Las peticiones con datos inválidos se rechazan con `400` antes de llegar a la BD.
- En Ubuntu, el servicio corre con un usuario de sistema sin shell y con el endurecimiento de systemd (`NoNewPrivileges`, `ProtectSystem`).
- **Pendiente:** hoy las dos bases de datos **sí** están expuestas a la red ZeroTier. Comprobado: PostgreSQL escucha en `0.0.0.0:5432` con `ufw` desactivado, y el `1433` de SQL Server acepta conexiones desde la red del equipo (regla heredada de la Actividad 2). Las dos deben quedar solo para `localhost` o para la red interna de cada VM antes de entregar.
- Credenciales, API key y `TOKEN_SECRET` en `.env`, que no se sube al repo. `TOKEN_SECRET` vive solo en los servidores, nunca en la app.
- Pendiente para el Parcial 2: verificación en dos pasos (2FA) sobre este inicio de sesión.
- Limitación conocida: las variables `EXPO_PUBLIC_*` quedan dentro de la app, así que la API key del cliente se puede extraer del APK.

## Entregables

- Video de 6 a 7 minutos con el funcionamiento de la aplicación y la explicación de la arquitectura.
- Reporte en PDF con portada y códigos de desarrollo (en `docs/`).
