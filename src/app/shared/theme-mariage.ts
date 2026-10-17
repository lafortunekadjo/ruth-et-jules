import { MariagePublic } from '../core/mariage-public.service';

const DEFAUTS = {
  primaire: '#a88b4a',
  secondaire: '#c48a7b',
  fond: '#fffdfa',
  texte: '#2a2724',
  police: 'Cormorant Garamond',
  policeTexte: 'Montserrat',
};

// Les valeurs viennent de la base et sont saisies par client : on n'injecte rien d'autre
// que des couleurs hexadécimales et des noms de police simples dans le CSS.
const COULEUR_VALIDE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const POLICE_VALIDE = /^[a-z0-9 -]{2,60}$/i;

const couleur = (v: string | null | undefined, d: string) => (v && COULEUR_VALIDE.test(v) ? v : d);
const police = (v: string | null | undefined, d: string) => (v && POLICE_VALIDE.test(v) ? v : d);

export function policesDe(m: MariagePublic | null): { affichage: string; texte: string } {
  return {
    affichage: police(m?.police, DEFAUTS.police),
    texte: police(m?.policeTexte, DEFAUTS.policeTexte),
  };
}

/** Pose les variables CSS du mariage sur l'élément hôte ; tout le sous-arbre en hérite. */
export function appliquerTheme(el: HTMLElement, m: MariagePublic | null): void {
  const { affichage, texte } = policesDe(m);
  const s = el.style;
  s.setProperty('--couleur-primaire', couleur(m?.couleurPrimaire, DEFAUTS.primaire));
  s.setProperty('--couleur-secondaire', couleur(m?.couleurSecondaire, DEFAUTS.secondaire));
  s.setProperty('--couleur-fond', couleur(m?.couleurFond, DEFAUTS.fond));
  s.setProperty('--couleur-texte', couleur(m?.couleurTexte, DEFAUTS.texte));
  s.setProperty('--police-affichage', `'${affichage}', Georgia, 'Times New Roman', serif`);
  s.setProperty('--police-texte', `'${texte}', system-ui, -apple-system, 'Segoe UI', sans-serif`);
}

/** Charge les polices Google Fonts demandées par le mariage (une seule fois par police). */
export function chargerPolices(doc: Document, m: MariagePublic | null): void {
  const { affichage, texte } = policesDe(m);
  for (const nom of new Set([affichage, texte])) {
    if (doc.head.querySelector(`link[data-police="${nom}"]`)) continue;
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(nom).replace(/%20/g, '+')}&display=swap`;
    link.setAttribute('data-police', nom);
    doc.head.appendChild(link);
  }

  
}
