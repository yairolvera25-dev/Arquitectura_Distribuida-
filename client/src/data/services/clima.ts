import * as Location from 'expo-location';

export type RegistroClima = {
  ciudad: string;
  estado: string | null;
  municipio: string | null;
  temperatura: number;
  humedad: number;
  viento: number; // km/h
  condicion: string;
  fecha_hora: string;
  latitud: number;
  longitud: number;
};

// Códigos WMO que devuelve Open-Meteo en `weather_code`
export const CONDICIONES: Record<number, string> = {
  0: 'Despejado',
  1: 'Mayormente despejado',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Niebla',
  48: 'Niebla con escarcha',
  51: 'Llovizna ligera',
  53: 'Llovizna',
  55: 'Llovizna intensa',
  56: 'Llovizna helada',
  57: 'Llovizna helada intensa',
  61: 'Lluvia ligera',
  63: 'Lluvia',
  65: 'Lluvia intensa',
  66: 'Lluvia helada',
  67: 'Lluvia helada intensa',
  71: 'Nevada ligera',
  73: 'Nevada',
  75: 'Nevada intensa',
  77: 'Granizo fino',
  80: 'Chubascos ligeros',
  81: 'Chubascos',
  82: 'Chubascos intensos',
  85: 'Chubascos de nieve',
  86: 'Chubascos de nieve intensos',
  95: 'Tormenta',
  96: 'Tormenta con granizo',
  99: 'Tormenta con granizo intenso',
};

type Lugar = { ciudad: string; estado: string | null; municipio: string | null };

// En web no existe reverseGeocodeAsync: se usa un servicio público sin API key.
async function lugarDesdeInternet(latitud: number, longitud: number): Promise<Lugar> {
  const url =
    'https://api.bigdatacloud.net/data/reverse-geocode-client' +
    `?latitude=${latitud}&longitude=${longitud}&localityLanguage=es`;
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`Geocodificación respondió ${respuesta.status}.`);
  const datos = await respuesta.json();
  const municipio = datos.city || datos.locality || null;
  return { ciudad: municipio ?? 'Desconocida', estado: datos.principalSubdivision || null, municipio };
}

async function obtenerLugar(latitud: number, longitud: number): Promise<Lugar> {
  try {
    const [lugar] = await Location.reverseGeocodeAsync({ latitude: latitud, longitude: longitud });
    if (lugar) {
      const municipio = lugar.city ?? lugar.subregion ?? null;
      return { ciudad: municipio ?? lugar.region ?? 'Desconocida', estado: lugar.region ?? null, municipio };
    }
  } catch {
    // Sigue con el servicio en línea
  }
  try {
    return await lugarDesdeInternet(latitud, longitud);
  } catch {
    return { ciudad: 'Desconocida', estado: null, municipio: null };
  }
}

export async function obtenerClima(): Promise<RegistroClima> {
  const permiso = await Location.requestForegroundPermissionsAsync();
  if (!permiso.granted) {
    throw new Error('Se necesita el permiso de ubicación.');
  }

  const posicion = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude: latitud, longitude: longitud } = posicion.coords;

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitud}&longitude=${longitud}` +
    '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code';
  const [respuesta, lugar] = await Promise.all([fetch(url), obtenerLugar(latitud, longitud)]);
  if (!respuesta.ok) {
    throw new Error(`Open-Meteo respondió ${respuesta.status}.`);
  }
  const { current } = await respuesta.json();

  return {
    ...lugar,
    temperatura: current.temperature_2m,
    humedad: current.relative_humidity_2m,
    viento: current.wind_speed_10m,
    condicion: CONDICIONES[current.weather_code] ?? 'Desconocida',
    fecha_hora: new Date().toISOString(),
    latitud,
    longitud,
  };
}
