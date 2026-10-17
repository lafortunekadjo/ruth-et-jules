import { MariagePublic } from '../core/mariage-public.service';

/** Palette « Élégance Côtière » : valeurs par défaut si le backend n'envoie rien. */
export const PALETTE = {
  primaire: '#5e86ae',
  secondaire: '#c65a2a',
  tertiaire: '#d2b48c',
  fond: '#fbf8f1',
  texte: '#22324a',
};

const HEX = /^#[0-9a-f]{6}$/i;

/** Couleurs du mariage (backend), validées, avec repli sur la palette. */
export function couleursMariage(m: MariagePublic | null) {
  const c = (v: string | null | undefined, d: string) => (v && HEX.test(v) ? v : d);
  return {
    primaire: c(m?.couleurPrimaire, PALETTE.primaire),
    secondaire: c(m?.couleurSecondaire, PALETTE.secondaire),
    tertiaire: c(m?.couleurTertiaire, PALETTE.tertiaire),
    fond: c(m?.couleurFond, PALETTE.fond),
    texte: c(m?.couleurTexte, PALETTE.texte),
  };
}

/** "Mireille & Rodrigue" → "M & R" */
export function monogrammeDe(noms: string | null | undefined): string {
  const n = (noms ?? '').trim();
  const deuxLettres = (s: string): string => {
    const mots = s.trim().split(/[\s-]+/).filter(Boolean);
    if (mots.length >= 2) return (mots[0].charAt(0) + mots[1].charAt(0)).toUpperCase();
    return (mots[0] ?? '').slice(0, 2).toUpperCase();
  };
  const parties = n.split(/\s+(?:&|et)\s+/i);
  return parties.length === 2 ? `${deuxLettres(parties[0])} & ${deuxLettres(parties[1])}` : deuxLettres(n);
}

/** Polices du thème — une seule balise <link> pour toutes les pages. */
export function chargerPolicesInvitation(doc: Document): void {
  if (doc.head.querySelector('link[data-polices-save-the-date]')) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Montserrat:wght@400;600&family=Pinyon+Script&display=swap';
  link.setAttribute('data-polices-save-the-date', '');
  doc.head.appendChild(link);
}
