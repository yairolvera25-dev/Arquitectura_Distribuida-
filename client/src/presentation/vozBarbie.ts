import * as Speech from 'expo-speech';

// Voz "estilo Barbie": la voz femenina en español del sistema, más aguda y alegre.
const TONO = 1.45;
const VELOCIDAD = 1.05;

// Nombres de voces femeninas conocidas en cada plataforma:
// iOS/macOS (Paulina, Mónica), Edge/Windows (Dalia, Sabina, Helena, Elvira),
// Chrome ("Google español"), Linux/espeak (variantes "female").
const FEMENINAS = /paulina|m[oó]nica|marisol|dalia|sabina|helena|elvira|laura|google espa|female|mujer|\+f\d/i;

let vozElegida: Promise<string | undefined> | null = null;

async function buscarVoz(): Promise<string | undefined> {
  // En web, si el sistema no tiene voces, la lista nunca llega: no se espera más de 1.5 s.
  const voces = await Promise.race([
    Speech.getAvailableVoicesAsync(),
    new Promise<Speech.Voice[]>((resolve) => setTimeout(() => resolve([]), 1500)),
  ]);

  const puntaje = (voz: Speech.Voice) => {
    const idioma = voz.language.toLowerCase().replace('_', '-');
    let puntos = 0;
    if (FEMENINAS.test(voz.name) || FEMENINAS.test(voz.identifier)) puntos += 10;
    if (idioma === 'es-mx') puntos += 4;
    else if (idioma === 'es-us' || idioma === 'es-419') puntos += 3;
    if (/natural|online|enhanced|premium/i.test(voz.name) || voz.quality === Speech.VoiceQuality.Enhanced) puntos += 2;
    return puntos;
  };

  const enEspanol = voces.filter((voz) => voz.language.toLowerCase().startsWith('es'));
  enEspanol.sort((a, b) => puntaje(b) - puntaje(a));
  return enEspanol[0]?.identifier;
}

/** Precarga la voz para que la primera respuesta no se retrase. */
export function prepararVoz() {
  vozElegida ??= buscarVoz().then((voz) => {
    if (!voz) vozElegida = null; // Reintenta después (en web las voces cargan tarde)
    return voz;
  });
  return vozElegida;
}

export async function hablarComoBarbie(texto: string, alTerminar: () => void) {
  const voz = await prepararVoz();
  Speech.speak(texto, {
    language: 'es-MX',
    voice: voz,
    pitch: TONO,
    rate: VELOCIDAD,
    onDone: alTerminar,
    onStopped: alTerminar,
    onError: alTerminar,
  });
}
