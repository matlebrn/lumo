// Les données de la personne, chargées une fois et partagées par tous les écrans.
// Deux sources : le serveur (son espace Lumo) ou l'exemple (en mémoire, rien n'est enregistré).
import type { Regles } from '@moteur';
import { AppState } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { coffre } from '@/securite/stockage';
import type { Plan } from '@/droits';
import { calculer, type Calcul } from './calcul';
import { exemple } from './exemple';
import { sb, serveur } from './supabase';
import type { Donnees, Objectif, Profil, Session, Situation } from './types';
import type { StyleLumi } from '@/lumi/styles';

type Etat = 'demarrage' | 'accueil' | 'pret' | 'erreur';
interface Valeur {
  etat: Etat; erreur: string; exemple: boolean; d: Donnees | null; c: Calcul | null;
  commencer: (choix: { situation: Situation; objectif: Objectif; style: StyleLumi }) => Promise<void>;
  voirExemple: () => Promise<void>;
  quitterExemple: () => Promise<void>;
  recharger: (actualiser?: boolean) => Promise<void>;
  ranger: (cle: string, categorie: string | null) => Promise<void>;
  changerProfil: (patch: Partial<Profil>) => Promise<void>;
}
const Ctx = createContext<Valeur | null>(null);
export const useDonnees = () => { const v = useContext(Ctx); if (!v) throw new Error('useDonnees hors de DonneesProvider'); return v; };
/** Les données et les calculs, quand ils sont prêts (écrans à onglets uniquement). */
export const usePret = () => { const v = useDonnees(); return { ...v, d: v.d as Donnees, c: v.c as Calcul }; };

const CLE_MODE = 'lumo.mode';
const PROFIL_VIDE: Profil = { prenom: '', coussin: 0, courant_manuel: null, ignores: [], pret: false, situation: null, objectif: null, style_lumi: 'coach' };

async function chargerServeur(): Promise<Donnees> {
  const depuis = new Date(Date.now() - 760 * 864e5).toISOString().slice(0, 10); // tout l'historique gardé (2 ans)
  const [p, c, f, pr, cl, dr, se] = await Promise.all([
    sb.from('profils').select('*').maybeSingle(),
    sb.from('comptes').select('*').order('cree'),
    sb.from('flux').select('*').order('cree'),
    sb.from('projets').select('*').order('ordre').order('cree'),
    sb.from('classements').select('cle,categorie'),
    sb.from('droits').select('plan,valide_jusqu').maybeSingle(),
    sb.from('eb_sessions').select('session_id,bank,status,last_sync,valid_until,error').neq('status', 'REVOKED'),
  ]);
  const err = [p, c, f, pr].find((r) => r.error);
  if (err?.error) throw new Error(err.error.message);
  const operations = [];
  for (let page = 0; page < 20; page++) {
    const r = await sb.from('operations').select('id,date,montant,libelle,compte_id,contrepartie,contrepartie_iban,mcc,statut').gte('date', depuis).order('date', { ascending: false }).range(page * 1000, page * 1000 + 999);
    if (r.error || !r.data.length) break;
    operations.push(...r.data);
    if (r.data.length < 1000) break;
  }
  const droit = dr.data as { plan: Plan; valide_jusqu: string | null } | null;
  const plan: Plan = droit && (!droit.valide_jusqu || new Date(droit.valide_jusqu) > new Date()) ? droit.plan : 'gratuit';
  return {
    profil: { ...PROFIL_VIDE, ...(p.data ?? {}) },
    comptes: c.data ?? [], flux: f.data ?? [], projets: pr.data ?? [], operations,
    classements: Object.fromEntries(((cl.data ?? []) as { cle: string; categorie: string }[]).map((x) => [x.cle, x.categorie])) as Regles,
    plan, sessions: (se.data ?? []) as Session[],
  };
}

// Une actualisation quand la personne ouvre Lumo : la banque n'impose pas de limite quand elle est là
const vieille = (d: Donnees) => d.sessions.some((x) => x.status === 'AUTHORIZED' && (!x.last_sync || Date.now() - new Date(x.last_sync).getTime() > 3600e3));

export function DonneesProvider({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<Etat>('demarrage');
  const [erreur, setErreur] = useState('');
  const [estExemple, setExemple] = useState(false);
  const [d, setD] = useState<Donnees | null>(null);

  const recharger = useCallback(async (actualiser = false) => {
    try {
      let x = await chargerServeur();
      setD(x); setEtat('pret');
      if (actualiser && vieille(x)) {
        const r = await serveur('bank/u/sync').catch(() => null);
        if (r?.ok) { x = await chargerServeur(); setD(x); }
      }
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)); setEtat('erreur'); }
  }, []);
  const c = useMemo(() => (d ? calculer(d) : null), [d]);
  // Lumo retient le jour de la paie : le serveur regarde la banque plus tôt et plus souvent ce jour-là
  useEffect(() => {
    const jp = c?.bilan.paie?.jourHabituel;
    if (!d || estExemple || !jp || d.profil.jour_paie === jp) return;
    d.profil.jour_paie = jp;
    sb.auth.getUser().then(({ data }) => data.user && sb.from('profils').upsert({ user_id: data.user.id, jour_paie: jp })).catch(() => {});
  }, [c, d, estExemple]);

  useEffect(() => {
    (async () => {
      if ((await coffre.getItem(CLE_MODE)) === 'exemple') { setExemple(true); setD(exemple()); setEtat('pret'); return; }
      const { data } = await sb.auth.getSession();
      if (data.session) await recharger(true); else setEtat('accueil');
    })();
  }, [recharger]);

  // retour dans l'appli après un moment : on actualise aussi
  useEffect(() => {
    const ab = AppState.addEventListener('change', (e) => { if (e === 'active' && d && !estExemple && vieille(d)) recharger(true); });
    return () => ab.remove();
  }, [d, estExemple, recharger]);

  const commencer: Valeur['commencer'] = async ({ situation, objectif, style }) => {
    setErreur('');
    const { data: s } = await sb.auth.getSession();
    if (!s.session) {
      const { error } = await sb.auth.signInAnonymously();
      if (error) { setErreur(/anonymous.*disabled|not enabled/i.test(error.message) ? 'L’ouverture sans compte n’est pas encore activée sur le serveur de Lumo.' : 'Pas de connexion. Réessaie.'); return; }
    }
    const { data: u } = await sb.auth.getUser();
    const r = await sb.from('profils').upsert({ user_id: u.user!.id, situation, objectif, style_lumi: style, pret: true });
    if (r.error) { setErreur('Enregistrement impossible. Réessaie.'); return; }
    await coffre.removeItem(CLE_MODE); setExemple(false);
    await recharger();
  };

  const voirExemple = async () => { await coffre.setItem(CLE_MODE, 'exemple'); setExemple(true); setD(exemple()); setEtat('pret'); };
  const quitterExemple = async () => {
    await coffre.removeItem(CLE_MODE); setExemple(false); setD(null);
    const { data } = await sb.auth.getSession();
    if (data.session) await recharger(); else setEtat('accueil');
  };

  const ranger: Valeur['ranger'] = async (cle, categorie) => {
    if (!d) return;
    if (!estExemple) {
      const { data: u } = await sb.auth.getUser();
      const r = categorie
        ? await sb.from('classements').upsert({ user_id: u.user!.id, cle, categorie, maj: new Date().toISOString() })
        : await sb.from('classements').delete().eq('cle', cle);
      if (r.error) throw new Error(r.error.message);
    }
    const classements = { ...d.classements };
    if (categorie) classements[cle] = categorie; else delete classements[cle];
    setD({ ...d, classements });
  };

  const changerProfil: Valeur['changerProfil'] = async (patch) => {
    if (!d) return;
    const profil = { ...d.profil, ...patch };
    if (!estExemple) {
      const { data: u } = await sb.auth.getUser();
      const r = await sb.from('profils').upsert({ user_id: u.user!.id, ...patch });
      if (r.error) throw new Error(r.error.message);
    }
    setD({ ...d, profil });
  };

  return (
    <Ctx.Provider value={{ etat, erreur, exemple: estExemple, d, c, commencer, voirExemple, quitterExemple, recharger, ranger, changerProfil }}>
      {children}
    </Ctx.Provider>
  );
}
