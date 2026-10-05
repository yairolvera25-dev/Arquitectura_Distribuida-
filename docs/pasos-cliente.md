# Pasos para conectar el cliente (Hai)

Los dos servidores están funcionando y aceptan la misma API key. Comprobado el
5 de octubre de 2026 desde la red ZeroTier:

```
windows (10.191.84.109)  {"ok":true,"servidor":"windows","baseDeDatos":"conectada"}
linux   (10.191.84.219)  {"ok":true,"servidor":"linux","baseDeDatos":"conectada"}
```

Se probó un `POST /api/clima` con el cuerpo exacto que arma `servidores.ts`,
incluidos los campos de más, y respondió `201`. El contrato de la API está en el
README principal, en la sección **Contrato de los servicios**.

---

## 1. Crea tu `client/.env`

```bash
cp client/.env.example client/.env
```

Rellena:

| Variable | Qué poner |
|---|---|
| `EXPO_PUBLIC_API_KEY` | **Pídesela a Uriel o a Yair por privado.** No está en el repo ni puede estarlo |
| `EXPO_PUBLIC_USUARIO` | Tu usuario, p. ej. `haideni` (máx. 50 caracteres) |
| `EXPO_PUBLIC_NOMBRE` | Tu nombre (obligatorio, máx. 50) |
| `EXPO_PUBLIC_PATERNO` / `MATERNO` | Opcionales |
| `EXPO_PUBLIC_GEMINI_API_KEY` | La inteligencia de Barbie. Gratis en https://aistudio.google.com/apikey. Sin ella, Barbie solo entiende "guardar en servidor uno/dos" |

Las dos URLs de los servidores ya vienen bien en la plantilla; no las toques.

> Si `EXPO_PUBLIC_USUARIO` o `EXPO_PUBLIC_NOMBRE` quedan vacíos, `guardarClima`
> lanza un error antes de salir a la red. No es un fallo del servidor.

## 2. Mete el teléfono a ZeroTier

Tu laptop ya está en la red (`10.191.84.160`), pero **el teléfono no**. Las
direcciones `10.191.84.x` solo existen dentro de ZeroTier: si pruebas la app en
un celular con datos móviles y sin ZeroTier, te va a salir "No se pudo conectar"
aunque tu código esté perfecto.

1. Instala **ZeroTier One** (está en Play Store).
2. Únete a la red `3b19b3a7160c920d`.
3. Pídele a Uriel que autorice el dispositivo en ZeroTier Central; hasta que no
   aparezca como *Authorized* no tendrás dirección.

## 3. Antes de depurar, comprueba los servidores

```bash
bash docs/probar-servidores.sh
```

Lee la API key de tu `client/.env`. Qué significa cada cosa:

| Lo que dice | Qué pasa |
|---|---|
| `Todo listo` | El problema está en el cliente, sigue por ahí |
| `10.191.84.x NO responde` | No estás en ZeroTier, o esa máquina está apagada |
| `no responde en http://...` | La VM está encendida pero el servicio caído |
| `la RECHAZA (401)` | Tu API key no coincide con la del servidor |
| `solo sirve en uno de los dos` | Uriel y Yair no tienen la misma clave. **No es culpa tuya** |

Con `--completo` además guarda un registro de prueba en cada servidor, para ver
la ida y vuelta entera. Deja una fila con el usuario `prueba_cliente`: hay que
borrarla antes de grabar el vídeo.

## 4. Mira llegar tus peticiones en vivo

En el servidor Linux tienes permiso para leer los registros del servicio:

```bash
ssh haideni@10.191.84.219
journalctl -u clima-api -f
```

Cada guardado imprime una línea:

```
Registro 8 guardado (haideni, Pachuca de Soto)
```

Si tu `POST` sale del teléfono pero aquí no aparece nada, el problema está en la
red, no en el servidor. Si aparece pero con los campos mal, es el cuerpo que
estás armando.

---

## Cosas que confunden si no las sabes

- **La palabra clave de los comandos es "Barbie", no "guardar".**
  "guardar en servidor uno" sin decir Barbie se ignora. Con la clave de Gemini,
  lo que digas después se lo pasa a Gemini tal cual (ver **Comandos de voz** en
  el README). Sin ella, busca `uno`/`1`/`windows` o `dos`/`2`/`linux`, y si en
  la misma frase se mencionan los dos servidores se queda con el primero sin avisar.

- **Para guardar un solo dato hacen falta los servidores actualizados.** Un
  servidor sin actualizar rechaza la fila con un `400` ("Falta el campo
  temperatura"…) y Barbie lo dice tal cual. El guardado completo funciona igual.

- **`condicion` y `fecha_hora` se descartan.** Los dos servidores los ignoran
  porque no hay columnas para ellos; la fecha la pone la base de datos con el
  reloj del servidor. No es un error: si quieren guardar la condición del clima,
  hay que agregar la columna en las dos bases.

- **Si no mandas `municipio` pero sí `ciudad`,** el servidor usa `ciudad`. Ese
  respaldo ya está probado y funciona.

- **Los servidores solo existen mientras las máquinas estén encendidas.** El de
  Uriel es una VM en su laptop. Si pruebas de madrugada y él apagó, el servidor
  dos no va a responder.

- **Android y HTTP sin cifrar:** ya está resuelto con `usesCleartextTraffic` en
  `client/app.json`. No hay que tocar nada.

- **Los errores del servidor vienen en `error`,** y `servidores.ts` ya los
  muestra tal cual. Un `400` trae además un arreglo `errores` con el detalle de
  qué campo está mal.
