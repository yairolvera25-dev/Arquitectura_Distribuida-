#!/usr/bin/env bash
#
# Comprueba que los dos servidores están listos para la app, antes de
# ponerse a depurar el cliente. Se ejecuta desde la raíz del repo:
#
#   bash docs/probar-servidores.sh                 # lee la clave de client/.env
#   bash docs/probar-servidores.sh TU_API_KEY      # o se la pasas a mano
#   bash docs/probar-servidores.sh --completo      # además guarda y borra un registro de prueba
#
# Requisito: estar conectado a la red ZeroTier del equipo.

set -uo pipefail

WINDOWS=${SERVIDOR_WINDOWS:-http://10.191.84.109:3000}
LINUX=${SERVIDOR_LINUX:-http://10.191.84.219:3000}

verde()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
rojo()    { printf '  \033[31m✗\033[0m %s\n' "$*"; }
amargo()  { printf '  \033[33m!\033[0m %s\n' "$*"; }
titulo()  { printf '\n\033[1m%s\033[0m\n' "$*"; }

COMPLETO=no
CLAVE=""
for arg in "$@"; do
  case "$arg" in
    --completo) COMPLETO=si ;;
    *) CLAVE=$arg ;;
  esac
done

# La clave sale de client/.env si no se pasó por argumento.
if [[ -z $CLAVE ]]; then
  RAIZ=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
  if [[ -f $RAIZ/client/.env ]]; then
    CLAVE=$(grep -E '^EXPO_PUBLIC_API_KEY=' "$RAIZ/client/.env" | head -1 | cut -d= -f2- | tr -d '"'"'"' \r')
  fi
fi

fallos=0

# ------------------------------------------------------------------ ZeroTier
titulo "Red ZeroTier"
for ip in 10.191.84.109 10.191.84.219; do
  if ping -c1 -W3 "$ip" >/dev/null 2>&1; then
    verde "$ip responde"
  else
    rojo "$ip NO responde"
    amargo "¿Estás conectada a ZeroTier? En Linux: sudo zerotier-cli listnetworks"
    ((fallos++))
  fi
done

# --------------------------------------------------------------- /api/salud
titulo "¿Están vivos los servicios?"
for par in "windows|$WINDOWS" "linux|$LINUX"; do
  nombre=${par%%|*}; url=${par#*|}
  cuerpo=$(curl -s -m 8 "$url/api/salud" 2>/dev/null)
  if [[ $cuerpo == *'"baseDeDatos":"conectada"'* ]]; then
    verde "$nombre: servicio y base de datos OK"
  elif [[ $cuerpo == *'"baseDeDatos"'* ]]; then
    rojo "$nombre: el servicio responde pero su base de datos NO"
    amargo "   $cuerpo"
    ((fallos++))
  else
    rojo "$nombre: no responde en $url"
    amargo "   Puede estar apagada la VM, o el servicio caído."
    ((fallos++))
  fi
done

# ------------------------------------------------------------------ API key
titulo "API key"
if [[ -z $CLAVE ]]; then
  rojo "No encuentro la clave"
  amargo "Crea client/.env a partir de client/.env.example y pon EXPO_PUBLIC_API_KEY"
  ((fallos++))
elif [[ $CLAVE == "cambia-esta-clave" ]]; then
  rojo "La clave sigue siendo el valor de ejemplo"
  ((fallos++))
else
  aceptada=0
  for par in "windows|$WINDOWS" "linux|$LINUX"; do
    nombre=${par%%|*}; url=${par#*|}
    codigo=$(curl -s -o /dev/null -w '%{http_code}' -m 8 -H "x-api-key: $CLAVE" "$url/api/clima?limite=1" 2>/dev/null)
    case "$codigo" in
      200) verde "$nombre: la acepta"; ((aceptada++)) ;;
      401) rojo "$nombre: la RECHAZA (401)"; ((fallos++)) ;;
      *)   rojo "$nombre: respondió $codigo"; ((fallos++)) ;;
    esac
  done
  if [[ $aceptada -eq 1 ]]; then
    amargo "La clave solo sirve en uno de los dos servidores."
    amargo "La app solo puede llevar UNA, así que Uriel y Yair tienen que ponerse de acuerdo"
    amargo "y dejar la misma en el .env de los dos servidores. No es culpa del cliente."
  fi
fi

# -------------------------------------------------------- Ida y vuelta real
if [[ $COMPLETO == si && -n $CLAVE ]]; then
  titulo "Guardar y leer un registro de prueba"
  for par in "windows|$WINDOWS" "linux|$LINUX"; do
    nombre=${par%%|*}; url=${par#*|}
    # Mismo cuerpo que arma client/src/data/services/servidores.ts
    respuesta=$(curl -s -m 10 -X POST "$url/api/clima" \
      -H "x-api-key: $CLAVE" -H 'Content-Type: application/json' \
      -d '{"usuario":"prueba_cliente","nombre":"Prueba","paterno":"Integracion","materno":null,
           "ciudad":"Pachuca de Soto","estado":"Hidalgo","municipio":"Pachuca de Soto",
           "temperatura":18.4,"humedad":62,"viento":9.2,
           "condicion":"Despejado","fecha_hora":"2026-01-01T00:00:00.000Z",
           "latitud":20.1011,"longitud":-98.7591}' 2>/dev/null)
    if [[ $respuesta == *'"ok":true'* ]]; then
      verde "$nombre: guardado -> $respuesta"
      amargo "   Es un registro real: bórralo antes de grabar el vídeo"
      amargo "   (usuario 'prueba_cliente')"
    else
      rojo "$nombre: no guardó"
      amargo "   $respuesta"
      ((fallos++))
    fi
  done
fi

# ------------------------------------------------------------------ Resumen
if [[ $fallos -eq 0 ]]; then
  printf '\n\033[1;32mTodo listo.\033[0m La app puede hablar con los dos servidores.\n\n'
else
  printf '\n\033[1;31m%s problema(s).\033[0m Arregla esto antes de depurar el cliente.\n\n' "$fallos"
  exit 1
fi
