// Datos extra del clima que solo se usan para mostrar en el dashboard
// (no se guardan en los servidores; eso lo hace clima.ts + servidores.ts).

export type DiaPronostico = {
  fecha: string; // YYYY-MM-DD
  codigo: number;
  maxima: number;
  minima: number;
};

export type Pronostico = {
  codigoActual: number;
  sensacion: number;
  viento: number; // km/h
  vientoPorHora: number[]; // próximas 12 horas
  visibilidadKm: number;
  uv: number;
  amanecer: string; // ISO local
  atardecer: string;
  dias: DiaPronostico[];
};

export async function obtenerPronostico(latitud: number, longitud: number): Promise<Pronostico> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitud}&longitude=${longitud}` +
    '&current=apparent_temperature,weather_code,wind_speed_10m,visibility,uv_index' +
    '&hourly=wind_speed_10m&forecast_hours=12' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset' +
    '&forecast_days=7&timezone=auto';

  const respuesta = await fetch(url);
  if (!respuesta.ok) {
    throw new Error(`Open-Meteo respondió ${respuesta.status}.`);
  }
  const { current, hourly, daily } = await respuesta.json();

  return {
    codigoActual: current.weather_code,
    sensacion: current.apparent_temperature,
    viento: current.wind_speed_10m,
    vientoPorHora: hourly.wind_speed_10m,
    visibilidadKm: current.visibility / 1000,
    uv: current.uv_index,
    amanecer: daily.sunrise[0],
    atardecer: daily.sunset[0],
    dias: daily.time.map((fecha: string, i: number) => ({
      fecha,
      codigo: daily.weather_code[i],
      maxima: daily.temperature_2m_max[i],
      minima: daily.temperature_2m_min[i],
    })),
  };
}

/** Emoji para un código WMO de Open-Meteo. */
export function iconoClima(codigo: number | undefined): string {
  if (codigo === undefined) return '🌤️';
  if (codigo === 0) return '☀️';
  if (codigo === 1) return '🌤️';
  if (codigo === 2) return '⛅';
  if (codigo === 3) return '☁️';
  if (codigo === 45 || codigo === 48) return '🌫️';
  if (codigo >= 51 && codigo <= 57) return '🌦️';
  if (codigo >= 61 && codigo <= 67) return '🌧️';
  if (codigo >= 71 && codigo <= 77) return '❄️';
  if (codigo >= 80 && codigo <= 82) return '🌦️';
  if (codigo === 85 || codigo === 86) return '🌨️';
  return '⛈️';
}
