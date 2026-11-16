// Racine de l'appli : polices, verrouillage, données, puis la navigation.
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from '@expo-google-fonts/geist';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DonneesProvider } from '@/donnees/Donnees';
import { Verrou } from '@/securite/Verrou';
import { C } from '@/theme';

export { ErrorBoundary } from 'expo-router';
SplashScreen.preventAutoHideAsync();

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: C.fond, card: C.fond, primary: C.or, text: C.texte, border: C.trait } };

export default function Racine() {
  const [pretes, erreur] = useFonts({ InstrumentSerif_400Regular, Geist_400Regular, Geist_500Medium, Geist_600SemiBold });
  useEffect(() => { if (pretes || erreur) SplashScreen.hideAsync(); }, [pretes, erreur]);
  if (!pretes && !erreur) return null;
  return (
    <SafeAreaProvider>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <Verrou>
          <DonneesProvider>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.fond } }}>
              <Stack.Screen name="(onglets)" />
              <Stack.Screen name="accueil" options={{ gestureEnabled: false }} />
              <Stack.Screen name="lumi" options={{ presentation: 'modal' }} />
              <Stack.Screen name="reglages" options={{ presentation: 'modal' }} />
              <Stack.Screen name="operation" options={{ presentation: 'modal' }} />
              <Stack.Screen name="plus" options={{ presentation: 'modal' }} />
              <Stack.Screen name="banque" options={{ presentation: 'modal' }} />
            </Stack>
          </DonneesProvider>
        </Verrou>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
