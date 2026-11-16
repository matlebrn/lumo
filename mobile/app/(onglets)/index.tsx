// Aujourd'hui : tous les comptes, le mois en cours depuis la paie, les alertes, et le bilan en un coup d'œil.
import type { Alerte } from '@moteur';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { usePret } from '@/donnees/Donnees';
import { eur, leJour, MOIS, t } from '@/i18n';
import { BoutonLumi } from '@/lumi/BoutonLumi';
import { C, F } from '@/theme';
import { Avis, Carte, Doux, Ecran, Gros, Ligne, Rail, T, Titre, s as S } from '@/ui/base';
import { Jauge, Spark } from '@/ui/graphiques';
import { Icone } from '@/ui/Icone';
import { NOM_CAT } from '@moteur';

function texteAlerte(a: Alerte) {
  if (a.type === 'decouvert') return `Ton compte courant est à découvert de ${eur(a.montant)}.`;
  if (a.type === 'risque' && a.ton === 'rouge') return `Après les prélèvements qui arrivent, il manquerait ${eur(a.montant)} avant ta paie du ${leJour(a.quand!)}.`;
  if (a.type === 'risque') return `À ton rythme, ton compte serait à zéro vers le ${leJour(a.quand!)}, avant ta paie.`;
  if (a.type === 'paie') return `Ta paie d’environ ${eur(a.montant)} était attendue vers le ${leJour(a.quand!)}.`;
  if (a.type === 'inhabituel') return `${NOM_CAT[a.categorie!]} : ${eur(a.montant)} de plus que d’habitude à ce stade du mois.`;
  return a.titre;
}

export default function Aujourdhui() {
  const { d, c } = usePret();
  const { suivi: s, cv, alertes, bilan: b } = c;
  const auj = new Date();
  const date = `${['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][auj.getDay()]} ${auj.getDate()} ${MOIS[auj.getMonth()]}`;
  const maxCat = Math.max(1, ...s.categories.map((x) => Math.max(x.montant, x.habituel ?? 0)));
  const genres = (['courant', 'epargne', 'placement'] as const).filter((g) => cv.parGenre[g] || g === 'courant');

  return (
    <Ecran titre={d.profil.prenom ? t('aujourdhui.bonjour', { prenom: d.profil.prenom }) : t('aujourdhui.titre')} sous={date}>
      {alertes.map((a, i) => <Avis key={i} ton={a.ton}>{texteAlerte(a)}</Avis>)}

      <Carte>
        <Doux>{t('aujourdhui.surComptes')}</Doux>
        <Gros>{eur(cv.total)}</Gros>
        {cv.variation != null && <T style={{ color: cv.variation >= 0 ? C.plus : C.moins, fontSize: 14.5 }}>{t('aujourdhui.enSixMois', { v: eur(cv.variation, true) })}</T>}
        {cv.histoire && <Spark points={cv.histoire} />}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          {genres.map((g) => (
            <View key={g} style={{ flex: 1, backgroundColor: C.carte2, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: C.trait }}>
              <Doux style={{ fontSize: 12 }}>{t(`aujourdhui.genres.${g}`)}</Doux>
              <T style={{ fontFamily: F.sansGras }} nb={1}>{eur(cv.parGenre[g])}</T>
            </View>
          ))}
        </View>
      </Carte>

      {s.avecBanque && (
        <>
          <Titre action={<BoutonLumi question="Combien je peux dépenser d’ici ma paie sans risque ?" />}>{s.paie ? t('aujourdhui.depuisPaie', { jour: leJour(s.paie.derniere) }) : t('aujourdhui.depuisDebut', { mois: MOIS[auj.getMonth()] })}</Titre>
          <Carte>
            <Doux>{t('aujourdhui.peuxDepenser')}</Doux>
            <Text style={{ fontFamily: F.serif, fontSize: 44, color: s.reste < 0 ? C.moins : C.texte }}>{eur(s.reste)}</Text>
            <Doux>{t('aujourdhui.jusquau', { jour: leJour(s.fin) })}{s.parJour != null && s.reste > 0 ? `, soit ${t('aujourdhui.parJour', { v: eur(s.parJour) })}` : ''}</Doux>
            <View style={{ marginVertical: 16 }}><Rail part={s.ecoules / s.duree} /></View>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1 }}><Doux style={{ fontSize: 12 }}>{t('aujourdhui.depense')}</Doux><T style={{ fontFamily: F.sansGras }}>{eur(s.depense)}</T></View>
              <View style={{ flex: 1 }}><Doux style={{ fontSize: 12 }}>{t('aujourdhui.rentre')}</Doux><T style={{ fontFamily: F.sansGras, color: C.plus }}>{eur(s.entrees)}</T></View>
              <View style={{ flex: 1 }}><Doux style={{ fontSize: 12 }}>{t('aujourdhui.deCote')}</Doux><T style={{ fontFamily: F.sansGras, color: C.or }}>{eur(s.misDeCote)}</T></View>
            </View>
          </Carte>
          {s.categories.some((x) => x.montant > 0) && (
            <>
              <Titre>{t('aujourdhui.ouPart')}</Titre>
              <Carte style={{ gap: 14 }}>
                {s.categories.filter((x) => x.montant > 0).slice(0, 6).map((x) => (
                  <View key={x.id}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <T style={{ fontSize: 14.5 }}>{x.nom}</T>
                      <T style={{ fontSize: 14.5 }}>{eur(x.montant)}{x.habituel != null ? <Text style={{ color: C.pale, fontSize: 12 }}>{` · d’habitude ${eur(x.habituel)}`}</Text> : null}</T>
                    </View>
                    <Rail part={x.montant / maxCat} couleur={x.habituel != null && x.montant > x.habituel * 1.3 ? C.alerte : C.or} repere={x.habituel ? x.habituel / maxCat : undefined} />
                  </View>
                ))}
              </Carte>
            </>
          )}
        </>
      )}

      {b.assez && b.niveau && (
        <Pressable onPress={() => router.navigate('/analyse')} accessibilityRole="button">
          <Carte style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Jauge note={b.note!} ton={b.niveau.ton} taille={64} />
            <View style={{ flex: 1 }}>
              <Doux style={{ fontSize: 13 }}>{t('aujourdhui.tonBilan')}</Doux>
              <Text style={{ fontFamily: F.serif, fontSize: 24, color: b.niveau.ton === 'bon' ? C.orClair : b.niveau.ton === 'alerte' ? C.alerte : C.moins }}>{b.niveau.nom}</Text>
              <Doux style={{ fontSize: 13.5 }}>{b.vaPas!.length ? t('aujourdhui.aAmeliorer', { n: b.vaPas!.length }) : t('aujourdhui.rienInquietant')}</Doux>
            </View>
            <Icone nom="suite" couleur={C.doux} />
          </Carte>
        </Pressable>
      )}

      <Titre>{t('aujourdhui.tesComptes')}</Titre>
      <Carte style={{ paddingVertical: 4 }}>
        {cv.comptes.length ? cv.comptes.map((x) => <Ligne key={x.id} nom={x.nom} detail={x.source === 'banque' ? (x.banque ?? 'Banque') : 'Saisi à la main'} somme={eur(x.solde)} />)
          : <Doux style={{ textAlign: 'center', paddingVertical: 20 }}>Aucun compte pour l’instant.</Doux>}
      </Carte>
      <Text style={[S.doux, { fontSize: 12.5, color: C.pale, marginHorizontal: 4 }]}>Les virements entre tes comptes ne comptent ni comme dépense ni comme rentrée.</Text>
    </Ecran>
  );
}
