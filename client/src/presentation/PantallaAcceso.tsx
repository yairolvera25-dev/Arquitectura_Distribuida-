import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { iniciarSesion, registrar, restablecerContrasena } from '../data/services/autenticacion';
import { Aparecer } from './components/animaciones';
import { Logo } from './components/BarraLateral';
import { FondoAnimado } from './components/FondoAnimado';
import { colores, espacio, radio, vidrio } from './theme';

type Modo = 'entrar' | 'registro' | 'restablecer';

const USUARIO_VALIDO = /^[a-z0-9._-]{3,30}$/;

const SUBTITULO: Record<Modo, string> = {
  entrar: 'Inicia sesión para hablar con Barbie',
  registro: 'Crea tu cuenta en los dos servidores',
  restablecer: 'Usa tu código de recuperación para poner una contraseña nueva',
};

const BOTON: Record<Modo, string> = {
  entrar: 'Entrar',
  registro: 'Crear cuenta',
  restablecer: 'Cambiar contraseña y entrar',
};

const normalizarUsuario = (usuario: string) => usuario.trim().toLowerCase();

/** Mismas reglas que valida el servidor, para avisar antes de mandar nada. */
function validar(modo: Modo, campos: Record<string, string>): string | null {
  const usuario = normalizarUsuario(campos.usuario);
  if (!usuario || !campos.contrasena) return 'Escribe tu usuario y tu contraseña.';
  if (modo === 'entrar') return null;
  if (modo === 'registro' && !campos.nombre.trim()) return 'Escribe tu nombre.';
  if (modo === 'registro' && !USUARIO_VALIDO.test(usuario)) {
    return 'El usuario debe tener de 3 a 30 caracteres: letras, números, punto, guion o guion bajo (sin espacios).';
  }
  if (modo === 'restablecer' && campos.codigo.replace(/[^a-zA-Z0-9]/g, '').length !== 12) {
    return 'El código de recuperación tiene 12 caracteres (por ejemplo K7QF-M2XP-9TRW).';
  }
  if (campos.contrasena.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (!/[a-zA-Z]/.test(campos.contrasena) || !/[0-9]/.test(campos.contrasena)) {
    return 'La contraseña debe tener al menos una letra y un número.';
  }
  if (campos.contrasena !== campos.confirmar) return 'Las contraseñas no coinciden.';
  return null;
}

export default function PantallaAcceso() {
  const [modo, setModo] = useState<Modo>('entrar');
  const [campos, setCampos] = useState({
    usuario: '',
    contrasena: '',
    confirmar: '',
    nombre: '',
    paterno: '',
    materno: '',
    codigo: '',
  });
  const [verContrasena, setVerContrasena] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  // Código de recuperación recién creado: se muestra antes de entrar, para que lo guarden.
  const [codigoNuevo, setCodigoNuevo] = useState<string | null>(null);
  const contrasenaRef = useRef<TextInput>(null);

  const cambiar = (campo: keyof typeof campos) => (valor: string) => {
    setCampos((previo) => ({ ...previo, [campo]: valor }));
    setError('');
  };

  const entrar = async () => {
    setEnviando(true);
    try {
      // Al terminar, la app cambia sola al dashboard (escucha la sesión).
      await iniciarSesion(normalizarUsuario(campos.usuario), campos.contrasena);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
      setEnviando(false);
    }
  };

  const enviar = async () => {
    const problema = validar(modo, campos);
    if (problema) {
      setError(problema);
      return;
    }
    setEnviando(true);
    setError('');
    setAviso('');
    const usuario = normalizarUsuario(campos.usuario);
    try {
      if (modo === 'registro') {
        const { resultado, codigoRecuperacion } = await registrar({
          usuario,
          nombre: campos.nombre.trim(),
          paterno: campos.paterno.trim() || null,
          materno: campos.materno.trim() || null,
          contrasena: campos.contrasena,
        });
        if (resultado.windows !== 'creada' || resultado.linux !== 'creada') {
          const falta = resultado.windows !== 'creada' ? 'uno' : 'dos';
          setAviso(`La cuenta quedó solo en un servidor; el servidor ${falta} no respondió. Se copiará cuando entres con él encendido.`);
        }
        setCodigoNuevo(codigoRecuperacion ?? '—');
        setEnviando(false);
        return;
      }
      if (modo === 'restablecer') {
        await restablecerContrasena(usuario, campos.codigo, campos.contrasena);
      }
      await iniciarSesion(usuario, campos.contrasena);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar. Intenta de nuevo.');
      setEnviando(false);
    }
  };

  const cambiarModo = (nuevo: Modo) => {
    setModo(nuevo);
    setError('');
    setAviso('');
    setCampos((previo) => ({ ...previo, contrasena: '', confirmar: '' }));
  };

  const ojo = (
    <Pressable onPress={() => setVerContrasena((v) => !v)} hitSlop={8} accessibilityLabel="Mostrar contraseña">
      <Ionicons name={verContrasena ? 'eye-off-outline' : 'eye-outline'} size={18} color={colores.textoSecundario} />
    </Pressable>
  );

  return (
    <KeyboardAvoidingView style={styles.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <FondoAnimado cielo="despejado" noche />
      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <Aparecer>
          <View style={styles.tarjeta}>
            <View style={styles.encabezado}>
              <Logo horizontal />
              <Text style={styles.titulo}>{codigoNuevo ? '¡Cuenta creada!' : 'Clima distribuido'}</Text>
              <Text style={styles.subtitulo}>
                {codigoNuevo ? 'Guarda tu código de recuperación antes de entrar' : SUBTITULO[modo]}
              </Text>
            </View>

            {codigoNuevo ? (
              <>
                <View style={styles.codigoCaja}>
                  <Ionicons name="key-outline" size={20} color={colores.sol} />
                  <Text style={styles.codigo} selectable>
                    {codigoNuevo}
                  </Text>
                </View>
                <Text style={styles.ayudaCodigo}>
                  Anótalo o tómale captura y guárdalo en un lugar seguro. Es la única forma de restablecer tu
                  contraseña si la olvidas, y no se vuelve a mostrar.
                </Text>
                {aviso ? <Aviso texto={aviso} /> : null}
                {error ? <CajaError texto={error} /> : null}
                <Boton texto="Ya lo guardé, entrar" enviando={enviando} onPress={entrar} />
              </>
            ) : (
              <>
                {modo !== 'restablecer' ? (
                  <View style={styles.pestanas}>
                    <Pestana activa={modo === 'entrar'} texto="Iniciar sesión" onPress={() => cambiarModo('entrar')} />
                    <Pestana activa={modo === 'registro'} texto="Crear cuenta" onPress={() => cambiarModo('registro')} />
                  </View>
                ) : (
                  <Pressable onPress={() => cambiarModo('entrar')} style={styles.volver}>
                    <Ionicons name="arrow-back" size={16} color={colores.primario} />
                    <Text style={styles.enlace}>Volver a iniciar sesión</Text>
                  </Pressable>
                )}

                {modo === 'registro' ? (
                  <>
                    <Campo icono="person-outline" placeholder="Nombre" value={campos.nombre} onChangeText={cambiar('nombre')} autoComplete="given-name" />
                    <View style={styles.fila}>
                      <Campo
                        style={styles.flex}
                        placeholder="Apellido paterno"
                        value={campos.paterno}
                        onChangeText={cambiar('paterno')}
                        autoComplete="family-name"
                      />
                      <Campo style={styles.flex} placeholder="Apellido materno" value={campos.materno} onChangeText={cambiar('materno')} />
                    </View>
                  </>
                ) : null}

                <Campo
                  icono="at"
                  placeholder="Usuario"
                  value={campos.usuario}
                  onChangeText={cambiar('usuario')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                    importantForAutofill="no"
                  returnKeyType="next"
                  onSubmitEditing={() => contrasenaRef.current?.focus()}
                />

                {modo === 'restablecer' ? (
                  <Campo
                    icono="key-outline"
                    placeholder="Código de recuperación (K7QF-M2XP-9TRW)"
                    value={campos.codigo}
                    onChangeText={cambiar('codigo')}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                ) : null}

                <Campo
                  ref={contrasenaRef}
                  icono="lock-closed-outline"
                  placeholder={modo === 'restablecer' ? 'Contraseña nueva' : 'Contraseña'}
                  value={campos.contrasena}
                  onChangeText={cambiar('contrasena')}
                  secureTextEntry={!verContrasena}
                  autoCapitalize="none"
                  autoComplete="off"
                    importantForAutofill="no"
                  onSubmitEditing={modo === 'entrar' ? enviar : undefined}
                  accion={ojo}
                />
                {modo !== 'entrar' ? (
                  <>
                    <Campo
                      icono="lock-closed-outline"
                      placeholder="Confirmar contraseña"
                      value={campos.confirmar}
                      onChangeText={cambiar('confirmar')}
                      secureTextEntry={!verContrasena}
                      autoCapitalize="none"
                      autoComplete="off"
                    importantForAutofill="no"
                      onSubmitEditing={enviar}
                    />
                    <Text style={styles.ayuda}>Mínimo 8 caracteres, con al menos una letra y un número.</Text>
                  </>
                ) : null}

                {error ? <CajaError texto={error} /> : null}

                <Boton texto={BOTON[modo]} enviando={enviando} onPress={enviar} />

                {modo === 'entrar' ? (
                  <Pressable onPress={() => cambiarModo('restablecer')} style={styles.olvide}>
                    <Text style={styles.enlace}>¿Olvidaste tu contraseña?</Text>
                  </Pressable>
                ) : null}
              </>
            )}

            <View style={styles.pie}>
              <Ionicons name="shield-checkmark-outline" size={14} color={colores.textoTenue} />
              <Text style={styles.pieTexto}>Tu contraseña se guarda cifrada en el servidor uno y en el servidor dos.</Text>
            </View>
          </View>
        </Aparecer>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Boton({ texto, enviando, onPress }: { texto: string; enviando: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={enviando} style={({ pressed }) => [styles.boton, (pressed || enviando) && { opacity: 0.75 }]}>
      {enviando ? <ActivityIndicator color={colores.fondo} /> : <Text style={styles.botonTexto}>{texto}</Text>}
    </Pressable>
  );
}

function CajaError({ texto }: { texto: string }) {
  return (
    <View style={styles.error}>
      <Ionicons name="alert-circle" size={18} color={colores.error} />
      <Text style={styles.errorTexto}>{texto}</Text>
    </View>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <View style={[styles.error, styles.aviso]}>
      <Ionicons name="warning-outline" size={18} color={colores.sol} />
      <Text style={styles.errorTexto}>{texto}</Text>
    </View>
  );
}

function Pestana({ activa, texto, onPress }: { activa: boolean; texto: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.pestana, activa && styles.pestanaActiva]}>
      <Text style={[styles.pestanaTexto, activa && styles.pestanaTextoActiva]}>{texto}</Text>
    </Pressable>
  );
}

type CampoProps = TextInputProps & {
  icono?: keyof typeof Ionicons.glyphMap;
  accion?: React.ReactNode;
  ref?: React.Ref<TextInput>;
};

// El autocompletado del navegador está apagado en todos los campos: Chrome volvía a escribir
// una contraseña guardada (o una sugerida) cada vez que se borraba.
function Campo({ icono, accion, style, ref, ...props }: CampoProps) {
  return (
    <View style={[styles.campo, style]}>
      {icono ? <Ionicons name={icono} size={18} color={colores.textoSecundario} /> : null}
      <TextInput ref={ref} style={styles.entrada} placeholderTextColor={colores.textoTenue} {...props} />
      {accion}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pantalla: {
    flex: 1,
    backgroundColor: colores.fondo,
  },
  contenido: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: espacio.md,
    paddingTop: Platform.select({ ios: 64, android: 48, default: espacio.lg }),
  },
  tarjeta: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    ...vidrio,
    borderRadius: radio.xl,
    padding: espacio.lg,
    gap: espacio.md,
  },
  encabezado: {
    alignItems: 'center',
    gap: espacio.xs,
    marginBottom: espacio.sm,
  },
  titulo: {
    fontSize: 24,
    fontWeight: '700',
    color: colores.texto,
    marginTop: espacio.sm,
  },
  subtitulo: {
    fontSize: 14,
    color: colores.textoSecundario,
    textAlign: 'center',
  },
  pestanas: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: radio.sm,
    padding: 4,
  },
  pestana: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radio.sm - 2,
    alignItems: 'center',
  },
  pestanaActiva: {
    backgroundColor: colores.tarjetaAlta,
  },
  pestanaTexto: {
    fontSize: 14,
    fontWeight: '600',
    color: colores.textoSecundario,
  },
  pestanaTextoActiva: {
    color: colores.texto,
  },
  fila: {
    flexDirection: 'row',
    gap: espacio.sm,
  },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
    backgroundColor: colores.tarjetaAlta,
    borderRadius: radio.sm,
    borderWidth: 1,
    borderColor: colores.borde,
    paddingHorizontal: espacio.md,
  },
  entrada: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 13,
    fontSize: 15,
    color: colores.texto,
  },
  ayuda: {
    fontSize: 12,
    color: colores.textoTenue,
    marginTop: -espacio.sm,
  },
  error: {
    flexDirection: 'row',
    gap: espacio.sm,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,107,107,0.08)',
    borderWidth: 1,
    borderColor: colores.error,
    borderRadius: radio.sm,
    padding: espacio.sm + 2,
  },
  errorTexto: {
    flex: 1,
    fontSize: 13,
    color: colores.texto,
  },
  boton: {
    backgroundColor: colores.primario,
    borderRadius: radio.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  botonTexto: {
    fontSize: 15,
    fontWeight: '700',
    color: colores.fondo,
  },
  aviso: {
    borderColor: colores.sol,
    backgroundColor: 'rgba(246,196,83,0.08)',
  },
  codigoCaja: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.sm,
    paddingVertical: espacio.md,
    borderRadius: radio.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colores.sol,
    backgroundColor: 'rgba(246,196,83,0.06)',
  },
  codigo: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 2,
    color: colores.texto,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  ayudaCodigo: {
    fontSize: 13,
    color: colores.textoSecundario,
    textAlign: 'center',
  },
  volver: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  olvide: {
    alignSelf: 'center',
  },
  enlace: {
    fontSize: 13,
    fontWeight: '600',
    color: colores.primario,
  },
  pie: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieTexto: {
    flexShrink: 1,
    fontSize: 11,
    color: colores.textoTenue,
    textAlign: 'center',
  },
});
