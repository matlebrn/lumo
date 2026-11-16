// Coffre du téléphone : la session de connexion et les réglages sensibles sont chiffrés par le système
// (Trousseau iOS, Keystore Android). Les valeurs longues sont découpées, le coffre limitant chaque entrée à ~2 Ko.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TAILLE = 1800;
const options: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const propre = (cle: string) => cle.replace(/[^A-Za-z0-9._-]/g, '_');
const web = Platform.OS === 'web';

export const coffre = {
  async getItem(cle: string): Promise<string | null> {
    const k = propre(cle);
    if (web) return globalThis.localStorage?.getItem(k) ?? null;
    const n = await SecureStore.getItemAsync(`${k}.n`, options);
    if (n == null) return null;
    const morceaux = await Promise.all(Array.from({ length: +n }, (_, i) => SecureStore.getItemAsync(`${k}.${i}`, options)));
    return morceaux.some((m) => m == null) ? null : morceaux.join('');
  },
  async setItem(cle: string, valeur: string): Promise<void> {
    const k = propre(cle);
    if (web) { globalThis.localStorage?.setItem(k, valeur); return; }
    await this.removeItem(cle);
    const morceaux = valeur.match(new RegExp(`[\\s\\S]{1,${TAILLE}}`, 'g')) || [''];
    for (const [i, m] of morceaux.entries()) await SecureStore.setItemAsync(`${k}.${i}`, m, options);
    await SecureStore.setItemAsync(`${k}.n`, String(morceaux.length), options);
  },
  async removeItem(cle: string): Promise<void> {
    const k = propre(cle);
    if (web) { globalThis.localStorage?.removeItem(k); return; }
    const n = await SecureStore.getItemAsync(`${k}.n`, options);
    for (let i = 0; i < +(n || 0); i++) await SecureStore.deleteItemAsync(`${k}.${i}`, options);
    await SecureStore.deleteItemAsync(`${k}.n`, options);
  },
};
