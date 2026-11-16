// Les icônes de Lumo, tracées au trait (les mêmes que sur l'appli web).
import Svg, { Circle, Path, Rect } from 'react-native-svg';

const TRACES = {
  aujourdhui: <><Rect x="3" y="6" width="18" height="13" rx="3" /><Path d="M3 10h18M16 14.5h2M7 6V4.5h10V6" /></>,
  analyse: <Path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  prevision: <><Path d="M3 17l5-5 4 3 8-9" /><Path d="M15 6h5v5" /></>,
  projets: <><Circle cx="12" cy="12" r="8.5" /><Circle cx="12" cy="12" r="4" /></>,
  lumi: <><Path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><Path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></>,
  reglages: <><Circle cx="12" cy="12" r="3" /><Path d="M19 12a7 7 0 00-.1-1.3l2-1.5-2-3.4-2.3.9a7 7 0 00-2.2-1.3L14 3h-4l-.4 2.4a7 7 0 00-2.2 1.3l-2.3-.9-2 3.4 2 1.5a7 7 0 000 2.6l-2 1.5 2 3.4 2.3-.9a7 7 0 002.2 1.3L10 21h4l.4-2.4a7 7 0 002.2-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3z" /></>,
  alerte: <><Path d="M12 4l9 16H3z" /><Path d="M12 10v4M12 17v.5" /></>,
  cadenas: <><Rect x="5" y="11" width="14" height="9" rx="2.5" /><Path d="M8 11V8a4 4 0 018 0v3" /></>,
  fermer: <Path d="M6 6l12 12M18 6L6 18" />,
  envoyer: <Path d="M12 19V5M6 11l6-6 6 6" />,
  suite: <Path d="M9 6l6 6-6 6" />,
  loupe: <><Circle cx="11" cy="11" r="6.5" /><Path d="M16 16l4.5 4.5" /></>,
};
export type NomIcone = keyof typeof TRACES;

export function Icone({ nom, taille = 22, couleur }: { nom: NomIcone; taille?: number; couleur: string }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke={couleur} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {TRACES[nom]}
    </Svg>
  );
}
