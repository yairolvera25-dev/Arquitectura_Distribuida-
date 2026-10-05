#!/usr/bin/env bash
#
# Instala el servicio web del Servidor dos (Ubuntu Server + PostgreSQL).
# Equivalente a deploy/instalar.ps1 del servidor Windows.
#
# Uso, desde la carpeta server-linux del repo clonado:
#   sudo bash deploy/instalar.sh
#
# Se puede volver a ejecutar las veces que haga falta: respeta el .env que ya
# exista y no vuelve a pedir las contraseñas. Para reconfigurarlo desde cero:
#   sudo bash deploy/instalar.sh --reconfigurar

set -euo pipefail

DESTINO=/opt/clima-api
USUARIO=clima-api
ORIGEN=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
RECONFIGURAR=${1:-}

paso()  { printf '\n\033[1;34m==>\033[0m \033[1m%s\033[0m\n' "$*"; }
ok()    { printf '    \033[32m✓\033[0m %s\n' "$*"; }
aviso() { printf '    \033[33m!\033[0m %s\n' "$*"; }
morir() { printf '\n\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || morir "hay que ejecutarlo con sudo:  sudo bash deploy/instalar.sh"
[[ -f "$ORIGEN/package.json" ]] || morir "no encuentro package.json; ejecútalo desde la carpeta server-linux del repo"

# ---------------------------------------------------------------- 1. Requisitos
paso "Comprobando requisitos"

systemctl is-active --quiet postgresql \
  || morir "PostgreSQL no está activo. Arráncalo con: systemctl start postgresql"
ok "PostgreSQL activo"

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='UPP'" | grep -q 1; then
  morir "no existe la base UPP. Créala primero con: sudo -u postgres psql -f sql/01_tabla.sql"
fi
ok "Base de datos UPP encontrada"

# ------------------------------------------------------------- 2. Zona horaria
paso "Zona horaria"

ZONA=America/Mexico_City

ZONA_ACTUAL=$(timedatectl show -p Timezone --value)
if [[ $ZONA_ACTUAL == "$ZONA" ]]; then
  ok "El sistema ya está en $ZONA"
else
  timedatectl set-timezone "$ZONA"
  ok "Sistema cambiado de $ZONA_ACTUAL a $ZONA"
fi

# PostgreSQL NO hereda la zona del sistema: la suya se fija aparte. Si se deja en
# UTC mientras el sistema está en hora local, CURRENT_TIMESTAMP guarda la hora UTC
# y luego Node la vuelve a convertir, así que FechaHora sale 6 horas adelantada.
# Las dos tienen que coincidir.
ZONA_PG=$(sudo -u postgres psql -d UPP -tAc "SHOW TimeZone")
if [[ $ZONA_PG == "$ZONA" ]]; then
  ok "PostgreSQL ya está en $ZONA"
else
  sudo -u postgres psql -q -d postgres -c "ALTER DATABASE \"UPP\" SET TimeZone = '$ZONA';"
  ok "PostgreSQL (base UPP) cambiado de $ZONA_PG a $ZONA"
fi

# ----------------------------------------------------------------- 3. Node.js
paso "Node.js"

if command -v node >/dev/null && [[ $(node -v | sed 's/v\([0-9]*\).*/\1/') -ge 18 ]]; then
  ok "Ya instalado ($(node -v))"
else
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
  ok "Instalado $(node -v)"
fi

# ------------------------------------------------------- 4. Usuario del sistema
paso "Usuario del sistema"

if id "$USUARIO" &>/dev/null; then
  ok "El usuario $USUARIO ya existe"
else
  useradd --system --home "$DESTINO" --shell /usr/sbin/nologin "$USUARIO"
  ok "Creado el usuario $USUARIO (sin shell, sin contraseña)"
fi

# ------------------------------------------------------------------ 5. Código
paso "Copiando el código a $DESTINO"

mkdir -p "$DESTINO"
# Se copia pieza por pieza para no pisar el .env ni node_modules de una instalación previa.
for item in src sql deploy package.json package-lock.json .env.example; do
  rm -rf "${DESTINO:?}/$item"
  cp -a "$ORIGEN/$item" "$DESTINO/$item"
done
ok "Código actualizado"

cd "$DESTINO"
npm ci --omit=dev --no-audit --no-fund
ok "Dependencias instaladas"

# ------------------------------------------------- 6. Usuario de la base de datos
paso "Usuario de PostgreSQL con permisos mínimos"

# El archivo se le pasa por stdin: al reinstalar, /opt/clima-api ya es 750 y el
# usuario postgres no puede entrar a leerlo.
sudo -u postgres psql -q -d UPP -f - < "$DESTINO/sql/02_usuario_api.sql"
ok "Rol upp_api creado con SELECT e INSERT sobre Georreferencia"
sudo -u postgres psql -q -d UPP -f - < "$DESTINO/sql/03_usuarios.sql"
ok "Tabla Usuarios lista (upp_api solo puede leer y crear cuentas)"
sudo -u postgres psql -q -d UPP -f - < "$DESTINO/sql/04_bitacora.sql"
ok "Tabla Bitacora lista (respaldo de los logs de la app)"

# ----------------------------------------------------------- 7. Configuración
paso "Configuración (.env)"

if [[ -f $DESTINO/.env && $RECONFIGURAR != "--reconfigurar" ]]; then
  ok "Ya existe un .env; lo dejo como está (usa --reconfigurar para rehacerlo)"
  # Instalaciones anteriores al inicio de sesión no tienen TOKEN_SECRET: se agrega.
  if ! grep -q '^TOKEN_SECRET=..*' "$DESTINO/.env"; then
    echo "    Falta TOKEN_SECRET (firma las sesiones). Tiene que ser la MISMA que en el servidor uno."
    read -rsp "    TOKEN_SECRET (mínimo 32 caracteres): " TOKEN_SECRET < /dev/tty; echo
    [[ ${#TOKEN_SECRET} -ge 32 ]] || morir "TOKEN_SECRET muy corta (mínimo 32). Genérala con: openssl rand -hex 32"
    sed -i '/^TOKEN_SECRET=/d' "$DESTINO/.env"
    printf 'TOKEN_SECRET="%s"\n' "$TOKEN_SECRET" >> "$DESTINO/.env"
    ok "TOKEN_SECRET agregada al .env"
  fi
else
  # Solo el valor sale por stdout; los mensajes van a la terminal, porque la
  # función se llama dentro de $(...) y si no se colarían dentro del secreto.
  leer_secreto() {                       # $1 = mensaje, $2 = mínimo de caracteres
    local valor
    while true; do
      read -rsp "    $1: " valor < /dev/tty
      echo > /dev/tty
      if [[ ${#valor} -lt $2 ]]; then
        echo "    Muy corta: mínimo $2 caracteres." > /dev/tty
      elif printf '%s' "$valor" | LC_ALL=C grep -q '[^A-Za-z0-9_.:@#%+=~/-]'; then
        echo "    Usa solo letras, números y  _ . : @ # % + = ~ / -" > /dev/tty
        echo "    (lo más simple:  openssl rand -hex 24 )" > /dev/tty
      else
        printf '%s' "$valor"; return
      fi
    done
  }

  echo "    La API key tiene que ser la MISMA que EXPO_PUBLIC_API_KEY del cliente."
  API_KEY=${API_KEY:-$(leer_secreto "API key (mínimo 16)" 16)}
  echo "    TOKEN_SECRET firma las sesiones y tiene que ser la MISMA que en el servidor uno."
  TOKEN_SECRET=${TOKEN_SECRET:-$(leer_secreto "TOKEN_SECRET (mínimo 32)" 32)}
  DB_PASSWORD=${DB_PASSWORD:-$(leer_secreto "Contraseña nueva para upp_api (mínimo 8)" 8)}

  # La contraseña se asigna por stdin, no en la línea de comandos, para que no
  # aparezca en  ps  ni en el historial del shell.
  sudo -u postgres psql -q -d UPP <<SQL
\set pw '$DB_PASSWORD'
ALTER ROLE upp_api WITH PASSWORD :'pw';
SQL
  ok "Contraseña de upp_api asignada"

  # DB_PASSWORD va entre comillas: sin ellas, dotenv corta el valor en el primer '#'.
  (umask 077; cat > "$DESTINO/.env" <<ENV
PORT=3000
HOST=0.0.0.0
API_KEY="$API_KEY"
TOKEN_SECRET="$TOKEN_SECRET"
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=UPP
DB_USER=upp_api
DB_PASSWORD="$DB_PASSWORD"
CORS_ORIGINS=
ENV
  )
  ok ".env escrito"
fi

# -------------------------------------------------------------- 8. Permisos
paso "Permisos"

chown -R root:"$USUARIO" "$DESTINO"
chmod 750 "$DESTINO"
chmod 640 "$DESTINO/.env"
ok "El código es de root; $USUARIO solo puede leerlo"

# --------------------------------------------------------------- 9. Servicio
paso "Servicio de systemd"

cp "$DESTINO/deploy/clima-api.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --quiet clima-api
# Si falla el arranque no cortamos aquí: la comprobación de abajo da el diagnóstico.
systemctl restart clima-api || true
ok "clima-api habilitado y arrancado"

# -------------------------------------------------------------- 10. Firewall
paso "Firewall"

ufw allow from 10.191.84.0/24 to any port 3000 proto tcp >/dev/null 2>&1 || true
if ufw status 2>/dev/null | grep -q "^Status: active"; then
  ok "ufw activo; puerto 3000 abierto solo para la red ZeroTier"
else
  ok "Regla del puerto 3000 guardada"
  aviso "ufw está DESACTIVADO, así que esa regla no se aplica todavía."
  aviso "Si lo vas a activar, abre ANTES el SSH o te quedas fuera del servidor:"
  aviso "  sudo ufw allow 22/tcp && sudo ufw allow 9993/udp && sudo ufw enable"
fi

# ------------------------------------------------------------ 11. Comprobación
paso "Comprobando que responde"

for intento in 1 2 3 4 5 6 7 8 9 10; do
  RESPUESTA=$(curl -fsS --max-time 3 http://127.0.0.1:3000/api/salud 2>/dev/null) && break
  sleep 1
done

if [[ ${RESPUESTA:-} == *'"baseDeDatos":"conectada"'* ]]; then
  IP_ZT=$(ip -4 -o addr show | awk '/ zt/ {print $4}' | cut -d/ -f1 | head -1)
  printf '\n\033[1;32m  Listo.\033[0m %s\n\n' "$RESPUESTA"
  echo "  Pruébalo desde otra máquina del equipo:"
  echo "      curl http://${IP_ZT:-10.191.84.219}:3000/api/salud"
else
  printf '\n\033[1;31m  La API no respondió bien.\033[0m Revisa el detalle con:\n\n'
  echo "      systemctl status clima-api"
  echo "      journalctl -u clima-api -n 40 --no-pager"
  exit 1
fi
