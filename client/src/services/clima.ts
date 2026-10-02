import * as Location from 'expo-location';

export type RegistroClima = {
  ciudad: string;
  temperatura: number;
  humedad: number;
  condicion: string;
  fecha_hora: string;
  latitud: number;
  longitud: number;
};

// Códigos WMO que devuelve Open-Meteo en `weather_code`
const CONDICIONES: Record<number, string> = {
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

async function obtenerCiudad(latitud: number, longitud: number): Promise<string> {
  try {
    const [lugar] = await Location.reverseGeocodeAsync({ latitude: latitud, longitude: longitud });
    return lugar?.city ?? lugar?.subregion ?? lugar?.region ?? 'Desconocida';
  } catch {
    return 'Desconocida';
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
    '&current=temperature_2m,relative_humidity_2m,weather_code';
  const [respuesta, ciudad] = await Promise.all([fetch(url), obtenerCiudad(latitud, longitud)]);
  if (!respuesta.ok) {
    throw new Error(`Open-Meteo respondió ${respuesta.status}.`);
  }
  const { current } = await respuesta.json();

  return {
    ciudad,
    temperatura: current.temperature_2m,
    humedad: current.relative_humidity_2m,
    condicion: CONDICIONES[current.weather_code] ?? 'Desconocida',
    fecha_hora: new Date().toISOString(),
    latitud,
    longitud,
  };
}
