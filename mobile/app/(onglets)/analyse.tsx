// Analyse : le bilan (note, mois, ce qui va, plan) et toutes les opérations classées.
import type { Point } from '@moteur';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { usePret } from '@/donnees/Donnees';
import { limite } from '@/droits';
import { eur, leJour, moisLong, majuscule, t } from '@/i18n';
import { BoutonLumi } from '@/lumi/BoutonLumi';
import { C, F, ton as TON } from '@/theme';
import { Avis, Carte, Doux, Ecran, Ligne, Puces, Rail, T, Titre, Verrouille } from '@/ui/base';
import { BarresMois, Jauge } from '@/ui/graphiques';
import { NOM_CAT } from '@moteur';

const COUL = { besoin: C.besoin, envie: C.envie } as const;

function Points({ L }: { L: Point[] }) {
  return (
    <Carte style={{ gap: 14 }}>
      {L.map((p, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: TON[p.ton] + '24', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: TON[p.ton], fontFamily: F.sansGras, fontSize: 13 }}>{p.ton === 'bon' ? '✓' : '!'}</Text>
          </View>
          <View style={{ flex: 1 }}><T style={{ fontFamily: F.sansGras }}>{p.titre}</T><Doux>{p.texte}</Doux></View>
        </View>
      ))}
    </Carte>
  );
}

function Bilan() {
  const { d, c } = usePret();
  const b = c.bilan;
  if (!b.assez || !b.niveau) return <Carte><Doux style={{ textAlign: 'center' }}>{t('analyse.pasAssez')}</Doux></Carte>;
  const complet = limite(d.plan, 'planComplet');
  const plan = b.plan ?? [], visibles = complet ? plan : plan.slice(0, 1);
  const maxCat = Math.max(1, ...(b.categories ?? []).map((x) => x.montant));
  return (
    <>
      <Carte style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <Jauge note={b.note!} ton={b.niveau.ton} />
        <View style={{ flex: 1 }}>
          <Doux style={{ fontSize: 13.5 }}>{t('analyse.sante')}</Doux>
          <Text style={{ fontFamily: F.serif, fontSize: 30, color: b.niveau.ton === 'bon' ? C.orClair : TON[b.niveau.ton] }}>{b.niveau.nom}</Text>
          <Doux>{b.net! >= 0 ? t('analyse.reste', { v: eur(b.net), p: Math.round((b.taux ?? 0) * 100) }) : t('analyse.manque', { v: eur(-b.net!) })}</Doux>
        </View>
      </Carte>
      <BoutonLumi question="Pourquoi j’ai cette note, et comment la faire monter ?" texte="Pourquoi cette note ?" />

      {c.aClasser.length > 0 && (
        <Pressable onPress={() => router.push({ pathname: '/operation', params: { cle: c.aClasser[0].cle } })} style={{ marginTop: 14 }} accessibilityRole="button">
          <Avis ton="alerte">{t('analyse.hesite', { n: c.aClasser.length })}</Avis>
        </Pressable>
      )}

      {b.avecBanque && b.mois.length > 1 && <><Titre>{t('analyse.rentreSort')}</Titre><Carte><BarresMois mois={b.mois} /></Carte></>}
      {(b.vaPas ?? []).length > 0 && <><Titre>{t('analyse.vaPas')}</Titre><Points L={b.vaPas!} /></>}
      {(b.va ?? []).length > 0 && <><Titre>{t('analyse.va')}</Titre><Points L={b.va!} /></>}

      {plan.length > 0 && (
        <>
          <Titre>{b.difficulte ? t('analyse.sEnSortir') : t('analyse.faireMieux')}</Titre>
          <Carte style={{ gap: 14 }}>
            {visibles.map((a, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.or, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: C.surOr, fontFamily: F.sansGras, fontSize: 13 }}>{i + 1}</Text></View>
                <View style={{ flex: 1 }}><T style={{ fontFamily: F.sansGras }}>{a.titre}</T><Doux>{a.texte}</Doux></View>
                {a.gain >= 5 && <Text style={{ color: C.plus, fontFamily: F.sansGras, fontSize: 14 }}>+{eur(a.gain)}</Text>}
              </View>
            ))}
            {!complet && plan.length > 1 && <Verrouille texte={t('analyse.planVerrouille', { n: plan.length - 1 })} />}
            {complet && (b.gains ?? 0) >= 10 && <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.trait, paddingTop: 12 }}><Doux>{t('analyse.garderEnPlus')}</Doux><Text style={{ color: C.plus, fontFamily: F.serif, fontSize: 26 }}>{eur(b.gains)}</Text></View>}
          </Carte>
        </>
      )}

      {(b.categories ?? []).length > 0 && (
        <>
          <Titre>{t('aujourdhui.ouPart')}</Titre>
          <Carte style={{ gap: 14 }}>
            {b.categories!.slice(0, 9).map((x) => (
              <View key={x.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: COUL[x.groupe] }} /><T style={{ fontSize: 14.5 }}>{x.nom}</T></View>
                  <T style={{ fontSize: 14.5 }}>{eur(x.montant)}<Text style={{ color: C.pale, fontSize: 12 }}>{` · ${Math.round(x.part * 100)} %`}</Text></T>
                </View>
                <Rail part={x.montant / maxCat} couleur={COUL[x.groupe]} />
              </View>
            ))}
            <Doux style={{ fontSize: 12.5, color: C.pale }}>Doré : obligatoire. Bleu : envies.</Doux>
          </Carte>
        </>
      )}

      {(b.abonnements ?? []).length > 0 && (
        <>
          <Titre>{t('analyse.abonnements')}</Titre>
          <Carte style={{ paddingVertical: 4 }}>
            {b.abonnements!.map((a) => <Ligne key={a.nom} nom={a.nom} detail={t('analyse.parAn', { v: eur(a.parAn) })} somme={`${String(a.montant).replace('.', ',')} €`} />)}
          </Carte>
        </>
      )}
    </>
  );
}

function Operations() {
  const { d, c } = usePret();
  const [filtre, setFiltre] = useState<'tout' | 'depenses' | 'rentrees' | 'hesite'>('tout');
  const [n, setN] = useState(60);
  if (!c.ops.length) return <Carte><Doux style={{ textAlign: 'center' }}>Connecte ta banque : chaque opération arrive ici, classée toute seule.</Doux></Carte>;
  // historique limité dans la version gratuite
  const depuis = new Date(); depuis.setMonth(depuis.getMonth() - limite(d.plan, 'historiqueMois'));
  const borne = depuis.toISOString().slice(0, 10);
  const tous = c.ops.filter((o) => o.date >= borne);
  const L = tous.filter((o) => (filtre === 'depenses' ? o.montant < 0 && !o.interne : filtre === 'rentrees' ? o.montant > 0 && !o.interne : filtre === 'hesite' ? o.hesite : true));
  let mois = '';
  return (
    <>
      <Puces choix={[['tout', 'Tout'], ['depenses', 'Dépenses'], ['rentrees', 'Rentrées'], ['hesite', t('analyse.aClasser')]]} valeur={filtre} onChange={(f) => { setFiltre(f); setN(60); }} />
      <Carte style={{ paddingVertical: 4, marginTop: 14 }}>
        {L.slice(0, n).map((o) => {
          const tete = o.date.slice(0, 7) !== mois ? (mois = o.date.slice(0, 7)) : null;
          return (
            <View key={o.id ?? `${o.date}${o.libelle}${o.montant}`}>
              {tete && <Text style={{ color: C.pale, fontFamily: F.sansGras, fontSize: 11.5, letterSpacing: 0.9, paddingTop: 12 }}>{majuscule(moisLong(tete)).toUpperCase()}</Text>}
              <Ligne nom={o.libelle || 'Opération'} detail={`${leJour(o.date)} · ${o.hesite ? 'À classer' : NOM_CAT[o.categorie] ?? 'Autres'}`} somme={eur(o.montant, true)}
                sommeStyle={{ color: o.interne ? C.doux : o.montant > 0 ? C.plus : C.texte }}
                onPress={() => router.push({ pathname: '/operation', params: { cle: o.cle, id: o.id ?? '' } })} />
            </View>
          );
        })}
        {!L.length && <Doux style={{ textAlign: 'center', paddingVertical: 20 }}>Rien ici.</Doux>}
      </Carte>
      {L.length > n && <Pressable onPress={() => setN(n + 80)} style={{ alignItems: 'center', padding: 12 }}><Text style={{ color: C.or, fontFamily: F.sansGras }}>Voir plus</Text></Pressable>}
      {tous.length < c.ops.length && <Verrouille texte={`Tes ${limite(d.plan, 'historiqueMois')} derniers mois sont visibles. Lumo Plus garde 12 mois d’historique.`} />}
    </>
  );
}

export default function Analyse() {
  const [vue, setVue] = useState<'bilan' | 'operations'>('bilan');
  return (
    <Ecran titre={t('analyse.titre')}>
      <View style={{ marginBottom: 16 }}><Puces choix={[['bilan', t('analyse.bilan')], ['operations', t('analyse.operations')]]} valeur={vue} onChange={setVue} /></View>
      {vue === 'bilan' ? <Bilan /> : <Operations />}
    </Ecran>
  );
}
