// Reglas de los campos de la tabla Georreferencia: [longitud máxima, obligatorio]
const TEXTOS = {
  usuario: [50, true],
  nombre: [50, true],
  paterno: [50, false],
  materno: [50, false],
  estado: [50, false],
  municipio: [80, false],
};

// [mínimo, máximo, obligatorio]
// Ninguno es obligatorio: Barbie puede guardar un solo dato ("guarda solo la temperatura").
const NUMEROS = {
  latitud: [-90, 90, false],
  longitud: [-180, 180, false],
  temperatura: [-90, 70, false],
  humedad: [0, 100, false],
  viento: [0, 500, false],
};

const vacio = (valor) => valor === undefined || valor === null || valor === '';

/** Valida el cuerpo de la petición y deja el registro limpio en `req.registro`. */
export function validarRegistro(req, res, next) {
  const cuerpo = req.body ?? {};
  const errores = [];
  const registro = {};

  for (const [campo, [maximo, obligatorio]] of Object.entries(TEXTOS)) {
    // Compatibilidad: versiones anteriores del cliente mandaban "ciudad" en lugar de "municipio".
    const valor = campo === 'municipio' && vacio(cuerpo.municipio) ? cuerpo.ciudad : cuerpo[campo];
    const texto = typeof valor === 'string' ? valor.trim() : valor;

    if (vacio(texto)) {
      if (obligatorio) errores.push(`Falta el campo "${campo}".`);
      registro[campo] = null;
    } else if (typeof texto !== 'string') {
      errores.push(`"${campo}" debe ser texto.`);
    } else if (texto.length > maximo) {
      errores.push(`"${campo}" admite máximo ${maximo} caracteres.`);
    } else {
      registro[campo] = texto;
    }
  }

  for (const [campo, [minimo, maximo, obligatorio]] of Object.entries(NUMEROS)) {
    const valor = cuerpo[campo];
    if (vacio(valor)) {
      if (obligatorio) errores.push(`Falta el campo "${campo}".`);
      registro[campo] = null;
    } else if (typeof valor !== 'number' || !Number.isFinite(valor)) {
      errores.push(`"${campo}" debe ser un número.`);
    } else if (valor < minimo || valor > maximo) {
      errores.push(`"${campo}" debe estar entre ${minimo} y ${maximo}.`);
    } else {
      registro[campo] = valor;
    }
  }

  // Una coordenada sin la otra no ubica nada.
  if ((registro.latitud === null) !== (registro.longitud === null)) {
    errores.push('"latitud" y "longitud" van juntas.');
  }

  if (errores.length) {
    return res.status(400).json({ ok: false, error: 'Datos inválidos.', errores });
  }
  req.registro = registro;
  next();
}
