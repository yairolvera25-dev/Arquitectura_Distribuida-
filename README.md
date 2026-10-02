# Arquitectura_Distribuida-

Examen Parcial 1 de Seguridad Informática (Universidad Politécnica de Pachuca): cliente móvil que obtiene geolocalización y clima, y guarda el registro por comando de voz en la base de datos de la VM Windows Server o de la VM Ubuntu Server.

## Estado del proyecto

| Componente | Estado |
|---|---|
| `client/` | Código base listo; falta probarlo en un teléfono |
| `server-windows/` | Pendiente (solo carpetas) |
| `server-linux/` | Pendiente (solo carpetas) |
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
| "No se pudo conectar con…" | El teléfono no alcanza la VM: revisa la IP del `.env`, que estén en la misma red o en Tailscale, y el puerto 3000 en el firewall |
| "Falta configurar la URL de…" | No existe el `.env` o no se reinició Expo después de editarlo |
| "…respondió 401" | La API key del `.env` no coincide con la del servidor |
| "No entendí el comando" | La frase debe incluir "guardar" y un solo servidor |
| La app no abre en Expo Go | Es lo esperado; usa `npx expo run:android` |
| `SDK location not found` al compilar | Falta definir `ANDROID_HOME` |

## Servidores: instalación y ejecución

Pendiente. Esta sección se completa cuando exista el código de `server-windows/` y `server-linux/`. El plan es:

1. Instalar Node.js y el motor de base de datos en la VM.
2. Ejecutar el script de `sql/` para crear la base, la tabla y el usuario con permisos mínimos.
3. Copiar `.env.example` a `.env` con las credenciales de la BD y la API key.
4. `npm install` y `npm start`.
5. Abrir el puerto 3000 en el firewall.

## Contrato de los servicios

Ambos servidores exponen lo mismo, para que el cliente solo cambie la URL base.

`POST /api/clima` (header `x-api-key`)

```json
{
  "ciudad": "Pachuca",
  "temperatura": 18.4,
  "humedad": 62,
  "condicion": "Nublado",
  "fecha_hora": "2026-10-02T18:49:00.000Z",
  "latitud": 20.1011,
  "longitud": -98.7591
}
```

`fecha_hora` va en formato ISO 8601 en UTC.

Respuesta: `201 { "ok": true, "servidor": "windows" | "linux", "id": 1 }`

`GET /api/clima` devuelve los registros guardados en ese servidor.

## Comandos de voz

| Comando | Destino |
|---|---|
| "Guardar en servidor uno" / "Guardar en Windows" | `server-windows` |
| "Guardar en servidor dos" / "Guardar en Linux" | `server-linux` |

El cliente normaliza el texto (minúsculas, sin acentos), exige la palabra "guardar" y busca `uno`, `1` o `windows` para el Servidor 1, y `dos`, `2` o `linux` para el Servidor 2. Si no coincide, o si se mencionan los dos servidores, pide repetir el comando.

## Red

Las dos VMs están en computadoras distintas y el celular debe alcanzar ambas.

- **Desarrollo:** Tailscale en las dos VMs y en el celular, para tener IPs fijas desde cualquier red.
- **Grabación del video:** misma red WiFi, con las VMs en adaptador puente (bridged).
- Abrir el puerto `3000` en Windows Firewall y en `ufw`.
- Android bloquea HTTP sin cifrar; ya está habilitado en `client/app.json` con `usesCleartextTraffic`.

## Seguridad

- API key en el header `x-api-key`; las peticiones sin ella se rechazan con `401`.
- Validación de datos en el servidor y consultas parametrizadas.
- Usuario de BD con permisos mínimos (`INSERT` y `SELECT` sobre la tabla), nunca `sa` ni `postgres`.
- La BD escucha solo en `localhost`; hacia la red se expone únicamente el servicio web.
- Credenciales y API key en `.env`, que no se sube al repo.
- Limitación conocida: las variables `EXPO_PUBLIC_*` quedan dentro de la app, así que la API key del cliente se puede extraer del APK.

## Entregables

- Video de 6 a 7 minutos con el funcionamiento de la aplicación y la explicación de la arquitectura.
- Reporte en PDF con portada y códigos de desarrollo (en `docs/`).
