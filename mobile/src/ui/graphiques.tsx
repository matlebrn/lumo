// Graphiques tracés en SVG : jauge de la note, petite courbe des comptes, barres des mois, courbe de prévision.
import type { MoisBilan } from '@moteur';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { eur, MOIS_COURT, moisLong, majuscule, t } from '@/i18n';
import { C, F, ton as TON } from '@/theme';

export function Jauge({ note, ton, taille = 104 }: { note: number; ton: 'bon' | 'alerte' | 'rouge'; taille?: number }) {
  const r = 46, c = 2 * Math.PI * r, part = Math.max(0.02, note / 100);
  return (
    <Svg width={taille} height={taille} viewBox="0 0 110 110" accessibilityLabel={`Note ${note} sur 100`}>
      <Circle cx={55} cy={55} r={r} fill="none" stroke={C.carte2} strokeWidth={8} />
      <Circle cx={55} cy={55} r={r} fill="none" stroke={ton === 'bon' ? C.or : TON[ton]} strokeWidth={8} strokeLinecap="round" strokeDasharray={`${c * part} ${c}`} transform="rotate(-90 55 55)" />
      <SvgText x={55} y={62} textAnchor="middle" fontSize={34} fill={C.texte} fontFamily={F.serif}>{note}</SvgText>
      <SvgText x={55} y={79} textAnchor="middle" fontSize={10.5} fill={C.pale} fontFamily={F.sans}>sur 100</SvgText>
    </Svg>
  );
}

const useLargeur = (defaut = 320) => {
  const [w, setW] = useState(defaut);
  return [w, (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width))] as const;
};

export function Spark({ points }: { points: { mois: string; total: number }[] }) {
  const [W, mesure] = useLargeur();
  if (points.length < 2) return null;
  const HT = 56, v = points.map((p) => p.total), min = Math.min(...v), et = Math.max(...v) - min || 1;
  const pts = v.map((y, i) => [(i / (v.length - 1)) * W, HT - 6 - ((y - min) / et) * (HT - 12)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <View onLayout={mesure} style={{ marginTop: 14 }}>
      <Svg width={W} height={HT}>
        <Defs><LinearGradient id="spk" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={C.or} stopOpacity={0.3} /><Stop offset="1" stopColor={C.or} stopOpacity={0} /></LinearGradient></Defs>
        <Path d={`${d} L${W} ${HT} L0 ${HT}Z`} fill="url(#spk)" />
        <Path d={d} fill="none" stroke={C.or} strokeWidth={2} />
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        {points.map((p) => <Text key={p.mois} style={g.axe}>{MOIS_COURT[+p.mois.slice(5, 7) - 1]}</Text>)}
      </View>
    </View>
  );
}

/** Rentrées et sorties des 12 derniers mois ; toucher un mois affiche son détail. */
export function BarresMois({ mois }: { mois: MoisBilan[] }) {
  const L = mois.slice(-12);
  const defaut = L.length - 1 - (L[L.length - 1]?.enCours && L.length > 1 ? 1 : 0);
  const [sel, setSel] = useState(defaut);
  const [W, mesure] = useLargeur();
  if (!L.length) return null;
  const HT = 150, bas = 20, haut = 8, max = Math.max(1, ...L.map((m) => Math.max(m.entrees, m.sorties)));
  const col = W / L.length, lb = Math.min(12, (col - 8) / 2), Y = (v: number) => HT - bas - ((HT - bas - haut) * v) / max;
  const barre = (x: number, v: number, f: string, op: number, k: string) => {
    const y = Y(v), h = HT - bas - y; if (h < 1) return null;
    const rr = Math.min(4, h, lb / 2);
    return <Path key={k} d={`M${x} ${HT - bas}V${y + rr}q0 -${rr} ${rr} -${rr}h${lb - 2 * rr}q${rr} 0 ${rr} ${rr}V${HT - bas}Z`} fill={f} opacity={op} />;
  };
  const m = L[Math.min(sel, L.length - 1)];
  return (
    <View onLayout={mesure}>
      <View>
        <Svg width={W} height={HT} accessibilityLabel={t('analyse.rentreSort')}>
          <Line x1={0} x2={W} y1={HT - bas} y2={HT - bas} stroke="rgba(255,255,255,0.08)" />
          {L.map((x, i) => {
            const x0 = i * col + (col - 2 * lb - 2) / 2, op = x.enCours ? 0.45 : i === sel ? 1 : 0.7;
            return [
              i === sel ? <Rect key={`f${i}`} x={i * col + 1} y={0} width={col - 2} height={HT - bas + 2} rx={8} fill="rgba(255,255,255,0.04)" /> : null,
              barre(x0, x.entrees, C.or, op, `e${i}`), barre(x0 + lb + 2, x.sorties, C.sorties, op, `s${i}`),
              <SvgText key={`t${i}`} x={i * col + col / 2} y={HT - 5} textAnchor="middle" fontSize={10.5} fill={i === sel ? C.texte : C.pale} fontFamily={F.sans}>{MOIS_COURT[+x.mois.slice(5, 7) - 1].charAt(0).toUpperCase()}</SvgText>,
            ];
          })}
        </Svg>
        <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
          {L.map((x, i) => <Pressable key={x.mois} style={{ flex: 1 }} onPress={() => setSel(i)} accessibilityRole="button" accessibilityLabel={`${moisLong(x.mois)} : rentré ${eur(x.entrees)}, sorti ${eur(x.sorties)}`} />)}
        </View>
      </View>
      <View style={g.legende}>
        <View style={g.leg}><View style={[g.carre, { backgroundColor: C.or }]} /><Text style={g.legTexte}>{t('analyse.rentrees')}</Text></View>
        <View style={g.leg}><View style={[g.carre, { backgroundColor: C.sorties }]} /><Text style={g.legTexte}>{t('analyse.sorties')}</Text></View>
      </View>
      <View style={g.lecture}>
        <Text style={g.moisNom}>{majuscule(moisLong(m.mois))}{m.enCours ? ' (en cours)' : ''}</Text>
        <View style={g.trio}>
          <View style={{ flex: 1 }}><Text style={g.petit}>{t('aujourdhui.rentre')}</Text><Text style={[g.val, { color: C.plus }]}>{eur(m.entrees)}</Text></View>
          <View style={{ flex: 1 }}><Text style={g.petit}>Sorti</Text><Text style={g.val}>{eur(m.sorties)}</Text></View>
          <View style={{ flex: 1 }}><Text style={g.petit}>Reste</Text><Text style={[g.val, { color: m.net >= 0 ? C.or : C.moins }]}>{eur(m.net, true)}</Text></View>
        </View>
      </View>
    </View>
  );
}

/** Courbe de la prévision : avec projets (or) et sans (tirets), coussin en pointillé. */
export function Courbe({ avec, sans, coussin, mois }: { avec: number[]; sans: number[]; coussin: number; mois: (k: number) => string }) {
  const [W, mesure] = useLargeur();
  const [k, setK] = useState<number | null>(null);
  const h = avec.length - 1, HT = 184, haut = 14, bas = 22;
  const ecart = avec.some((v, i) => Math.abs(v - sans[i]) > 1);
  let lo = Math.min(0, ...avec, ...(ecart ? sans : [])), hi = Math.max(...avec, ...(ecart ? sans : []), coussin, 100);
  const marge = (hi - lo) * 0.1; hi += marge; if (lo < 0) lo -= marge;
  const X = (i: number) => (W * i) / h, Y = (v: number) => haut + (HT - haut - bas) * (1 - (v - lo) / (hi - lo));
  const chemin = (T: number[]) => T.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('');
  const suivre = (x: number) => setK(Math.max(0, Math.min(h, Math.round((x / W) * h))));
  return (
    <View onLayout={mesure} style={{ marginTop: 10 }}>
      <View onStartShouldSetResponder={() => true} onResponderGrant={(e) => suivre(e.nativeEvent.locationX)} onResponderMove={(e) => suivre(e.nativeEvent.locationX)} onResponderRelease={() => setK(null)}>
        <Svg width={W} height={HT} accessibilityLabel="Évolution prévue de ton argent">
          <Defs><LinearGradient id="voile" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={C.or} stopOpacity={0.28} /><Stop offset="1" stopColor={C.or} stopOpacity={0} /></LinearGradient></Defs>
          {lo < 0 && <Line x1={0} x2={W} y1={Y(0)} y2={Y(0)} stroke="rgba(231,147,130,0.55)" />}
          {coussin > 0 && <Line x1={0} x2={W} y1={Y(coussin)} y2={Y(coussin)} stroke="rgba(217,181,108,0.4)" strokeDasharray="2 4" />}
          <Path d={`${chemin(avec)}L${X(h)} ${Y(lo)}L0 ${Y(lo)}Z`} fill="url(#voile)" />
          {ecart && <Path d={chemin(sans)} fill="none" stroke={C.pale} strokeWidth={1.5} strokeDasharray="4 4" />}
          <Path d={chemin(avec)} fill="none" stroke={C.or} strokeWidth={2.2} strokeLinejoin="round" />
          {k != null && <><Line x1={X(k)} x2={X(k)} y1={haut - 4} y2={HT - bas} stroke="rgba(246,227,176,0.5)" /><Circle cx={X(k)} cy={Y(avec[k])} r={4.5} fill={C.orClair} /></>}
        </Svg>
      </View>
      <View style={g.lectureCourbe}>
        <Text style={g.petit}>{k == null ? 'Glisse ton doigt sur la courbe' : `${k === 0 ? 'Aujourd’hui' : moisLong(mois(k))}`}</Text>
        {k != null && <Text style={g.val}>{eur(avec[k])}</Text>}
      </View>
    </View>
  );
}

const g = StyleSheet.create({
  axe: { color: C.pale, fontFamily: F.sans, fontSize: 11 },
  legende: { flexDirection: 'row', gap: 16, marginTop: 8 },
  leg: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  carre: { width: 9, height: 9, borderRadius: 3 },
  legTexte: { color: C.doux, fontFamily: F.sans, fontSize: 12.5 },
  lecture: { borderTopWidth: 1, borderTopColor: C.trait, marginTop: 12, paddingTop: 12 },
  moisNom: { color: C.texte, fontFamily: F.sansGras, fontSize: 15, marginBottom: 8 },
  trio: { flexDirection: 'row', gap: 8 },
  petit: { color: C.doux, fontFamily: F.sans, fontSize: 12.5 },
  val: { color: C.texte, fontFamily: F.sansGras, fontSize: 15.5, fontVariant: ['tabular-nums'] },
  lectureCourbe: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, minHeight: 20 },
});
