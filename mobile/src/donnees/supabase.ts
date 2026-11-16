// Le seul point d'accès au serveur. La clé publiable ne donne accès qu'à ce que les règles d'accès
// de la base autorisent (chaque ligne à son propriétaire). Aucune clé secrète dans l'appli.
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { coffre } from '@/securite/stockage';

export const SB_URL = 'https://yyxudhwlduznoteuddmp.supabase.co';
export const SB_CLE = 'sb_publishable_uUzzvK1hb5_AQucx23BC2g_6jyLnP_Q';

export const sb = createClient(SB_URL, SB_CLE, {
  auth: { storage: coffre, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// la session ne se rafraîchit que quand l'appli est au premier plan
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (e) => (e === 'active' ? sb.auth.startAutoRefresh() : sb.auth.stopAutoRefresh()));
}

export async function serveur<T = any>(fonction: string, corps?: unknown): Promise<T & { ok: boolean; statut: number }> {
  const { data } = await sb.auth.getSession();
  const r = await fetch(`${SB_URL}/functions/v1/${fonction}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: SB_CLE, authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify(corps ?? {}),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, statut: r.status, ...j };
}
