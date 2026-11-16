// Verrouillage de Lumo : Face ID ou empreinte à l'ouverture et après une minute en arrière-plan.
// Pendant que l'appli est en arrière-plan, un voile cache les montants (aperçu du sélecteur d'applis).
import * as Auth from 'expo-local-authentication';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '@/i18n';
import { C, F } from '@/theme';
import { coffre } from './stockage';

const CLE = 'lumo.verrou';
const DELAI_MS = 60_000;
type Etat = { actif: boolean; disponible: boolean; changer: (oui: boolean) => Promise<boolean> };
const Ctx = createContext<Etat>({ actif: false, disponible: false, changer: async () => false });
export const useVerrou = () => useContext(Ctx);

export function Verrou({ children }: { children: ReactNode }) {
  const [disponible, setDisponible] = useState(false);
  const [actif, setActif] = useState(false);
  const [verrouille, setVerrouille] = useState(Platform.OS !== 'web');
  const [voile, setVoile] = useState(false);
  const parti = useRef<number | null>(null);

  const deverrouiller = useCallback(async () => {
    const r = await Auth.authenticateAsync({ promptMessage: t('verrou.raison'), disableDeviceFallback: false });
    if (r.success) setVerrouille(false);
  }, []);

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web') return;
      const ok = (await Auth.hasHardwareAsync()) && (await Auth.isEnrolledAsync());
      setDisponible(ok);
      const choix = await coffre.getItem(CLE);
      const on = ok && choix !== 'non'; // activé par défaut quand le téléphone le permet
      setActif(on);
      if (on) deverrouiller(); else setVerrouille(false);
    })();
  }, [deverrouiller]);

  useEffect(() => {
    const s = AppState.addEventListener('change', (e) => {
      if (e === 'active') {
        setVoile(false);
        if (actif && parti.current && Date.now() - parti.current > DELAI_MS) { setVerrouille(true); deverrouiller(); }
        parti.current = null;
      } else {
        setVoile(true);
        if (parti.current == null) parti.current = Date.now();
      }
    });
    return () => s.remove();
  }, [actif, deverrouiller]);

  const changer = async (oui: boolean) => {
    if (oui) { const r = await Auth.authenticateAsync({ promptMessage: t('verrou.raison') }); if (!r.success) return false; }
    await coffre.setItem(CLE, oui ? 'oui' : 'non');
    setActif(oui);
    return true;
  };

  return (
    <Ctx.Provider value={{ actif, disponible, changer }}>
      {children}
      {(verrouille || voile) && (
        <View style={[StyleSheet.absoluteFill, s.voile]}>
          <Image source={require('../../assets/images/splash-icon.png')} style={s.logo} resizeMode="contain" />
          {verrouille && !voile && (
            <>
              <Text style={s.titre}>{t('verrou.titre')}</Text>
              <Pressable style={s.bouton} onPress={deverrouiller} accessibilityRole="button"><Text style={s.boutonTexte}>{t('verrou.deverrouiller')}</Text></Pressable>
            </>
          )}
        </View>
      )}
    </Ctx.Provider>
  );
}

const s = StyleSheet.create({
  voile: { backgroundColor: C.fond, alignItems: 'center', justifyContent: 'center', gap: 18, zIndex: 100 },
  logo: { width: 120, height: 60 },
  titre: { color: C.texte, fontFamily: F.serif, fontSize: 26 },
  bouton: { backgroundColor: C.or, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 16 },
  boutonTexte: { color: C.surOr, fontFamily: F.sansGras, fontSize: 16 },
});
