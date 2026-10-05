import { useSesion } from './src/presentation/hooks/useSesion';
import HomeScreen from './src/presentation/HomeScreen';
import PantallaAcceso from './src/presentation/PantallaAcceso';

export default function App() {
  // Sin sesión no se entra al dashboard (ni se enciende el micrófono).
  const sesion = useSesion();
  return sesion ? <HomeScreen /> : <PantallaAcceso />;
}
