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

import { iniciarSesion, registrar } from '../data/services/autenticacion';
import { Aparecer } from './components/animaciones';
import { Logo } from './components/BarraLateral';
import { FondoAnimado } from './components/FondoAnimado';
import { colores, espacio, radio, vidrio } from './theme';

type Modo = 'entrar' | 'registro';

const USUARIO_VALIDO = /^[a-z0-9._-]{3,30}$/;

/** Mismas reglas que valida el servidor, para avisar antes de mandar nada. */
function validar(modo: Modo, campos: Record<string, string>): string | null {
  if (!campos.usuario || !campos.contrasena) return 'Escribe tu usuario y tu contraseña.';
  if (modo === 'entrar') return null;
  if (!campos.nombre.trim()) return 'Escribe tu nombre.';
  if (!USUARIO_VALIDO.test(campos.usuario)) {
    return 'El usuario debe tener de 3 a 30 caracteres: letras, números, punto, guion o guion bajo (sin espacios).';
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
  const [campos, setCampos] = useState({ usuario: '', contrasena: '', confirmar: '', nombre: '', paterno: '', materno: '' });
  const [verContrasena, setVerContrasena] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const contrasenaRef = useRef<TextInput>(null);

  const cambiar = (campo: keyof typeof campos) => (valor: string) => {
    setCampos((previo) => ({ ...previo, [campo]: campo === 'usuario' ? valor.trim().toLowerCase() : valor }));
    setError('');
  };

  const enviar = async () => {
    const problema = validar(modo, campos);
    if (problema) {
      setError(problema);
      return;
    }
    setEnviando(true);
    setError('');
    try {
      if (modo === 'registro') {
        await registrar({
          usuario: campos.usuario,
          nombre: campos.nombre.trim(),
          paterno: campos.paterno.trim() || null,
          materno: campos.materno.trim() || null,
          contrasena: campos.contrasena,
        });
      }
      // Al terminar, la app cambia sola al dashboard (escucha la sesión).
      await iniciarSesion(campos.usuario, campos.contrasena);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar. Intenta de nuevo.');
      setEnviando(false);
    }
  };

  const cambiarModo = (nuevo: Modo) => {
    setModo(nuevo);
    setError('');
  };

  return (
    <KeyboardAvoidingView style={styles.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <FondoAnimado cielo="despejado" noche />
      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <Aparecer>
        <View style={styles.tarjeta}>
          <View style={styles.encabezado}>
            <Logo horizontal />
            <Text style={styles.titulo}>Clima distribuido</Text>
            <Text style={styles.subtitulo}>
              {modo === 'entrar' ? 'Inicia sesión para hablar con Barbie' : 'Crea tu cuenta en los dos servidores'}
            </Text>
          </View>

          <View style={styles.pestanas}>
            <Pestana activa={modo === 'entrar'} texto="Iniciar sesión" onPress={() => cambiarModo('entrar')} />
            <Pestana activa={modo === 'registro'} texto="Crear cuenta" onPress={() => cambiarModo('registro')} />
          </View>

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
            autoComplete="username"
            returnKeyType="next"
            onSubmitEditing={() => contrasenaRef.current?.focus()}
          />
          <Campo
            ref={contrasenaRef}
            icono="lock-closed-outline"
            placeholder="Contraseña"
            value={campos.contrasena}
            onChangeText={cambiar('contrasena')}
            secureTextEntry={!verContrasena}
            autoCapitalize="none"
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            onSubmitEditing={modo === 'entrar' ? enviar : undefined}
            accion={
              <Pressable onPress={() => setVerContrasena((v) => !v)} hitSlop={8} accessibilityLabel="Mostrar contraseña">
                <Ionicons name={verContrasena ? 'eye-off-outline' : 'eye-outline'} size={18} color={colores.textoSecundario} />
              </Pressable>
            }
          />
          {modo === 'registro' ? (
            <>
              <Campo
                icono="lock-closed-outline"
                placeholder="Confirmar contraseña"
                value={campos.confirmar}
                onChangeText={cambiar('confirmar')}
                secureTextEntry={!verContrasena}
                autoCapitalize="none"
                autoComplete="new-password"
                onSubmitEditing={enviar}
              />
              <Text style={styles.ayuda}>Mínimo 8 caracteres, con al menos una letra y un número.</Text>
            </>
          ) : null}

          {error ? (
            <View style={styles.error}>
              <Ionicons name="alert-circle" size={18} color={colores.error} />
              <Text style={styles.errorTexto}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={enviar}
            disabled={enviando}
            style={({ pressed }) => [styles.boton, (pressed || enviando) && { opacity: 0.75 }]}
          >
            {enviando ? (
              <ActivityIndicator color={colores.fondo} />
            ) : (
              <Text style={styles.botonTexto}>{modo === 'entrar' ? 'Entrar' : 'Crear cuenta y entrar'}</Text>
            )}
          </Pressable>

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
