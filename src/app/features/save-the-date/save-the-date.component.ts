import { Component, DestroyRef, ElementRef, HostListener, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MariagePublic, MariagePublicService } from '../../core/mariage-public.service';

type EtatEnveloppe = 'fermee' | 'ouverture' | 'fondu' | 'ouverte';

/* ═══════════════════════════════════════════════════════════════════
   DONNÉES STATIQUES (pas encore en base) — à remplacer par le backend
   ═══════════════════════════════════════════════════════════════════ */

/** Palette « Élégance Côtière » : valeurs par défaut si le backend n'envoie rien. */
const PALETTE = {
  primaire: '#5e86ae',   // bleu poudré
  secondaire: '#c65a2a', // terracotta
  tertiaire: '#d2b48c',  // sable
  fond: '#fbf8f1',       // ivoire
  texte: '#22324a',      // bleu nuit
};

const NUANCIER = [
  { nom: 'Bleu poudré', hex: '#5e86ae' },
  { nom: 'Azur', hex: '#4b8fcb' },
  { nom: 'Ivoire', hex: '#f6f1e3' },
  { nom: 'Terracotta', hex: '#c65a2a' },
  { nom: 'Sable', hex: '#d2b48c' },
];

/** Photos du couple — à placer dans public/mariages/mireille-rodrigue/ */
const DOSSIER_PHOTOS = 'assets/mariages/mireille-rodrigue';

/**
 * Musique de fond : démarre quand l'invité ouvre l'enveloppe (les navigateurs interdisent
 * le son tant que la personne n'a pas touché la page), en fondu, et tourne en boucle.
 * MP3 conseillé : 128 kb/s, 2–3 min, ~3 Mo. Mettre `null` pour désactiver.
 */
const MUSIQUE: { src: string; volume: number } | null = {
  src: `${DOSSIER_PHOTOS}/musique.m4a`,
  volume: 0.35,
};
const PHOTOS = {
  sourires: `${DOSSIER_PHOTOS}/sourires.webp`,
  complicite: `${DOSSIER_PHOTOS}/complicite.webp`,
};

/** Portrait du couple affiché au début de « Notre histoire » (fond refait en bord de mer). */
const PORTRAIT = {
  src: `${DOSSIER_PHOTOS}/couple-plage.webp`,
  alt: 'Mireille et Rodrigue, complices, au bord de la mer',
  legende: 'Avant d\'être « nous », il y a eu deux enfants qui se croisaient…',
};

/** Aquarelles partagées avec le billet (même dossier). */
const AQUARELLES = {
  hautGauche: `${DOSSIER_PHOTOS}/fleurs-haut-gauche.webp`,
  basDroite: `${DOSSIER_PHOTOS}/fleurs-bas-droite.webp`,
};

/** Dress code : texte et images d'inspiration (la 1re = carte de fond, la 2e = carte de devant). */
const DRESS_TEXTE =
  "Pour célébrer notre union, nous avons choisi l'élégance côtière : le bleu de l'océan, l'ivoire du sable, " +
  'une touche de terracotta. Laissez-vous inspirer par ces teintes pour composer votre tenue.';
const INSPIRATIONS = [
  { src: `${DOSSIER_PHOTOS}/inspirations/decor-plage.webp`, alt: 'Décor floral bleu, blanc et terracotta en bord de mer' },
  { src: `${DOSSIER_PHOTOS}/inspirations/tenues-invites.webp`, alt: 'Inspirations de tenues : bleus, terracotta et sable' },
  // les suivantes n'apparaissent que dans la visionneuse « Plus d'inspirations »
  { src: `${DOSSIER_PHOTOS}/inspirations/palette-elegance-cotiere.webp`, alt: 'Guide de palette Élégance Côtière' },
];

/** Photo de fond de l'écran d'ouverture (fondue dans un cercle). */
const PHOTO_OUVERTURE = PHOTOS.sourires;

/**
 * Illustration du couple sur la carte calendrier.
 * null → illustration aquarelle SVG intégrée (aux couleurs du thème).
 * Sinon, chemin d'un PNG transparent (ex. généré par IA) : `${DOSSIER_PHOTOS}/illustration.png`
 */
const ILLUSTRATION: string | null = null;

const PAYS = 'Cameroun';

/** Papillons de l'écran d'ouverture. */
const PAPILLONS = [
  { x: '8%', y: '52%', delai: 0, duree: 9, teinte: 'chaud' },
  { x: '78%', y: '22%', delai: 2.5, duree: 11, teinte: 'froid' },
];

const LIEN_CARTE = 'https://maps.app.goo.gl/5srfPQumdMMK2AjL9?g_st=iw';
const SIGNATURE = 'Mireille & Rodrigue';

/** Lieu précis (le backend n'a que la ville pour l'instant). */
const LIEU = { nom: 'Les Palétuviers Matanda', ville: 'Douala', quartier: 'Bonassama' };

/** Heure de la cérémonie si le backend n'en envoie pas. */
const HEURE_PAR_DEFAUT = '11:00';

/** Déroulé de la journée (validé par les mariés). */
const DEROULE: { heure: string; titre: string; detail?: string }[] = [
  { heure: '10h30', titre: 'Accueil des invités' },
  { heure: '11h00', titre: 'Cérémonie de mariage' },
  { heure: '13h00', titre: "Vin d'honneur" },
  { heure: '17h00', titre: 'Coupure du gâteau' },
];

interface ChapitreStatique { titre: string; paragraphes: string[]; photoUrl: string | null; legende: string | null; }

/** photoUrl : laisse null tant que tu n'as pas d'image — le chapitre s'affiche alors sans photo. */
const HISTOIRE: ChapitreStatique[] = [
  {
    titre: 'Le premier chapitre',
    photoUrl: null, legende: null,
    paragraphes: [
      'Certaines histoires commencent par une rencontre.',
      'La nôtre a commencé bien avant que nous soyons capables de comprendre ce qu’était une rencontre.',
      'Nous étions enfants. Nos familles se connaissaient, nos chemins se croisaient parfois… puis la vie décida de nous éloigner.\nPendant plusieurs années, plus rien.\nComme si notre histoire avait commencé par quelques lignes… avant de refermer le livre.',
    ],
  },
  {
    titre: 'Comme un air de déjà-vu',
    photoUrl: null, legende: 'Lycée Bilingue de Deido',
    paragraphes: [
      'Puis un jour, le hasard nous remit dans un même endroit, Lycée Bilingue de Deido.',
      'Nous nous étions déjà connus, pourtant tout était à recommencer.\nQuelques regards, beaucoup de distance et très peu de mots. Il faut dire que Mireille n’était pas particulièrement ravie de me retrouver…',
      'Jusqu’à ce qu’un objet parfaitement banal vienne jouer les entremetteurs :\nun correcteur.',
      'Une demande, quelques mots échangés et, peu à peu, les silences laissèrent place aux conversations.',
      'Et sans vraiment le savoir, entre deux cahiers et quelques fous rires, nous étions déjà en train d’écrire la suite.',
    ],
  },
  {
    titre: 'Puis il y eut « nous »',
    photoUrl: null, legende: null,
    paragraphes: [
      'Les mois passèrent.\nL’amitié prit ses habitudes.\nLa complicité aussi.',
      'Et une à deux années plus tard, ce qui n’avait jusque-là aucun nom en trouva finalement un : nous.',
      'La suite ne fut pas toujours une histoire de chemins faciles. Il fallait parfois savoir attendre, parfois ruser un peu pour se retrouver, et surtout apprendre très tôt la valeur de ces instants où le monde semblait enfin nous laisser tranquilles.',
      'Certains souvenirs méritent d’être racontés.\nD’autres resteront notre petit secret.',
    ],
  },
  {
    titre: 'Entre deux rives',
    photoUrl: null, legende: 'Le Cameroun · La France',
    paragraphes: [
      'Puis la vie décida de tester notre talent pour les retrouvailles.',
      'Le Cameroun d’un côté.\nLa France de l’autre.',
      'Des milliers de kilomètres entre nous, mais cette même histoire que nous refusions de laisser derrière.',
      'Alors nous avons appris une autre manière d’aimer.\nAttendre. Se manquer. Se faire confiance par-dessus tout. Se retrouver.',
      'Et recommencer.\nEncore et encore.',
      'Jusqu’à comprendre que la distance pouvait séparer deux personnes sans jamais séparer leurs chemins.',
    ],
  },
  {
    titre: 'Et maintenant…',
    photoUrl: null, legende: null,
    paragraphes: [
      'Il paraît que certaines histoires sont faites de hasard...',
      'La nôtre aura eu besoin de deux enfants, de quelques années, d’une salle de classe, d’un correcteur, de quelques secrets et de beaucoup de kilomètres pour arriver jusqu’ici.',
      'Alors après toutes ces années passées à nous retrouver…\nnous avons décidé que la prochaine fois serait la dernière.',
      'Pas la dernière fois que nous nous verrons.\nLa dernière fois que nous aurons à nous retrouver.\nParce que désormais, il n’y aura plus deux chemins à réunir.',
      'La suite s’écrira ensemble… unis par le mariage.',
    ],
  },
];

/** Mariage traditionnel — privé, pas encore en base. ⚠ Année supposée : 2027. */
const TRADITIONNEL = {
  date: '2027-01-02',
  titre: 'Mariage traditionnel',
};

const JOURS_SEMAINE = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

/** Pétales qui flottent sur la carte (positions fixes pour un rendu stable). */
const PETALES = Array.from({ length: 9 }, (_, i) => ({
  gauche: (i * 37 + 9) % 100,
  delai: (i * 1.6) % 9,
  duree: 12 + (i * 1.9) % 7,
  taille: 7 + (i * 5) % 8,
  couleur: ['var(--couleur-secondaire)', 'var(--couleur-tertiaire)', 'var(--couleur-primaire)'][i % 3],
}));

@Component({
  selector: 'app-save-the-date',
  standalone: true,
  imports: [CommonModule, RouterLink],
  host: { '(window:scroll)': 'surDefilement()' },
  template: `
    @if (mariage(); as m) {
      <div
        class="scene"
        [style.--couleur-primaire]="m.couleurPrimaire || palette.primaire"
        [style.--couleur-secondaire]="m.couleurSecondaire || palette.secondaire"
        [style.--couleur-tertiaire]="m.couleurTertiaire || palette.tertiaire"
        [style.--couleur-fond]="m.couleurFond || palette.fond"
        [style.--couleur-texte]="m.couleurTexte || palette.texte"
        [style.--police-affichage]="m.police ? m.police + ', Cormorant Garamond, Georgia, serif' : null"
      >

        <!-- ============ Musique : bouton flottant ============ -->
        @if (musiqueDispo) {
          <button type="button" class="musique" [class.musique--joue]="musiqueJoue()"
                  [class.musique--appel]="!musiqueJoue() && etat() === 'ouverte' && !musiqueCoupee()"
                  (click)="basculerMusique()"
                  [attr.aria-label]="musiqueJoue() ? 'Couper la musique' : 'Écouter la musique'"
                  [attr.aria-pressed]="musiqueJoue()">
            @if (musiqueJoue()) {
              <span class="musique-barres" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
            } @else {
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>
                @if (musiqueCoupee()) { <path class="barre-coupe" d="M3 3l18 18"/> }
              </svg>
            }
          </button>
        }

        <!-- ============ Enveloppe (écran d'accueil) ============ -->
        @if (etat() !== 'ouverte') {
          <section class="ecran-enveloppe" [class.ouverture]="etat() !== 'fermee'" [class.fondu]="etat() === 'fondu'">
            <div class="vagues vagues--accueil" aria-hidden="true">
              <svg viewBox="0 0 1440 120" preserveAspectRatio="none"><path d="M0,60 C240,110 480,10 720,60 C960,110 1200,10 1440,60 L1440,120 L0,120 Z"/></svg>
            </div>

            <p class="eyebrow">Save the date · {{ annee(m) }}</p>
            <p class="monogramme-titre"></p>

            <button type="button" class="enveloppe" (click)="ouvrir()" [disabled]="etat() !== 'fermee'"
                    aria-label="Ouvrir l'invitation">
              <!-- Ce qui est écrit sur la lettre : lisible pendant ~3 s après l'ouverture -->
              <span class="lettre">
                <span class="lettre-surtitre">Save the date</span>
                <span class="lettre-noms">{{ m.nomsCouple }}</span>
                @if (m.dateMariage) { <span class="lettre-date">{{ dateCourte(m.dateMariage) }}</span> }
                <span class="lettre-lieu">{{ lieu.nom }}</span>
              </span>
              <span class="corps"></span>
              <span class="rabat"></span>
              <img class="enveloppe-fleurs" [src]="aquarelles.hautGauche" alt="" aria-hidden="true" />
              <span class="cachet" aria-hidden="true">
                <span class="cachet-cire"></span>
                <span class="cachet-texte">
                  <span>{{ initialesCachet(m)[0] }}</span>
                  @if (initialesCachet(m)[1]) {
                    <em>&amp;</em>
                    <span>{{ initialesCachet(m)[1] }}</span>
                  }
                </span>
              </span>
            </button>

            <p class="indice">touchez le cachet pour ouvrir votre invitation</p>
            <button type="button" class="passer" (click)="passer()" [disabled]="etat() !== 'ouverture'">
              Découvrir l'invitation
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </button>
          </section>
        }

        <!-- ============ Contenu principal (après ouverture) ============ -->
        @if (etat() === 'ouverte') {

          <!-- ───── ÉCRAN D'OUVERTURE (photo fondue + prénoms + date) ───── -->
          <section class="ouv">
            <div class="ouv-photo" aria-hidden="true">
              <img [src]="photoOuverture" alt="" fetchpriority="high" />
            </div>
            <div class="ouv-voile" aria-hidden="true"></div>

            <div class="petales" aria-hidden="true">
              @for (p of petales; track $index) {
                <span class="petale"
                      [style.left.%]="p.gauche"
                      [style.width.px]="p.taille"
                      [style.height.px]="p.taille * 1.4"
                      [style.background]="p.couleur"
                      [style.animation-delay.s]="p.delai + 2"
                      [style.animation-duration.s]="p.duree"></span>
              }
            </div>

            <div class="papillons" aria-hidden="true">
              @for (b of papillons; track $index) {
                <span class="papillon papillon--{{ b.teinte }}" [style.left]="b.x" [style.top]="b.y"
                      [style.animation-delay.s]="b.delai" [style.animation-duration.s]="b.duree">
                  <svg viewBox="0 0 40 30">
                    <g class="aile aile--g"><path d="M20 15 C12 1 1 2 3 10 C4 16 12 17 20 15Z"/><path d="M20 16 C13 18 6 26 11 28 C15 29 18 22 20 16Z"/></g>
                    <g class="aile aile--d"><path d="M20 15 C28 1 39 2 37 10 C36 16 28 17 20 15Z"/><path d="M20 16 C27 18 34 26 29 28 C25 29 22 22 20 16Z"/></g>
                    <path class="papillon-corps" d="M20 9 L20 22"/>
                  </svg>
                </span>
              }
            </div>

            <div class="ouv-contenu">
              <p class="ouv-mono a2" style="--t: .1s">{{ monogramme(m) }}</p>
              <p class="ouv-lieu a2" style="--t: .45s">
                <span class="diamant" aria-hidden="true"></span>
                <span>{{ ligneLieu(m) }}</span>
                <span class="diamant" aria-hidden="true"></span>
              </p>

              <h1 class="ouv-noms">
                <span class="ouv-prenom ouv-prenom--1">{{ prenoms()[0] }}</span>
                @if (prenoms()[1]) {
                  <svg class="anneaux" viewBox="0 0 64 34" aria-hidden="true">
                    <path class="anneaux-feuille" d="M6 20 C10 12 16 12 18 16 C14 20 10 21 6 20Z M58 20 C54 12 48 12 46 16 C50 20 54 21 58 20Z"/>
                    <circle cx="26" cy="19" r="10"/>
                    <circle cx="38" cy="19" r="10"/>
                    <path class="anneaux-pierre" d="M23 7.5 L26 4 L29 7.5 L26 10Z"/>
                  </svg>
                  <span class="ouv-prenom ouv-prenom--2">{{ prenoms()[1] }}</span>
                }
              </h1>

              <div class="ouv-filet" aria-hidden="true">
                <span></span>
                <svg viewBox="0 0 40 12"><path d="M2 6 C10 1 14 11 20 6 C26 1 30 11 38 6"/><circle cx="20" cy="6" r="2.2"/></svg>
                <span></span>
              </div>

              @if (dateOuverture(); as d) {
                <div class="ouv-date">
                  <div class="ouv-date-cote ouv-date-cote--g">
                    <span class="ouv-date-etiquette">{{ d.jourSemaine }}</span>
                    <span class="ouv-date-texte">{{ d.mois }}</span>
                  </div>
                  <span class="ouv-date-barre" aria-hidden="true"></span>
                  <span class="ouv-date-jour">{{ d.jour }}</span>
                  <span class="ouv-date-barre" aria-hidden="true"></span>
                  <div class="ouv-date-cote ouv-date-cote--d">
                    <span class="ouv-date-etiquette">{{ d.anneeDebut }}</span>
                    <span class="ouv-date-texte">{{ d.anneeFin }}</span>
                  </div>
                </div>
              }
            </div>

            <button type="button" class="ouv-defiler" (click)="defilerVers('haut')" aria-label="Faire défiler">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
              <span>Faites défiler</span>
            </button>
          </section>

          <!-- ───── CARTE SAVE THE DATE (calendrier) ───── -->
          <section class="std" id="haut">
            <div class="petales" aria-hidden="true">
              @for (p of petales; track $index) {
                <span class="petale"
                      [style.left.%]="p.gauche"
                      [style.width.px]="p.taille"
                      [style.height.px]="p.taille * 1.4"
                      [style.background]="p.couleur"
                      [style.animation-delay.s]="p.delai"
                      [style.animation-duration.s]="p.duree"></span>
              }
            </div>

            <article class="carte" data-reveal>
              <!-- Coins décoratifs -->
              @for (coin of coins; track coin) {
                <svg class="coin coin--{{ coin }}" viewBox="0 0 60 60" aria-hidden="true">
                  <path d="M4 56 C4 30 14 14 40 6" />
                  <path d="M10 44 c4 -2 8 -1 10 2 M16 32 c4 -2 8 -1 10 2 M24 21 c4 -2 8 -1 10 2" />
                  <circle cx="42" cy="6" r="1.6" />
                </svg>
              }

              <div class="carte-visuel" data-reveal>
                @if (illustration) {
                  <img [src]="illustration" alt="Les mariés main dans la main" loading="lazy" />
                } @else {
                  <!-- Illustration aquarelle : les mariés de dos, main dans la main -->
                  <svg class="illustration" viewBox="0 0 200 215" role="img" aria-label="Les mariés main dans la main">
                    <defs>
                      <filter id="std-aquarelle" x="-10%" y="-10%" width="120%" height="120%">
                        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" result="bruit"/>
                        <feDisplacementMap in="SourceGraphic" in2="bruit" scale="3"/>
                      </filter>
                      <filter id="std-flou" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>
                      <linearGradient id="std-robe" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" class="st-robe-1"/><stop offset=".65" class="st-robe-2"/><stop offset="1" class="st-robe-3"/>
                      </linearGradient>
                      <linearGradient id="std-plis" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0" class="st-pli" stop-opacity=".6"/><stop offset=".45" class="st-pli" stop-opacity="0"/><stop offset="1" class="st-pli" stop-opacity=".55"/>
                      </linearGradient>
                      <linearGradient id="std-costume" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" class="st-costume-1"/><stop offset="1" class="st-costume-2"/>
                      </linearGradient>
                    </defs>

                    <!-- Lavis de fond -->
                    <ellipse class="ill-lavis" cx="104" cy="120" rx="70" ry="82" filter="url(#std-flou)"/>
                    <ellipse class="ill-ombre" cx="102" cy="205" rx="64" ry="5"/>

                    <g filter="url(#std-aquarelle)">
                      <!-- ═ Marié ═ -->
                      <path class="ill-costume-fonce" d="M113 118 L109 199 L122 200 L127 121 Z"/>
                      <path class="ill-costume-fonce" d="M131 121 L139 197 L151 194 L145 118 Z"/>
                      <ellipse class="ill-chaussure" cx="115" cy="201" rx="8" ry="3"/>
                      <ellipse class="ill-chaussure" cx="145" cy="196" rx="8" ry="3"/>
                      <path fill="url(#std-costume)" d="M107 56 Q128 47 150 56 L153 122 Q129 129 105 122 Z"/>
                      <path class="ill-pli-veste" d="M129 92 L129 125"/>
                      <path class="ill-costume-manche" d="M110 60 Q103 82 104 104"/>
                      <path class="ill-costume-manche" d="M147 60 Q155 86 152 112"/>
                      <circle class="ill-peau" cx="152" cy="115" r="4"/>
                      <rect class="ill-peau" x="123" y="42" width="10" height="11" rx="3"/>
                      <path class="ill-col" d="M120 52 Q128 49 136 52 L134 56 Q128 54 122 56 Z"/>
                      <ellipse class="ill-peau" cx="116.5" cy="35" rx="2.4" ry="3.6"/>
                      <ellipse class="ill-peau" cx="139.5" cy="35" rx="2.4" ry="3.6"/>
                      <!-- vu de dos : la tête est surtout des cheveux courts -->
                      <path class="ill-cheveux" d="M116.5 32 Q116 20 128 20 Q140 20 139.5 32 Q140 42 134 45 L122 45 Q116 42 116.5 32Z"/>
                      <path class="ill-reflet" d="M121 25 Q128 22 135 25"/>

                      <!-- ═ Mariée ═ -->
                      <path fill="url(#std-robe)" d="M67 98 Q58 150 42 202 Q78 212 116 201 Q101 150 93 98 Z"/>
                      <path fill="url(#std-plis)" d="M67 98 Q58 150 42 202 Q78 212 116 201 Q101 150 93 98 Z"/>
                      <path class="ill-pli" d="M78 112 Q74 160 66 204 M86 114 Q90 160 98 203"/>
                      <path class="ill-robe-haut" d="M64 60 Q80 53 96 60 L93 100 Q80 104 67 100 Z"/>
                      <path class="ill-peau" d="M71 59 L80 84 L89 59 Q80 56 71 59Z"/>
                      <path class="ill-ceinture" d="M67 98 Q80 102 93 98 L93 102 Q80 106 67 102 Z"/>
                      <path class="ill-bras" d="M66 63 Q59 82 61 102"/>
                      <path class="ill-bras" d="M94 63 Q100 84 104 104"/>
                      <circle class="ill-peau" cx="104" cy="106" r="3.6"/>
                      <rect class="ill-peau" x="76" y="46" width="8" height="12" rx="3"/>
                      <circle class="ill-peau" cx="80" cy="38" r="10.5"/>
                      <path class="ill-cheveux" d="M69.5 38 Q69 26 80 26 Q91 26 90.5 38 Q90 46 84 48 L76 48 Q70 46 69.5 38Z"/>
                      <circle class="ill-cheveux" cx="80" cy="25" r="7"/>
                      <path class="ill-voile" d="M86 26 Q104 50 99 108 Q92 80 84 40Z"/>

                      <!-- Bouquet -->
                      <path class="ill-tige" d="M60 104 L57 120 M62 104 L62 121 M64 104 L67 119"/>
                      <circle class="ill-fleur-1" cx="55" cy="102" r="5"/>
                      <circle class="ill-fleur-2" cx="63" cy="99" r="5.5"/>
                      <circle class="ill-fleur-3" cx="66" cy="106" r="4.5"/>
                      <circle class="ill-fleur-4" cx="58" cy="108" r="4"/>
                      <path class="ill-feuille" d="M49 105 Q46 98 52 97 Q53 103 49 105Z M71 100 Q76 95 77 101 Q73 104 71 100Z"/>
                    </g>

                    <!-- Pétales qui tombent du bouquet -->
                    <path class="ill-petale ill-petale--1" d="M0 0 C3 -3 7 -1 6 3 C3 5 0 3 0 0Z" transform="translate(150 70)"/>
                    <path class="ill-petale ill-petale--2" d="M0 0 C3 -3 7 -1 6 3 C3 5 0 3 0 0Z" transform="translate(40 60)"/>
                  </svg>
                }
              </div>

              <h2 class="std-titre">Save the Date</h2>

              @if (calendrier(); as cal) {
                <p class="std-mois">{{ cal.mois }}</p>
                <span class="filet" aria-hidden="true"></span>

                <div class="calendrier" role="grid" [attr.aria-label]="'Calendrier ' + cal.mois">
                  @for (j of joursSemaine; track j) {
                    <span class="cal-entete">{{ j }}</span>
                  }
                  @for (c of cal.cases; track $index; let i = $index) {
                    @if (c === null) {
                      <span></span>
                    } @else if (c === cal.jour) {
                      <span class="cal-jour cal-jour--grand" [style.--i]="i">
                        <span class="sr-only">{{ c }} — jour du mariage</span>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.2 0 3.7 1.2 5.3 3.2 1.6-2 3.1-3.2 5.3-3.2 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21Z"/></svg>
                      </span>
                    } @else {
                      <span class="cal-jour" [style.--i]="i">{{ c }}</span>
                    }
                  }
                </div>

                <span class="filet" aria-hidden="true"></span>
              }

              <p class="std-noms">{{ m.nomsCouple }}</p>
              <p class="std-lieu">{{ lieu.nom }} · {{ formaterHeure(heure(m)) }}</p>
            </article>

            <div class="actions" data-reveal>
              <a [routerLink]="['/m', m.slug, 'rsvp']" class="bouton bouton--plein">Confirmer ma présence</a>
              @if (m.dateMariage) {
                <button type="button" class="bouton bouton--contour" (click)="ajouterAgenda(m)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>
                  Ajouter à mon agenda
                </button>
              }
            </div>

            @if (compte(); as c) {
              <div class="compte" data-reveal aria-label="Compte à rebours">
                @for (b of c; track b.libelle) {
                  <div class="compte-bloc">
                    <span class="compte-valeur">{{ b.valeur }}</span>
                    <span class="compte-libelle">{{ b.libelle }}</span>
                  </div>
                }
              </div>
            } @else if (estAujourdhui()) {
              <p class="aujourdhui">C'est aujourd'hui !</p>
            }

            <button type="button" class="defiler" (click)="defilerVers('histoire')" aria-label="Découvrir notre histoire">
              <span>Notre histoire</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
            </button>
          </section>

          <!-- ───── NOTRE HISTOIRE ───── -->
          <section class="histoire" id="histoire">
            <div class="vagues vagues--haut" aria-hidden="true">
              <svg class="vague vague--1" viewBox="0 0 2880 120" preserveAspectRatio="none"><path d="M0,70 C240,20 480,120 720,70 C960,20 1200,120 1440,70 C1680,20 1920,120 2160,70 C2400,20 2640,120 2880,70 L2880,120 L0,120 Z"/></svg>
            </div>

            <header class="entete" data-reveal>
              <p class="surtitre">Il était une fois</p>
              <h2>Notre histoire</h2>
              <div class="separateur" aria-hidden="true"><span class="losange"></span></div>
            </header>

            <!-- Portrait du couple, en ouverture du récit -->
            <figure class="portrait" data-reveal>
              <div class="portrait-cadre">
                <div class="portrait-arche">
                  <img [src]="portrait.src" [alt]="portrait.alt" loading="lazy" decoding="async" />
                </div>
                <img class="portrait-fleurs portrait-fleurs--haut" [src]="aquarelles.hautGauche" alt="" aria-hidden="true" loading="lazy" />
                <img class="portrait-fleurs portrait-fleurs--bas" [src]="aquarelles.basDroite" alt="" aria-hidden="true" loading="lazy" />
              </div>
              <figcaption>{{ portrait.legende }}</figcaption>
            </figure>

            <div class="frise">
              @for (ch of histoire; track ch.titre; let i = $index; let pair = $even) {
                <article class="chapitre" [class.chapitre--inverse]="!pair" [class.chapitre--sans-photo]="!ch.photoUrl">
                  <span class="frise-point" aria-hidden="true">{{ romain(i + 1) }}</span>

                  @if (ch.photoUrl) {
                    <figure class="polaroid" [class.polaroid--droite]="!pair" data-reveal>
                      <img [src]="ch.photoUrl" [alt]="ch.legende || ch.titre" loading="lazy" />
                      <figcaption>{{ ch.legende || signature }}</figcaption>
                    </figure>
                  }

                  <div class="chapitre-texte" data-reveal>
                    <span class="chapitre-numero">Chapitre {{ romain(i + 1) }}</span>
                    <h3>{{ ch.titre }}</h3>
                    @if (ch.legende && !ch.photoUrl) {
                      <p class="chapitre-lieu">{{ ch.legende }}</p>
                    }
                    @for (p of ch.paragraphes; track $index; let premier = $first) {
                      <p [class.lettrine]="premier">{{ p }}</p>
                    }
                  </div>
                </article>
              }
            </div>


            <p class="signature" data-reveal>{{ signature }} <span class="coeur">❤</span></p>
          </section>

          <!-- ───── PROGRAMME ───── -->
          <section class="programme" id="programme">
            <header class="entete" data-reveal>
              <p class="surtitre">Les grands moments</p>
              <h2>Le programme</h2>
              <div class="separateur" aria-hidden="true"><span class="losange"></span></div>
            </header>

            <div class="evenements">
              <!-- Statique : pas encore en base -->
              <article class="evenement evenement--prive" data-reveal>
                <div class="evenement-date">
                  <span class="evenement-jour">{{ jour(traditionnel.date) }}</span>
                  <span class="evenement-mois">{{ moisAnnee(traditionnel.date) }}</span>
                </div>
                <div class="evenement-corps">
                  <p class="evenement-type">Tradition</p>
                  <h3>{{ traditionnel.titre }}</h3>
                  <p class="badge-prive">Stricte intimité familiale</p>
                </div>
              </article>

              <!-- Backend : date, heure, lieu -->
              @if (m.dateMariage) {
                <article class="evenement" data-reveal>
                  <div class="evenement-date">
                    <span class="evenement-jour">{{ jour(m.dateMariage) }}</span>
                    <span class="evenement-mois">{{ moisAnnee(m.dateMariage) }}</span>
                  </div>
                  <div class="evenement-corps">
                    <p class="evenement-type">Le grand jour</p>
                    <h3>Cérémonie de mariage</h3>
                    <p class="evenement-heure">{{ formaterHeure(heure(m)) }}</p>
                    <p class="evenement-lieu">{{ lieu.nom }}<br />{{ lieu.ville }} – {{ lieu.quartier }}</p>
                  </div>
                </article>
              }
            </div>

            <!-- Déroulé de la journée (fictif pour l'instant) -->
            <div class="deroule" data-reveal>
              <h3 class="deroule-titre">Le déroulé de la journée</h3>
              <ol class="deroule-liste">
                @for (e of deroule; track e.heure; let i = $index) {
                  <li [style.--i]="i">
                    <span class="deroule-heure">{{ e.heure }}</span>
                    <span class="deroule-point" aria-hidden="true"></span>
                    <div class="deroule-texte">
                      <p class="deroule-nom">{{ e.titre }}</p>
                      @if (e.detail) { <p class="deroule-detail">{{ e.detail }}</p> }
                    </div>
                  </li>
                }
              </ol>
            </div>
          </section>

          <!-- ───── LIEU / CARTE ───── -->
          <section class="carte-lieu" data-reveal>
            <a class="carte-lien" [href]="lienCarte" target="_blank" rel="noopener">
              <span class="carte-fond" aria-hidden="true">
                <span class="carte-route carte-route--1"></span>
                <span class="carte-route carte-route--2"></span>
                <span class="carte-route carte-route--3"></span>
                <span class="carte-eau"></span>
              </span>
              <span class="carte-epingle" aria-hidden="true">
                <svg viewBox="0 0 24 32"><path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 32 12 32s12-11.2 12-20.1C24 5.3 18.6 0 12 0Z"/><circle cx="12" cy="12" r="4.5" fill="#fff"/></svg>
                <span class="carte-onde"></span>
              </span>
              <span class="carte-infos">
                <span class="surtitre">Le lieu</span>
                <span class="carte-nom">{{ lieu.nom }}</span>
                <span class="carte-detail">{{ lieu.ville }} – {{ lieu.quartier }}</span>
                <span class="carte-cta">Ouvrir l'itinéraire →</span>
              </span>
            </a>
          </section>

          <!-- ───── DRESS CODE ───── -->
          <section class="dress" data-reveal>
            <header class="entete">
              <p class="surtitre">Dress code</p>
              <h2>Élégance côtière</h2>
              <div class="separateur" aria-hidden="true"><span class="losange"></span></div>
            </header>

            <div class="dress-grille">
              <div class="dress-visuels">
                @for (img of inspirations.slice(0, 2); track img.src; let i = $index) {
                  <button type="button" class="dress-carte" [class.dress-carte--avant]="i === 1" (click)="ouvrirInspiration(i)"
                          [attr.aria-label]="'Agrandir : ' + img.alt">
                    <img [src]="img.src" [alt]="img.alt" loading="lazy" decoding="async" />
                  </button>
                }
              </div>

              <div class="dress-bloc">
                <p class="dress-script">Palette choisie</p>
                <p class="dress-texte">{{ dressTexte }}</p>
                @if (m.tenueSouhaitee) {
                  <p class="dress-tenue"><span>Tenue souhaitée</span>{{ m.tenueSouhaitee }}</p>
                }
                <div class="nuancier">
                  @for (c of nuancier; track c.hex; let i = $index) {
                    <div class="nuance" [style.--i]="i">
                      <span class="pastille" [style.background]="c.hex"></span>
                      <span class="nuance-nom">{{ c.nom }}</span>
                    </div>
                  }
                </div>
              </div>
            </div>
          </section>

          <!-- Visionneuse des inspirations -->
          @if (inspirationOuverte() !== null) {
            <div class="visionneuse" role="dialog" aria-modal="true" aria-label="Inspirations dress code" (click)="fermerInspiration()">
              <button type="button" class="visionneuse-fermer" (click)="fermerInspiration()" aria-label="Fermer">×</button>
              <img [src]="inspirations[inspirationOuverte()!].src" [alt]="inspirations[inspirationOuverte()!].alt" (click)="$event.stopPropagation()" />
              @if (inspirations.length > 1) {
                <div class="visionneuse-nav" (click)="$event.stopPropagation()">
                  <button type="button" (click)="inspirationSuivante(-1)" aria-label="Précédente">‹</button>
                  <span>{{ inspirationOuverte()! + 1 }} / {{ inspirations.length }}</span>
                  <button type="button" (click)="inspirationSuivante(1)" aria-label="Suivante">›</button>
                </div>
              }
            </div>
          }

          <!-- ───── APPEL ───── -->
          <section class="appel" id="rsvp" data-reveal>
            <div class="separateur" aria-hidden="true"><span class="losange"></span></div>
            <p class="invitation-texte">Nous serions heureux de vous compter parmi nous.</p>
            <a [routerLink]="['/m', m.slug, 'rsvp']" class="bouton bouton--plein bouton--reflet">Confirmer ma présence</a>

            <div class="liens-secondaires">
              @if (m.wishlistActive) {
                <a [routerLink]="['/m', m.slug, 'wishlist']">Liste de mariage</a>
              }
              @if (m.galeriePhotoActive) {
                <a [routerLink]="['/m', m.slug, 'photos']">Galerie photo</a>
              }
              <a [routerLink]="['/m', m.slug, 'livre-or']">Livre d'or</a>
            </div>
          </section>

          <footer class="pied">
            <div class="vagues vagues--pied" aria-hidden="true">
              <svg class="vague vague--1" viewBox="0 0 2880 120" preserveAspectRatio="none"><path d="M0,70 C240,20 480,120 720,70 C960,20 1200,120 1440,70 C1680,20 1920,120 2160,70 C2400,20 2640,120 2880,70 L2880,120 L0,120 Z"/></svg>
            </div>
            <p class="pied-mono">{{ monogramme(m) }}</p>
            <p class="pied-noms">{{ m.nomsCouple }}</p>
            @if (m.dateMariage) { <p class="pied-date">{{ formaterDate(m.dateMariage) }}</p> }
          </footer>

          <!-- ───── Barre RSVP collante (mobile) ───── -->
          <nav class="barre-rsvp" [class.visible]="barreVisible()" aria-label="Réservation">
            <span class="barre-texte">
              <span class="barre-mono">{{ monogramme(m) }}</span>
              @if (m.dateMariage) { <span class="barre-date">{{ dateCourte(m.dateMariage) }}</span> }
            </span>
            <a [routerLink]="['/m', m.slug, 'rsvp']" class="bouton bouton--plein bouton--compact">Je confirme</a>
          </nav>
        }
      </div>
    } @else if (introuvable()) {
      <div class="scene introuvable">
        <p>Ce mariage n'existe pas ou n'est plus accessible.</p>
      </div>
    } @else {
      <div class="scene chargement"><span class="loader" aria-label="Chargement"></span></div>
    }
  `,
  styles: [`
    /* ════════════════════════════════════════════════════════════
       MOBILE FIRST : les styles de base visent un téléphone (360–430 px).
       Les @media (min-width) n'ajoutent que des améliorations pour
       tablette et ordinateur.
       ════════════════════════════════════════════════════════════ */

    :host {
      display: block;
      --police-affichage-defaut: 'Cormorant Garamond', Georgia, serif;
      --police-script: 'Pinyon Script', 'Great Vibes', cursive;
      --police-texte-defaut: 'Montserrat', system-ui, sans-serif;
    }
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    p, h1, h2, h3, figure { margin: 0; }
    img { display: block; max-width: 100%; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

    .scene {
      --affichage: var(--police-affichage, var(--police-affichage-defaut));
      --texte: var(--police-texte, var(--police-texte-defaut));
      --encre-douce: color-mix(in srgb, var(--couleur-texte) 74%, transparent);
      --bordure: color-mix(in srgb, var(--couleur-primaire) 25%, transparent);
      --voile: color-mix(in srgb, var(--couleur-primaire) 7%, var(--couleur-fond));
      --or: linear-gradient(135deg, color-mix(in srgb, var(--couleur-tertiaire) 70%, #fff) 0%, var(--couleur-secondaire) 55%, color-mix(in srgb, var(--couleur-secondaire) 70%, #000) 100%);
      --gouttiere: 16px;
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      background: var(--couleur-fond, #fbf8f1);
      color: var(--couleur-texte, #22324a);
      font-family: var(--texte);
      font-size: 16px;
      line-height: 1.7;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
    }

    .introuvable, .chargement { justify-content: center; color: var(--encre-douce); padding: 2rem; text-align: center; }
    .loader { width: 34px; height: 34px; border: 2px solid #d9e2ec; border-top-color: #5e86ae; border-radius: 50%; animation: tourner 900ms linear infinite; }
    @keyframes tourner { to { transform: rotate(360deg); } }

    /* ---------- Communs ---------- */
    .surtitre {
      font-size: .68rem;
      letter-spacing: .3em;
      text-transform: uppercase;
      color: var(--couleur-secondaire);
      margin-bottom: .5rem;
    }
    .entete { text-align: center; margin-bottom: 2.5rem; }
    .entete h2, .dress h2 { font-family: var(--affichage); font-weight: 400; font-size: 2.3rem; line-height: 1.1; }
    .separateur { display: flex; justify-content: center; align-items: center; gap: .6rem; color: var(--couleur-secondaire); margin-top: 1rem; }
    .separateur::before, .separateur::after { content: ''; width: 40px; height: 1px; background: currentColor; opacity: .45; }
    .separateur .losange { width: 6px; height: 6px; background: currentColor; transform: rotate(45deg); }

    .bouton {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: .55rem;
      min-height: 52px;            /* cible tactile confortable */
      padding: 0 1.75rem;
      border-radius: 999px;
      font-family: var(--texte);
      font-size: .78rem;
      font-weight: 600;
      letter-spacing: .14em;
      text-transform: uppercase;
      text-decoration: none;
      white-space: nowrap;
      cursor: pointer;
      transition: transform 150ms ease, box-shadow 200ms ease, background 200ms ease;
    }
    .bouton:active { transform: scale(.97); }
    .bouton svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }
    .bouton--plein {
      color: #fff;
      border: none;
      background: var(--couleur-secondaire);
      box-shadow: 0 8px 22px color-mix(in srgb, var(--couleur-secondaire) 35%, transparent);
    }
    .bouton--contour {
      color: var(--couleur-texte);
      background: color-mix(in srgb, #fff 70%, transparent);
      border: 1px solid var(--bordure);
    }
    .bouton--compact { min-height: 44px; padding: 0 1.25rem; font-size: .72rem; }
    .bouton--reflet { position: relative; overflow: hidden; }
    .bouton--reflet::after {
      content: '';
      position: absolute; top: 0; left: -60%;
      width: 40%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent);
      transform: skewX(-20deg);
      animation: reflet 3.5s ease-in-out infinite;
    }
    @keyframes reflet { 0%, 60% { left: -60%; } 100% { left: 130%; } }

    /* Révélation au scroll */
    [data-reveal] { opacity: 0; transform: translateY(24px); transition: opacity 800ms ease, transform 800ms cubic-bezier(.2,.7,.2,1); }
    [data-reveal].visible { opacity: 1; transform: none; }

    .anim { animation: monter 900ms cubic-bezier(.2,.7,.2,1) both; animation-delay: calc(var(--d) * 140ms + 100ms); }
    @keyframes monter { from { opacity: 0; transform: translateY(18px); filter: blur(3px); } to { opacity: 1; transform: none; filter: none; } }
    @keyframes fondu { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

    /* ---------- Musique ---------- */
    .musique {
      position: fixed; z-index: 70;
      top: max(14px, env(safe-area-inset-top)); right: max(14px, env(safe-area-inset-right));
      width: 46px; height: 46px; border-radius: 50%; padding: 0;
      display: grid; place-items: center; cursor: pointer;
      border: 1px solid color-mix(in srgb, var(--couleur-tertiaire) 70%, transparent);
      background: color-mix(in srgb, var(--couleur-fond) 82%, transparent);
      -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
      color: var(--couleur-primaire);
      box-shadow: 0 8px 22px -12px rgba(34, 50, 74, .55);
      transition: transform .2s ease, background .2s ease;
    }
    .musique:active { transform: scale(.94); }
    .musique svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
    .musique .barre-coupe { stroke: var(--couleur-secondaire); }
    .musique--joue { background: var(--couleur-primaire); border-color: var(--couleur-primaire); color: #fff; }
    /* invitation ouverte sans son : une onde douce invite à toucher */
    .musique--appel::after {
      content: ''; position: absolute; inset: -1px; border-radius: 50%;
      border: 1px solid var(--couleur-tertiaire);
      animation: musique-onde 2.4s ease-out infinite;
    }
    @keyframes musique-onde { to { transform: scale(1.7); opacity: 0; } }
    .musique-barres { display: flex; align-items: flex-end; gap: 3px; height: 16px; }
    .musique-barres i { display: block; width: 3px; height: 100%; border-radius: 2px; background: currentColor; transform-origin: bottom; animation: musique-barre 1s ease-in-out infinite alternate; }
    .musique-barres i:nth-child(2) { animation-delay: -.4s; animation-duration: .8s; }
    .musique-barres i:nth-child(3) { animation-delay: -.7s; animation-duration: 1.15s; }
    .musique-barres i:nth-child(4) { animation-delay: -.2s; animation-duration: .9s; }
    @keyframes musique-barre { from { transform: scaleY(.25); } to { transform: scaleY(1); } }
    @media (prefers-reduced-motion: reduce) {
      .musique-barres i, .musique--appel::after { animation: none; }
      .musique-barres i { transform: scaleY(.7); }
    }

    /* ---------- Écran enveloppe ---------- */
    /* Chronologie : cachet (0,4 s) → rabat (0,35–1,25 s) → lettre qui sort (1,15–2,45 s)
       → lecture (~3 s) → fondu (0,7 s). Le bouton « Découvrir » permet d'abréger. */
    .ecran-enveloppe {
      position: relative;
      min-height: 100vh;
      min-height: 100dvh;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 2rem var(--gouttiere);
      text-align: center;
      overflow: hidden;
      background: radial-gradient(circle at 50% 25%, color-mix(in srgb, var(--couleur-primaire) 16%, var(--couleur-fond)), var(--couleur-fond) 70%);
    }
    .ecran-enveloppe.fondu { opacity: 0; transition: opacity 700ms ease; pointer-events: none; }

    .eyebrow { font-size: .72rem; letter-spacing: .3em; text-transform: uppercase; color: var(--couleur-secondaire); animation: fondu 1s ease both; }
    .monogramme-titre { font-family: var(--police-script); font-size: 3.2rem; line-height: 1.2; color: var(--couleur-primaire); margin-bottom: 1rem; animation: fondu 1s .2s ease both; }
    .ouverture .eyebrow, .ouverture .monogramme-titre, .ouverture .indice {
      animation: none;
      opacity: 0;
      transition: opacity 500ms ease;
    }

    .enveloppe {
      --l: min(350px, 88vw);
      --papier: color-mix(in srgb, var(--couleur-primaire) 9%, #fffdf8);
      --papier-ombre: color-mix(in srgb, var(--couleur-primaire) 20%, #f4efe4);
      --filet: color-mix(in srgb, var(--couleur-tertiaire) 85%, var(--couleur-secondaire) 15%);
      position: relative;
      width: var(--l);
      aspect-ratio: 16 / 10.4;
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      font: inherit;
      perspective: 900px;
      animation: flotter 4.5s ease-in-out infinite, fondu 1s .4s ease both;
      transition: transform 1s cubic-bezier(.2,.7,.2,1) .3s;
    }
    .enveloppe:disabled { cursor: default; animation: none; }
    /* L'enveloppe descend un peu pour laisser la place à la lettre */
    .ouverture .enveloppe { transform: translateY(45%); }
    @keyframes flotter { 0%,100% { transform: translateY(0) rotate(-.4deg); } 50% { transform: translateY(-8px) rotate(.4deg); } }

    /* Corps : papier vergé + rabats latéraux et rabat du bas */
    .corps {
      position: absolute; inset: 0; z-index: 2;
      border-radius: 6px;
      background:
        repeating-linear-gradient(90deg, transparent 0 3px, rgba(255,255,255,.22) 3px 4px),
        linear-gradient(160deg, #fff 0%, var(--papier) 45%, var(--papier-ombre) 100%);
      box-shadow:
        0 1px 0 rgba(255,255,255,.9) inset,
        0 26px 50px -18px color-mix(in srgb, var(--couleur-texte) 38%, transparent),
        0 6px 14px -6px color-mix(in srgb, var(--couleur-texte) 20%, transparent);
      overflow: hidden;
    }
    /* rabats latéraux */
    .corps::before {
      content: ''; position: absolute; inset: 0;
      background:
        linear-gradient(to top right, transparent calc(50% - .5px), color-mix(in srgb, var(--couleur-primaire) 22%, transparent) 50%, transparent calc(50% + 2px)) left / 50% 100% no-repeat,
        linear-gradient(to top left, transparent calc(50% - .5px), color-mix(in srgb, var(--couleur-primaire) 22%, transparent) 50%, transparent calc(50% + 2px)) right / 50% 100% no-repeat;
    }
    /* rabat du bas, légèrement plus clair, avec un filet doré */
    .corps::after {
      content: ''; position: absolute; inset: 0;
      clip-path: polygon(0 100%, 0 99%, 50% 42%, 100% 99%, 100% 100%);
      background:
        linear-gradient(to top, color-mix(in srgb, #fff 55%, var(--papier)), var(--papier));
      filter: drop-shadow(0 -1px 0 var(--filet));
    }

    /* Rabat du haut : triangle à pointe adoucie, bordé d'un filet doré */
    .rabat {
      position: absolute; top: 0; left: 0; z-index: 3;
      width: 100%; height: 62%;
      clip-path: polygon(0 0, 100% 0, 54% 94%, 50% 100%, 46% 94%);
      background: var(--filet);
      transform-origin: top center;
      transition: transform 900ms cubic-bezier(.4,0,.2,1) .35s, z-index 0s .8s;
      filter: drop-shadow(0 4px 6px rgba(0,0,0,.12));
    }
    .rabat::before {
      content: ''; position: absolute; inset: 0 1.5px 2.5px;
      clip-path: polygon(0 0, 100% 0, 54% 94%, 50% 100%, 46% 94%);
      background:
        radial-gradient(120% 90% at 50% 0%, #fff 0%, transparent 60%),
        linear-gradient(to bottom, var(--papier), var(--papier-ombre));
    }
    .ouverture .rabat { transform: rotateX(180deg); z-index: 0; }

    /* Petit bouquet glissé dans le coin */
    .enveloppe-fleurs {
      position: absolute; z-index: 5;
      width: 40%; left: -8%; top: -17%;
      pointer-events: none;
      transform: rotate(-6deg);
      filter: drop-shadow(0 6px 8px rgba(0,0,0,.08));
      transition: opacity 500ms ease, transform 700ms ease;
    }
    .ouverture .enveloppe-fleurs { opacity: 0; transform: rotate(-18deg) translate(-12px, -12px); }

    .lettre {
      position: absolute; left: 6%; right: 6%; top: 6%; bottom: 6%; z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      gap: .15rem;
      padding: .85rem .6rem 0;
      background:
        linear-gradient(180deg, #fff, color-mix(in srgb, var(--couleur-tertiaire) 10%, #fff));
      border-radius: 3px;
      box-shadow: 0 -4px 18px rgba(0,0,0,.08);
      transition: transform 1300ms cubic-bezier(.2,.7,.2,1) 1.15s;
    }
    .lettre::before {
      content: '';
      position: absolute; inset: 5px;
      border: 1px solid color-mix(in srgb, var(--couleur-tertiaire) 45%, transparent);
      border-radius: 2px;
      pointer-events: none;
    }
    .ouverture .lettre { transform: translateY(-97%); }
    .lettre-surtitre { font-size: .54rem; letter-spacing: .32em; text-transform: uppercase; color: var(--couleur-secondaire); }
    .lettre-noms { font-family: var(--police-script); font-size: 1.35rem; line-height: 1.15; padding: 0 .4rem; color: var(--couleur-primaire); }
    .lettre-date { font-family: var(--affichage); font-style: italic; font-size: .98rem; color: var(--couleur-texte); }
    .lettre-lieu { font-size: .52rem; letter-spacing: .28em; text-transform: uppercase; color: var(--encre-douce); }

    /* Cachet de cire : bord irrégulier, anneau gravé, initiales en relief */
    .cachet {
      --t: calc(var(--l) * .26);
      position: absolute; left: 50%; top: 52%; z-index: 4;
      width: var(--t); height: var(--t);
      margin: calc(var(--t) / -2) 0 0 calc(var(--t) / -2);
      display: grid; place-items: center;
      transition: transform 450ms ease, opacity 450ms ease;
      animation: pulser 2.6s ease-in-out infinite;
      border-radius: 50%;
    }
    .cachet-cire {
      position: absolute; inset: 0;
      border-radius: 47% 53% 49% 51% / 52% 47% 53% 48%;
      background:
        radial-gradient(circle at 34% 28%, color-mix(in srgb, var(--couleur-secondaire) 55%, #fff) 0%, transparent 38%),
        radial-gradient(circle at 50% 50%, var(--couleur-secondaire) 0%, color-mix(in srgb, var(--couleur-secondaire) 78%, #000) 100%);
      box-shadow:
        0 6px 12px -2px color-mix(in srgb, var(--couleur-secondaire) 55%, #000 10%),
        inset 0 -3px 6px rgba(0,0,0,.25),
        inset 0 2px 3px rgba(255,255,255,.3);
    }
    /* coulures de cire autour */
    .cachet-cire::before {
      content: ''; position: absolute; inset: -6%;
      z-index: -1;
      border-radius: 58% 42% 55% 45% / 45% 58% 42% 55%;
      background: color-mix(in srgb, var(--couleur-secondaire) 88%, #000);
      opacity: .9;
    }
    /* anneau embossé */
    .cachet-cire::after {
      content: ''; position: absolute; inset: 12%;
      border-radius: 50%;
      box-shadow:
        inset 0 2px 3px rgba(0,0,0,.35),
        inset 0 -1px 1px rgba(255,255,255,.25),
        0 1px 0 rgba(255,255,255,.18);
      background: radial-gradient(circle at 40% 35%, color-mix(in srgb, var(--couleur-secondaire) 85%, #fff), var(--couleur-secondaire) 70%);
    }
    .cachet-texte {
      position: relative;
      display: flex; flex-direction: column; align-items: center;
      line-height: .95;
      font-family: var(--affichage); font-weight: 600;
      color: color-mix(in srgb, var(--couleur-secondaire) 45%, #fff);
      text-shadow: 0 -1px 0 rgba(0,0,0,.35), 0 1px 0 rgba(255,255,255,.25);
    }
    .cachet-texte span { font-size: calc(var(--t) * .22); letter-spacing: .06em; }
    .cachet-texte em { font-style: italic; font-weight: 500; font-size: calc(var(--t) * .15); margin: .05em 0 .02em; opacity: .9; }
    @keyframes pulser {
      0%,100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--couleur-secondaire) 35%, transparent); }
      50% { box-shadow: 0 0 0 16px transparent; }
    }
    .ouverture .cachet { transform: scale(0) rotate(-90deg); opacity: 0; animation: none; }
    .indice { font-size: .8rem; color: var(--encre-douce); margin-top: 1rem; animation: fondu 1s .8s ease both, clignoter 2.6s 2s ease-in-out infinite; }
    @keyframes clignoter { 0%,100% { opacity: .55; } 50% { opacity: 1; } }

    .passer {
      position: absolute;
      left: 50%; bottom: max(2rem, env(safe-area-inset-bottom));
      transform: translate(-50%, 10px);
      display: inline-flex; align-items: center; gap: .5rem;
      min-height: 48px;
      padding: 0 1.4rem;
      border-radius: 999px;
      border: 1px solid var(--bordure);
      background: color-mix(in srgb, #fff 75%, transparent);
      color: var(--couleur-texte);
      font-family: var(--texte); font-size: .72rem; font-weight: 600; letter-spacing: .14em; text-transform: uppercase;
      opacity: 0;
      pointer-events: none;
      cursor: pointer;
      transition: opacity 500ms ease, transform 500ms ease;
      z-index: 5;
    }
    .passer svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .ouverture .passer { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; transition-delay: 2.4s; }
    .fondu .passer { opacity: 0; transition-delay: 0s; }

    /* ---------- Vagues ---------- */
    .vagues { position: absolute; left: 0; right: 0; bottom: -1px; height: 60px; overflow: hidden; pointer-events: none; }
    .vagues svg { position: absolute; bottom: 0; left: 0; width: 200%; height: 100%; }
    .vague--1 { fill: var(--voile); animation: houle 16s linear infinite; }
    @keyframes houle { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    .vagues--accueil svg { width: 100%; fill: color-mix(in srgb, var(--couleur-primaire) 14%, var(--couleur-fond)); animation: respirer 6s ease-in-out infinite; transform-origin: bottom; }
    @keyframes respirer { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(1.35); } }

    /* ════════════ ÉCRAN D'OUVERTURE ════════════ */
    .ouv {
      --bronze: linear-gradient(176deg,
        color-mix(in srgb, var(--couleur-tertiaire) 80%, #fff) 0%,
        color-mix(in srgb, var(--couleur-tertiaire) 55%, var(--couleur-texte)) 48%,
        color-mix(in srgb, var(--couleur-secondaire) 35%, var(--couleur-texte)) 100%);
      position: relative;
      width: 100%;
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: max(1.5rem, env(safe-area-inset-top)) var(--gouttiere) 6rem;
      overflow: hidden;
      background: var(--couleur-fond);
    }
    .ouv-photo {
      position: absolute;
      left: 50%; top: 54%;
      width: min(150vw, 820px);
      aspect-ratio: 1;
      translate: -50% -50%;
      -webkit-mask-image: radial-gradient(circle at 50% 50%, #000 30%, transparent 68%);
              mask-image: radial-gradient(circle at 50% 50%, #000 30%, transparent 68%);
      animation: ouv-photo 2.6s ease-out both;
    }
    .ouv-photo img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 28%; filter: saturate(.65) sepia(.2) brightness(1.1) contrast(.85); opacity: .42; }
    @keyframes ouv-photo { from { opacity: 0; scale: 1.12; } to { opacity: 1; scale: 1; } }
    .ouv-voile {
      position: absolute; inset: 0;
      background:
        radial-gradient(ellipse 70% 42% at 50% 46%, color-mix(in srgb, var(--couleur-fond) 62%, transparent), transparent 75%),
        linear-gradient(180deg, var(--couleur-fond) 0%, color-mix(in srgb, var(--couleur-fond) 25%, transparent) 26%, color-mix(in srgb, var(--couleur-fond) 15%, transparent) 72%, var(--couleur-fond) 100%);
    }
    .ouv-contenu { position: relative; z-index: 2; width: 100%; max-width: 560px; }

    .a2 { animation: monter 1.1s cubic-bezier(.2,.7,.2,1) both; animation-delay: var(--t); }

    .ouv-mono {
      font-family: var(--police-script);
      font-size: 2rem;
      line-height: 1.2;
      background: var(--bronze);
      -webkit-background-clip: text; background-clip: text; color: transparent;
      margin-bottom: 2.4rem;
    }
    .ouv-lieu {
      display: flex; align-items: center; justify-content: center; gap: .75rem;
      font-family: var(--affichage);
      font-size: .7rem;
      letter-spacing: .34em;
      text-transform: uppercase;
      color: color-mix(in srgb, var(--couleur-texte) 70%, var(--couleur-tertiaire));
    }
    .diamant { flex: none; width: 5px; height: 5px; background: var(--couleur-tertiaire); transform: rotate(45deg); }

    .ouv-noms { display: flex; flex-direction: column; align-items: center; margin-top: 1.4rem; font-weight: 400; }
    .ouv-prenom {
      font-family: var(--police-script);
      font-size: clamp(2.6rem, 12vw, 5.6rem);   /* prénoms composés : reste sur une ligne */
      line-height: 1.2;
      padding: 0 .3em;
      background: var(--bronze);
      -webkit-background-clip: text; background-clip: text; color: transparent;
      filter: drop-shadow(0 2px 2px color-mix(in srgb, var(--couleur-texte) 22%, transparent));
      /* Effet « écrit à la plume » : révélation de gauche à droite */
      clip-path: inset(-40% 100% -40% -15%);
      animation: ecrire 1.7s cubic-bezier(.55,.1,.3,1) forwards;
    }
    .ouv-prenom--1 { animation-delay: .8s; }
    .ouv-prenom--2 { animation-delay: 2.1s; }
    @keyframes ecrire { to { clip-path: inset(-40% -15% -40% -15%); } }

    .anneaux {
      width: 62px; height: 34px;
      margin: .1rem 0;
      fill: none;
      stroke: var(--couleur-tertiaire);
      stroke-width: 1.4;
      opacity: 0;
      animation: anneaux 900ms 1.7s cubic-bezier(.3,1.5,.5,1) forwards;
    }
    .anneaux-feuille { fill: color-mix(in srgb, #7d9264 55%, transparent); stroke: none; }
    .anneaux-pierre { fill: #fff; stroke-width: 1; }
    @keyframes anneaux { from { opacity: 0; transform: scale(.3) rotate(-30deg); } to { opacity: 1; transform: none; } }

    .ouv-filet {
      display: flex; align-items: center; justify-content: center; gap: .5rem;
      width: min(78%, 300px);
      margin: 1.8rem auto 1.7rem;
      color: var(--couleur-tertiaire);
    }
    .ouv-filet span { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, currentColor); transform: scaleX(0); transform-origin: right; animation: filet 1s 3.3s ease forwards; }
    .ouv-filet span:last-child { background: linear-gradient(90deg, currentColor, transparent); transform-origin: left; }
    .ouv-filet svg { width: 40px; height: 12px; fill: none; stroke: currentColor; stroke-width: 1.2; opacity: 0; animation: monter 800ms 3.2s ease forwards; }
    .ouv-filet circle { fill: currentColor; }
    @keyframes filet { to { transform: scaleX(1); } }

    .ouv-date {
      display: grid;
      grid-template-columns: 1fr auto auto auto 1fr;
      align-items: center;
      gap: .85rem;
      opacity: 0;
      animation: monter 1s 3.6s cubic-bezier(.2,.7,.2,1) forwards;
    }
    .ouv-date-cote--g { text-align: right; }
    .ouv-date-cote--d { text-align: left; }
    .ouv-date-etiquette { display: block; font-size: .56rem; letter-spacing: .3em; text-transform: uppercase; color: var(--encre-douce); margin-bottom: .1rem; }
    .ouv-date-texte { display: block; font-family: var(--affichage); font-style: italic; font-size: 1.3rem; line-height: 1.2; color: var(--couleur-texte); }
    .ouv-date-cote--g .ouv-date-texte::first-letter { text-transform: uppercase; }
    .ouv-date-barre { width: 1px; height: 56px; background: linear-gradient(transparent, var(--couleur-tertiaire), transparent); }
    .ouv-date-jour {
      font-family: var(--affichage);
      font-size: 3.6rem;
      line-height: 1;
      font-variant-numeric: oldstyle-nums;
      background: var(--bronze);
      -webkit-background-clip: text; background-clip: text; color: transparent;
    }

    .ouv-defiler {
      position: absolute;
      left: 50%; bottom: max(1.5rem, env(safe-area-inset-bottom));
      translate: -50% 0;
      z-index: 3;
      display: flex; flex-direction: column; align-items: center; gap: .1rem;
      min-height: 48px;
      background: none; border: none;
      font-family: var(--affichage); font-size: .64rem; letter-spacing: .3em; text-transform: uppercase;
      color: var(--encre-douce);
      cursor: pointer;
      opacity: 0;
      animation: monter 1s 4.2s ease forwards;
    }
    .ouv-defiler svg { width: 20px; height: 20px; fill: none; stroke: var(--couleur-texte); stroke-width: 1.5; animation: descendre 1.8s ease-in-out infinite; }

    .papillons { position: absolute; inset: 0; z-index: 3; pointer-events: none; }
    .papillon {
      position: absolute;
      width: 30px;
      animation-name: voleter;
      animation-timing-function: ease-in-out;
      animation-iteration-count: infinite;
      animation-direction: alternate;
    }
    .papillon svg { width: 100%; height: auto; overflow: visible; }
    .papillon .aile { transform-origin: 20px 15px; animation: battre-ailes 260ms ease-in-out infinite alternate; }
    .papillon--chaud .aile { fill: color-mix(in srgb, var(--couleur-tertiaire) 70%, var(--couleur-secondaire)); }
    .papillon--froid .aile { fill: color-mix(in srgb, var(--couleur-primaire) 75%, #fff); }
    .papillon-corps { stroke: color-mix(in srgb, var(--couleur-texte) 80%, transparent); stroke-width: 1.6; stroke-linecap: round; }
    @keyframes battre-ailes { from { transform: scaleX(1); } to { transform: scaleX(.25); } }
    @keyframes voleter {
      0% { transform: translate(0, 0) rotate(-8deg); }
      25% { transform: translate(40px, -30px) rotate(10deg); }
      50% { transform: translate(90px, -10px) rotate(-6deg); }
      75% { transform: translate(60px, 30px) rotate(12deg); }
      100% { transform: translate(120px, -40px) rotate(-4deg); }
    }

    /* ════════════ CARTE SAVE THE DATE ════════════ */
    .std {
      position: relative;
      width: 100%;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2.5rem var(--gouttiere) 2rem;
      background: radial-gradient(ellipse at 50% 30%, color-mix(in srgb, var(--couleur-tertiaire) 20%, var(--couleur-fond)), var(--couleur-fond) 70%);
      overflow: hidden;
    }

    .carte {
      position: relative;
      z-index: 2;
      width: 100%;
      max-width: 420px;
      padding: 1.5rem 1.1rem 1.6rem;
      text-align: center;
      border-radius: 6px;
      border: 1px solid color-mix(in srgb, var(--couleur-tertiaire) 55%, transparent);
      background:
        radial-gradient(ellipse at 50% 0%, #fff 0%, transparent 60%),
        linear-gradient(180deg, color-mix(in srgb, var(--couleur-fond) 70%, #fff), color-mix(in srgb, var(--couleur-tertiaire) 14%, var(--couleur-fond)));
      box-shadow:
        0 1px 0 #fff inset,
        0 24px 50px -18px color-mix(in srgb, var(--couleur-texte) 30%, transparent),
        0 6px 16px -8px color-mix(in srgb, var(--couleur-tertiaire) 60%, transparent);
    }
    /* Double filet intérieur */
    .carte::before {
      content: '';
      position: absolute; inset: 7px;
      border: 1px solid color-mix(in srgb, var(--couleur-tertiaire) 35%, transparent);
      border-radius: 3px;
      pointer-events: none;
    }

    .coin { position: absolute; width: 46px; height: 46px; fill: none; stroke: var(--couleur-tertiaire); stroke-width: 1.1; opacity: .85; }
    .coin circle { fill: var(--couleur-tertiaire); stroke: none; }
    .coin--hg { top: 4px; left: 4px; transform: rotate(-90deg) scaleX(-1) rotate(-90deg); }
    .coin--hd { top: 4px; right: 4px; transform: rotate(180deg); }
    .coin--bg { bottom: 4px; left: 4px; }
    .coin--bd { bottom: 4px; right: 4px; transform: scaleX(-1); }

    .carte-visuel { display: flex; justify-content: center; margin-bottom: .2rem; }
    .carte-visuel img { width: 160px; height: auto; }
    .illustration { width: 150px; height: auto; overflow: visible; }

    /* Couleurs de l'illustration : tirées du thème */
    .st-robe-1 { stop-color: #fffdf9; }
    .st-robe-2 { stop-color: color-mix(in srgb, var(--couleur-fond) 80%, var(--couleur-tertiaire)); }
    .st-robe-3 { stop-color: color-mix(in srgb, var(--couleur-tertiaire) 70%, var(--couleur-fond)); }
    .st-pli { stop-color: color-mix(in srgb, var(--couleur-tertiaire) 80%, var(--couleur-texte)); }
    .st-costume-1 { stop-color: color-mix(in srgb, var(--couleur-texte) 75%, var(--couleur-primaire)); }
    .st-costume-2 { stop-color: color-mix(in srgb, var(--couleur-texte) 92%, #000); }
    .ill-lavis { fill: color-mix(in srgb, var(--couleur-tertiaire) 30%, transparent); }
    .ill-ombre { fill: color-mix(in srgb, var(--couleur-tertiaire) 45%, transparent); }
    .ill-costume-fonce { fill: color-mix(in srgb, var(--couleur-texte) 88%, #000); }
    .ill-costume-manche { fill: none; stroke: color-mix(in srgb, var(--couleur-texte) 85%, var(--couleur-primaire)); stroke-width: 10; stroke-linecap: round; }
    .ill-pli-veste { stroke: color-mix(in srgb, #000 30%, transparent); stroke-width: 1; }
    .ill-chaussure { fill: #2a1d16; }
    .ill-col { fill: #fff; }
    .ill-peau { fill: #6b4430; }
    .ill-bras { fill: none; stroke: #6b4430; stroke-width: 5.5; stroke-linecap: round; }
    .ill-cheveux { fill: #1e1612; }
    .ill-robe-haut { fill: #fffdf9; stroke: color-mix(in srgb, var(--couleur-tertiaire) 60%, transparent); stroke-width: .6; }
    .ill-ceinture { fill: color-mix(in srgb, var(--couleur-tertiaire) 75%, #fff); }
    .ill-pli { fill: none; stroke: color-mix(in srgb, var(--couleur-tertiaire) 55%, transparent); stroke-width: .8; }
    .ill-reflet { fill: none; stroke: color-mix(in srgb, #fff 18%, transparent); stroke-width: 1.4; stroke-linecap: round; }
    .ill-voile { fill: color-mix(in srgb, #fff 82%, transparent); stroke: color-mix(in srgb, var(--couleur-tertiaire) 35%, transparent); stroke-width: .5; }
    .ill-tige { stroke: #6c7f56; stroke-width: 1; }
    .ill-feuille { fill: #7d9264; }
    .ill-fleur-1 { fill: var(--couleur-secondaire); }
    .ill-fleur-2 { fill: #fffaf0; stroke: color-mix(in srgb, var(--couleur-tertiaire) 70%, transparent); stroke-width: .6; }
    .ill-fleur-3 { fill: var(--couleur-primaire); }
    .ill-fleur-4 { fill: color-mix(in srgb, var(--couleur-secondaire) 55%, #fff); }
    .ill-petale { fill: color-mix(in srgb, var(--couleur-secondaire) 65%, #fff); opacity: .8; }
    .ill-petale--1 { animation: petale-ill 7s ease-in-out infinite; }
    .ill-petale--2 { animation: petale-ill 9s 2s ease-in-out infinite reverse; }
    @keyframes petale-ill { 0%,100% { translate: 0 0; rotate: 0deg; } 50% { translate: -6px 14px; rotate: 50deg; } }

    .std-titre {
      font-family: var(--police-script);
      font-weight: 400;
      font-size: 3rem;
      line-height: 1.25;
      padding: 0 .2em;
      background: var(--or);
      -webkit-background-clip: text;
              background-clip: text;
      color: transparent;
      filter: drop-shadow(0 1px 0 rgba(255,255,255,.8));
    }
    .std-mois {
      margin-top: .35rem;
      font-family: var(--affichage);
      font-size: .9rem;
      letter-spacing: .35em;
      text-transform: uppercase;
      color: color-mix(in srgb, var(--couleur-texte) 75%, var(--couleur-secondaire));
    }
    .filet {
      display: block;
      height: 1px;
      margin: .9rem auto;
      width: 86%;
      background: linear-gradient(90deg, transparent, var(--couleur-tertiaire), transparent);
    }

    .calendrier {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      row-gap: .35rem;
      padding: 0 .1rem;
    }
    .cal-entete {
      font-family: var(--affichage);
      font-size: .62rem;
      letter-spacing: .14em;
      text-transform: uppercase;
      color: color-mix(in srgb, var(--couleur-texte) 45%, transparent);
      padding-bottom: .35rem;
    }
    .cal-jour {
      display: grid;
      place-items: center;
      height: 36px;
      font-family: var(--affichage);
      font-style: italic;
      font-size: 1rem;
      color: color-mix(in srgb, var(--couleur-texte) 82%, transparent);
      opacity: 0;
    }
    .carte.visible .cal-jour {
      animation: pop 450ms cubic-bezier(.3,1.5,.5,1) both;
      animation-delay: calc(var(--i) * 18ms + 350ms);
    }
    @keyframes pop { from { opacity: 0; transform: scale(.4); } to { opacity: 1; transform: none; } }
    .cal-jour--grand {
      position: relative;
      width: 40px; height: 40px;
      margin: -2px auto;
      border-radius: 50%;
      background: var(--or);
      box-shadow: 0 0 0 3px color-mix(in srgb, #fff 80%, transparent), 0 4px 14px color-mix(in srgb, var(--couleur-secondaire) 45%, transparent);
    }
    .carte.visible .cal-jour--grand {
      animation: pop 600ms cubic-bezier(.3,1.6,.5,1) both, halo 2.2s ease-in-out infinite;
      animation-delay: 1.1s, 1.7s;
    }
    .cal-jour--grand svg { width: 18px; height: 18px; fill: #fff; animation: battre 1.4s 1.8s ease-in-out infinite; }
    @keyframes halo {
      0%,100% { box-shadow: 0 0 0 3px rgba(255,255,255,.8), 0 4px 14px color-mix(in srgb, var(--couleur-secondaire) 45%, transparent), 0 0 0 0 color-mix(in srgb, var(--couleur-secondaire) 35%, transparent); }
      50% { box-shadow: 0 0 0 3px rgba(255,255,255,.8), 0 4px 14px color-mix(in srgb, var(--couleur-secondaire) 45%, transparent), 0 0 0 12px transparent; }
    }
    @keyframes battre { 0%,100% { transform: scale(1); } 15% { transform: scale(1.22); } 30% { transform: scale(1); } 45% { transform: scale(1.12); } }

    .std-noms {
      font-family: var(--police-script);
      font-size: 2.3rem;
      line-height: 1.3;
      padding: 0 .2em;
      background: var(--or);
      -webkit-background-clip: text;
              background-clip: text;
      color: transparent;
    }
    .std-lieu { margin-top: .2rem; font-size: .68rem; letter-spacing: .25em; text-transform: uppercase; color: var(--encre-douce); }

    .actions {
      position: relative; z-index: 2;
      width: 100%;
      max-width: 420px;
      display: grid;
      gap: .7rem;
      margin-top: 1.4rem;
    }

    .compte {
      position: relative; z-index: 2;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: .5rem;
      width: 100%;
      max-width: 420px;
      margin-top: 1.4rem;
    }
    .compte-bloc {
      display: flex; flex-direction: column; align-items: center;
      padding: .7rem .2rem .55rem;
      border: 1px solid var(--bordure);
      border-radius: 8px;
      background: color-mix(in srgb, #fff 60%, transparent);
    }
    .compte-valeur { font-family: var(--affichage); font-size: 1.75rem; line-height: 1; color: var(--couleur-primaire); font-variant-numeric: tabular-nums; }
    .compte-libelle { font-size: .56rem; letter-spacing: .18em; text-transform: uppercase; opacity: .7; margin-top: .3rem; }
    .aujourdhui { font-family: var(--police-script); font-size: 2rem; color: var(--couleur-secondaire); margin-top: 1.25rem; }

    .defiler {
      position: relative; z-index: 2;
      display: flex; flex-direction: column; align-items: center; gap: .1rem;
      min-height: 48px;
      margin-top: 1.5rem;
      background: none; border: none;
      font-family: var(--texte); font-size: .66rem; letter-spacing: .25em; text-transform: uppercase;
      color: var(--encre-douce);
      cursor: pointer;
    }
    .defiler svg { width: 22px; height: 22px; fill: none; stroke: var(--couleur-secondaire); stroke-width: 1.6; animation: descendre 1.8s ease-in-out infinite; }
    @keyframes descendre { 0%,100% { transform: translateY(0); opacity: .6; } 50% { transform: translateY(5px); opacity: 1; } }

    .petales { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
    .petale {
      position: absolute; top: -30px;
      border-radius: 80% 0 80% 0;
      opacity: .5;
      animation-name: tomber;
      animation-timing-function: linear;
      animation-iteration-count: infinite;
    }
    @keyframes tomber {
      0% { transform: translate3d(0, -5vh, 0) rotate(0deg); opacity: 0; }
      10% { opacity: .55; }
      50% { transform: translate3d(30px, 50vh, 0) rotate(200deg); }
      100% { transform: translate3d(-20px, 105vh, 0) rotate(400deg); opacity: 0; }
    }

    /* ════════════ HISTOIRE ════════════ */
    .histoire {
      position: relative;
      width: 100%;
      padding: 4.5rem var(--gouttiere) 3.5rem;
      background: var(--voile);
    }
    .vagues--haut { top: -59px; bottom: auto; }

    /* Frise verticale à gauche sur mobile */
    .frise { position: relative; max-width: 1040px; margin: 0 auto; padding-left: 2.4rem; }
    .frise::before {
      content: '';
      position: absolute; top: .4rem; bottom: 0; left: .85rem;
      width: 1px;
      background: linear-gradient(to bottom, var(--couleur-tertiaire), color-mix(in srgb, var(--couleur-tertiaire) 20%, transparent));
    }
    .chapitre { position: relative; display: grid; gap: 1.4rem; margin-bottom: 3rem; }
    .frise-point {
      position: absolute;
      left: -2.4rem; top: 0;
      width: 1.75rem; height: 1.75rem;
      display: grid; place-items: center;
      border-radius: 50%;
      background: var(--couleur-fond);
      border: 1px solid var(--couleur-secondaire);
      font-family: var(--affichage);
      font-size: .66rem;
      color: var(--couleur-secondaire);
    }

    .polaroid {
      justify-self: center;
      width: min(100%, 300px);
      padding: .6rem .6rem 0;
      background: #fff;
      box-shadow: 0 14px 34px -12px color-mix(in srgb, var(--couleur-texte) 35%, transparent);
      transform: rotate(-2.5deg);
    }
    .polaroid--droite { transform: rotate(2.5deg); }
    .polaroid.visible { transform: rotate(-2.5deg); }
    .polaroid--droite.visible { transform: rotate(2.5deg); }
    .polaroid img { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; object-position: 50% 30%; }
    .polaroid figcaption { font-family: var(--police-script); font-size: 1.35rem; color: var(--couleur-primaire); text-align: center; padding: .45rem 0 .55rem; }

    .chapitre-numero { font-size: .64rem; letter-spacing: .3em; text-transform: uppercase; color: var(--couleur-secondaire); }
    .chapitre-texte h3 { font-family: var(--affichage); font-weight: 500; font-size: 1.85rem; line-height: 1.15; margin: .2rem 0 .9rem; color: var(--couleur-primaire); }
    .chapitre-lieu { font-family: var(--affichage); font-style: italic; color: var(--couleur-secondaire) !important; margin: -.5rem 0 .9rem !important; }
    .chapitre-texte p { margin-bottom: .95rem; color: var(--encre-douce); white-space: pre-line; font-size: .95rem; }
    .chapitre-texte p.lettrine::first-letter {
      float: left;
      font-family: var(--affichage);
      font-size: 3.1rem;
      line-height: .9;
      padding: .25rem .45rem 0 0;
      color: var(--couleur-secondaire);
    }

    .signature { text-align: center; font-family: var(--police-script); font-size: 2.3rem; color: var(--couleur-primaire); }
    .coeur { display: inline-block; color: var(--couleur-secondaire); font-family: var(--texte); font-size: .55em; animation: battre 1.4s ease-in-out infinite; }

    /* ════════════ PROGRAMME ════════════ */
    .programme { width: 100%; padding: 4rem var(--gouttiere); }
    .evenements { display: grid; gap: 1rem; max-width: 720px; margin: 0 auto; }
    .evenement {
      display: grid;
      grid-template-columns: 76px 1fr;
      gap: 1rem;
      padding: 1.25rem 1.1rem;
      background: #fff;
      border: 1px solid var(--bordure);
      border-radius: 10px;
    }
    .evenement--prive { background: color-mix(in srgb, var(--couleur-tertiaire) 12%, #fff); border-style: dashed; border-color: var(--couleur-tertiaire); }
    .evenement-date { display: flex; flex-direction: column; align-items: center; justify-content: center; border-right: 1px solid var(--bordure); padding-right: .9rem; }
    .evenement-jour { font-family: var(--affichage); font-size: 2.4rem; line-height: 1; color: var(--couleur-secondaire); }
    .evenement-mois { font-size: .58rem; letter-spacing: .1em; text-transform: uppercase; color: var(--encre-douce); text-align: center; line-height: 1.4; }
    .evenement-type { font-size: .6rem; letter-spacing: .26em; text-transform: uppercase; color: var(--couleur-primaire); }
    .evenement-corps h3 { font-family: var(--affichage); font-weight: 500; font-size: 1.4rem; line-height: 1.2; margin: .15rem 0 .45rem; }
    .evenement-heure { font-weight: 600; color: var(--couleur-primaire); font-size: .92rem; }
    .evenement-lieu { color: var(--encre-douce); font-size: .9rem; }
    .evenement-description { margin-top: .45rem; font-family: var(--affichage); font-style: italic; font-size: 1rem; line-height: 1.5; color: var(--encre-douce); }
    .badge-prive {
      display: inline-flex; align-items: center; gap: .4rem;
      padding: .25rem .7rem;
      font-size: .58rem; letter-spacing: .12em; text-transform: uppercase;
      color: var(--couleur-secondaire);
      border: 1px solid currentColor; border-radius: 999px;
    }
    .badge-prive::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

    /* Déroulé de la journée */
    .deroule {
      max-width: 720px;
      margin: 1.5rem auto 0;
      padding: 1.5rem 1.1rem 1.25rem;
      background: #fff;
      border: 1px solid var(--bordure);
      border-radius: 10px;
    }
    .deroule-titre { font-family: var(--affichage); font-weight: 500; font-size: 1.5rem; text-align: center; margin-bottom: 1.25rem; }
    .deroule-liste { list-style: none; margin: 0; padding: 0; position: relative; }
    .deroule-liste::before {
      content: ''; position: absolute; top: .6rem; bottom: .6rem; left: calc(3.6rem + 7px);
      width: 1px; background: color-mix(in srgb, var(--couleur-tertiaire) 70%, transparent);
    }
    .deroule-liste li { display: grid; grid-template-columns: 3.6rem 15px 1fr; column-gap: .8rem; align-items: start; padding: .45rem 0; }
    .deroule.visible .deroule-liste li { animation: monter 500ms cubic-bezier(.2,.7,.2,1) both; animation-delay: calc(var(--i) * 80ms + 150ms); }
    .deroule-heure { font-family: var(--affichage); font-size: 1.15rem; font-weight: 500; color: var(--couleur-secondaire); text-align: right; line-height: 1.5; }
    .deroule-point { position: relative; z-index: 1; width: 15px; height: 15px; margin-top: .3rem; border-radius: 50%; background: #fff; border: 2px solid var(--couleur-tertiaire); }
    .deroule-liste li:nth-child(2) .deroule-point { background: var(--couleur-secondaire); border-color: var(--couleur-secondaire); }
    .deroule-nom { font-weight: 600; font-size: .95rem; line-height: 1.5; }
    .deroule-detail { font-size: .82rem; color: var(--encre-douce); }
    @keyframes monter { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }

    /* ════════════ CARTE ════════════ */
    .carte-lieu { width: 100%; max-width: 720px; padding: 0 var(--gouttiere); }
    .carte-lien {
      position: relative;
      display: grid;
      min-height: 230px;
      border-radius: 14px;
      overflow: hidden;
      text-decoration: none;
      color: inherit;
      border: 1px solid var(--bordure);
      box-shadow: 0 16px 40px -14px color-mix(in srgb, var(--couleur-texte) 25%, transparent);
    }
    .carte-lien:active { transform: scale(.99); }
    .carte-fond {
      position: absolute; inset: 0;
      background:
        linear-gradient(color-mix(in srgb, var(--couleur-primaire) 9%, transparent) 1px, transparent 1px) 0 0 / 26px 26px,
        linear-gradient(90deg, color-mix(in srgb, var(--couleur-primaire) 9%, transparent) 1px, transparent 1px) 0 0 / 26px 26px,
        color-mix(in srgb, var(--couleur-tertiaire) 14%, var(--couleur-fond));
    }
    .carte-eau { position: absolute; right: -15%; bottom: -35%; width: 70%; height: 95%; border-radius: 50%; background: color-mix(in srgb, var(--couleur-primaire) 30%, var(--couleur-fond)); }
    .carte-route { position: absolute; height: 9px; background: #fff; border-radius: 6px; box-shadow: 0 0 0 1px color-mix(in srgb, var(--couleur-tertiaire) 50%, transparent); }
    .carte-route--1 { width: 130%; left: -15%; top: 34%; transform: rotate(-8deg); }
    .carte-route--2 { width: 80%; left: 30%; top: 58%; transform: rotate(24deg); }
    .carte-route--3 { width: 9px; height: 130%; left: 28%; top: -15%; }
    .carte-epingle { position: absolute; left: 50%; top: 14%; width: 34px; margin-left: -17px; z-index: 2; }
    .carte-epingle svg { width: 34px; height: 46px; fill: var(--couleur-secondaire); animation: rebond 2s ease-in-out infinite; filter: drop-shadow(0 6px 6px rgba(0,0,0,.2)); }
    @keyframes rebond { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
    .carte-onde { position: absolute; left: 50%; bottom: -6px; width: 40px; height: 14px; margin-left: -20px; border-radius: 50%; border: 2px solid var(--couleur-secondaire); animation: onde 2s ease-out infinite; }
    @keyframes onde { from { transform: scale(.4); opacity: .9; } to { transform: scale(2.2); opacity: 0; } }
    .carte-infos {
      position: relative; z-index: 2;
      align-self: end;
      display: flex; flex-direction: column; gap: .15rem;
      margin: .75rem;
      padding: 1rem 1.1rem;
      background: color-mix(in srgb, #fff 90%, transparent);
      backdrop-filter: blur(8px);
      border-radius: 10px;
    }
    .carte-infos .surtitre { margin: 0; }
    .carte-nom { font-family: var(--affichage); font-size: 1.35rem; line-height: 1.2; }
    .carte-detail { font-size: .72rem; letter-spacing: .16em; text-transform: uppercase; color: var(--encre-douce); margin-bottom: .2rem; }
    .carte-cta { font-size: .7rem; letter-spacing: .14em; text-transform: uppercase; color: var(--couleur-primaire); font-weight: 600; }

    /* ════════════ PORTRAIT (début de l'histoire) ════════════ */
    .portrait { max-width: 420px; margin: 1.5rem auto 4.5rem; padding: 0 1.4rem; text-align: center; }
    .portrait-cadre { position: relative; }
    .portrait-arche {
      position: relative;
      aspect-ratio: 1004 / 1280;
      border-radius: 999px 999px 22px 22px;
      overflow: hidden;
      box-shadow: 0 30px 60px -30px color-mix(in srgb, var(--couleur-texte) 55%, transparent);
    }
    .portrait-arche img { width: 100%; height: 100%; object-fit: cover; display: block; transform: scale(1.06); transition: transform 1.6s cubic-bezier(.2,.7,.2,1); }
    .portrait.visible .portrait-arche img { transform: scale(1); }
    /* double filet doré décalé, comme un passe-partout */
    .portrait-cadre::before {
      content: '';
      position: absolute; inset: -10px;
      border: 1px solid color-mix(in srgb, var(--couleur-tertiaire) 85%, transparent);
      border-radius: 999px 999px 30px 30px;
      pointer-events: none;
    }
    .portrait-fleurs { position: absolute; pointer-events: none; opacity: 0; transition: opacity 1s ease 400ms, transform 1.2s cubic-bezier(.2,.7,.2,1) 400ms; }
    .portrait-fleurs--haut { width: 52%; left: -16%; top: -7%; transform: translate(-10px, -10px) rotate(-4deg); }
    .portrait-fleurs--bas { width: 46%; right: -14%; bottom: -9%; transform: translate(10px, 10px); }
    .portrait.visible .portrait-fleurs { opacity: 1; transform: none; }
    .portrait figcaption {
      margin-top: 2rem;
      font-family: var(--affichage); font-style: italic; font-size: 1.15rem;
      color: var(--encre-douce);
    }

    /* ════════════ DRESS CODE ════════════ */
    .dress { width: 100%; max-width: 1040px; padding: 4rem var(--gouttiere) 1.5rem; }
    .dress-grille { display: grid; gap: 2.5rem; margin-top: 2.25rem; }
    .dress-visuels { position: relative; width: min(100%, 360px); margin: 0 auto; aspect-ratio: 1 / 1.06; }
    .dress-carte {
      position: absolute;
      padding: 0; border: 0; cursor: zoom-in;
      border-radius: 22px; overflow: hidden;
      background: #fff;
      box-shadow: 0 24px 50px -26px color-mix(in srgb, var(--couleur-texte) 60%, transparent);
      transition: transform 500ms cubic-bezier(.2,.7,.2,1), box-shadow 300ms ease;
    }
    .dress-carte img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .dress-carte:not(.dress-carte--avant) { left: 0; top: 0; width: 68%; height: 74%; transform: rotate(-4deg); }
    .dress-carte--avant { right: 0; bottom: 0; width: 52%; height: 72%; border: 5px solid #fff; transform: rotate(3deg); }
    .dress-carte--avant img { object-position: top center; }   /* jamais coupée en haut */
    .dress-carte:hover, .dress-carte:focus-visible { transform: rotate(0) scale(1.03); z-index: 2; }
    .dress.visible .dress-carte { animation: poser 900ms cubic-bezier(.2,.7,.2,1) both; }
    .dress.visible .dress-carte--avant { animation-delay: 180ms; }
    @keyframes poser { from { opacity: 0; translate: 0 24px; } to { opacity: 1; translate: 0 0; } }

    .dress-bloc { text-align: center; max-width: 440px; margin: 0 auto; }
    .dress-script { font-family: var(--police-script); font-size: 2.6rem; line-height: 1; color: var(--couleur-secondaire); }
    .dress-texte { margin-top: 1rem; color: var(--encre-douce); font-size: .95rem; line-height: 1.7; }
    .dress-tenue { margin-top: .9rem; font-family: var(--affichage); font-style: italic; font-size: 1.1rem; }
    .dress-tenue span { display: block; font-family: var(--texte); font-style: normal; font-size: .62rem; letter-spacing: .2em; text-transform: uppercase; color: var(--couleur-primaire); margin-bottom: .2rem; }
    .nuancier { display: grid; grid-template-columns: repeat(5, 1fr); gap: .35rem; margin-top: 1.75rem; }
    .nuance { display: flex; flex-direction: column; align-items: center; gap: .45rem; }
    .pastille {
      width: 46px; height: 46px; border-radius: 50%;
      border: 3px solid #fff;
      box-shadow: 0 6px 14px rgba(0,0,0,.12), inset 0 -4px 8px rgba(0,0,0,.08);
      transform: scale(0);
    }
    .dress.visible .pastille { animation: eclore 600ms cubic-bezier(.3,1.6,.5,1) forwards; animation-delay: calc(var(--i) * 120ms + 250ms); }
    @keyframes eclore { to { transform: scale(1); } }
    .nuance-nom { font-size: .52rem; letter-spacing: .08em; text-transform: uppercase; color: var(--encre-douce); line-height: 1.3; }

    /* Visionneuse */
    .visionneuse {
      position: fixed; inset: 0; z-index: 80;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem;
      padding: 3.5rem 1rem calc(1.5rem + env(safe-area-inset-bottom));
      background: color-mix(in srgb, var(--couleur-texte) 88%, transparent);
      backdrop-filter: blur(6px);
      animation: fondu-visionneuse 220ms ease both;
    }
    @keyframes fondu-visionneuse { from { opacity: 0; } to { opacity: 1; } }
    .visionneuse img { max-width: 100%; max-height: calc(100dvh - 9rem); border-radius: 14px; box-shadow: 0 30px 60px rgba(0,0,0,.4); }
    .visionneuse-fermer {
      position: absolute; top: .75rem; right: .75rem;
      width: 44px; height: 44px; border: 0; border-radius: 50%;
      background: rgba(255,255,255,.14); color: #fff; font-size: 1.8rem; line-height: 1; cursor: pointer;
    }
    .visionneuse-nav { display: flex; align-items: center; gap: 1.25rem; color: #fff; font-size: .8rem; letter-spacing: .15em; }
    .visionneuse-nav button {
      width: 44px; height: 44px; border: 1px solid rgba(255,255,255,.4); border-radius: 50%;
      background: none; color: #fff; font-size: 1.5rem; line-height: 1; cursor: pointer;
    }

    /* ════════════ APPEL ════════════ */
    .appel {
      width: 100%;
      max-width: 460px;
      padding: 2rem var(--gouttiere) 4.5rem;
      display: flex; flex-direction: column; align-items: stretch;
      gap: 1.1rem;
      text-align: center;
    }
    .invitation-texte { font-family: var(--affichage); font-style: italic; font-size: 1.3rem; line-height: 1.5; }
    .liens-secondaires { display: flex; gap: 1.25rem; flex-wrap: wrap; justify-content: center; font-size: .88rem; }
    .liens-secondaires a { display: inline-flex; align-items: center; min-height: 44px; color: var(--couleur-texte); opacity: .75; text-decoration: underline; text-underline-offset: 4px; }

    /* ════════════ PIED ════════════ */
    .pied {
      position: relative;
      width: 100%;
      text-align: center;
      padding: 4.5rem var(--gouttiere) calc(6.5rem + env(safe-area-inset-bottom));
      background: color-mix(in srgb, var(--couleur-texte) 92%, black);
      color: #fff;
    }
    .vagues--pied { top: -1px; bottom: auto; height: 50px; transform: rotate(180deg); }
    .vagues--pied .vague--1 { fill: var(--couleur-fond); }
    .pied-mono { font-family: var(--police-script); font-size: 2.4rem; color: var(--couleur-tertiaire); line-height: 1.2; }
    .pied-noms { font-family: var(--affichage); font-size: 1.3rem; font-style: italic; }
    .pied-date { font-size: .66rem; letter-spacing: .22em; text-transform: uppercase; opacity: .65; margin-top: .4rem; }

    /* ════════════ BARRE RSVP COLLANTE ════════════ */
    .barre-rsvp {
      position: fixed;
      left: 0; right: 0; bottom: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: .65rem var(--gouttiere) calc(.65rem + env(safe-area-inset-bottom));
      background: color-mix(in srgb, var(--couleur-fond) 88%, transparent);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border-top: 1px solid var(--bordure);
      transform: translateY(110%);
      transition: transform 350ms cubic-bezier(.2,.7,.2,1);
    }
    .barre-rsvp.visible { transform: none; }
    .barre-texte { display: flex; flex-direction: column; line-height: 1.2; }
    .barre-mono { font-family: var(--police-script); font-size: 1.5rem; color: var(--couleur-primaire); }
    .barre-date { font-size: .62rem; letter-spacing: .14em; text-transform: uppercase; color: var(--encre-douce); }

    /* ════════════ PETITS ÉCRANS (≤ 360 px) ════════════ */
    @media (max-width: 360px) {
      .std-titre { font-size: 2.6rem; }
      .std-noms { font-size: 2rem; }
      .cal-jour { height: 32px; font-size: .9rem; }
      .cal-jour--grand { width: 36px; height: 36px; }
      .compte-valeur { font-size: 1.45rem; }
      .ouv-date-texte { font-size: 1.1rem; }
      .ouv-date-jour { font-size: 3rem; }
      .ouv-date { gap: .6rem; }
      .pastille { width: 40px; height: 40px; }
    }

    /* ════════════ TABLETTE & ORDINATEUR ════════════ */
    @media (min-width: 768px) {
      .std { padding-top: 4rem; padding-bottom: 3rem; }
      .illustration { width: 180px; }
      .carte { padding: 2rem 1.75rem 2rem; }
      .std-titre { font-size: 3.6rem; }
      .entete h2, .dress h2 { font-size: 3.2rem; }
      .dress-grille { grid-template-columns: 1.1fr 1fr; align-items: center; gap: 4rem; }
      .dress-visuels { width: 100%; max-width: 480px; }
      .dress-bloc { text-align: left; margin: 0; }
      .portrait { max-width: 480px; }

      .histoire { padding: 6rem 2rem 5rem; }
      .frise { padding-left: 0; }
      .frise::before { left: 50%; }
      .chapitre { grid-template-columns: 1fr 1fr; gap: 5rem; align-items: center; margin-bottom: 5rem; }
      .chapitre--sans-photo .chapitre-texte { grid-column: 1; text-align: right; }
      .chapitre--sans-photo.chapitre--inverse .chapitre-texte { grid-column: 2; text-align: left; }
      .chapitre--inverse .polaroid { order: 2; }
      .chapitre--sans-photo .chapitre-texte p.lettrine::first-letter { float: none; padding: 0; }
      .frise-point { left: 50%; top: 50%; margin: -.875rem 0 0 -.875rem; }
      .chapitre--sans-photo .frise-point { top: .2rem; margin-top: 0; }
      .polaroid { width: 320px; }

      .programme { padding: 6rem 2rem; }
      .evenement { grid-template-columns: 100px 1fr; padding: 1.75rem; }
      .carte-lien { min-height: 300px; }

      /* Sur grand écran, la barre collante devient une pastille flottante */
      .barre-rsvp {
        left: auto; right: 1.5rem; bottom: 1.5rem;
        border: 1px solid var(--bordure);
        border-radius: 999px;
        padding: .45rem .45rem .45rem 1.25rem;
        box-shadow: 0 12px 30px -10px color-mix(in srgb, var(--couleur-texte) 30%, transparent);
        transform: translateY(160%);
      }
      .pied { padding-bottom: 3rem; }
    }

    @media (hover: hover) {
      .bouton--plein:hover { transform: translateY(-2px); box-shadow: 0 12px 28px color-mix(in srgb, var(--couleur-secondaire) 40%, transparent); }
      .carte-lien:hover .carte-fond { transform: scale(1.04); transition: transform 1.2s ease; }
      .liens-secondaires a:hover { opacity: 1; color: var(--couleur-primaire); }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; }
      [data-reveal] { opacity: 1; transform: none; }
      .cal-jour, .ouv-prenom, .anneaux, .ouv-date, .ouv-defiler, .ouv-filet span, .ouv-filet svg { opacity: 1; clip-path: none; transform: none; }
      .papillons { display: none; }
      .pastille { transform: none; }
      .petales { display: none; }
    }
  `]
})
export class SaveTheDateComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private mariagePublicService = inject(MariagePublicService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);
  private destroyRef = inject(DestroyRef);

  mariage = signal<MariagePublic | null>(null);
  introuvable = signal(false);
  etat = signal<EtatEnveloppe>('fermee');

  // Statique (exposé au template)
  readonly palette = PALETTE;
  readonly nuancier = NUANCIER;
  readonly portrait = PORTRAIT;
  readonly aquarelles = AQUARELLES;
  readonly dressTexte = DRESS_TEXTE;
  readonly inspirations = INSPIRATIONS;
  readonly inspirationOuverte = signal<number | null>(null);

  ouvrirInspiration(i: number): void {
    this.inspirationOuverte.set(i);
  }

  fermerInspiration(): void {
    this.inspirationOuverte.set(null);
  }

  inspirationSuivante(pas: number): void {
    const i = this.inspirationOuverte();
    if (i === null) return;
    const n = this.inspirations.length;
    this.inspirationOuverte.set((i + pas + n) % n);
  }

  @HostListener('document:keydown', ['$event'])
  clavierVisionneuse(e: KeyboardEvent): void {
    if (this.inspirationOuverte() === null) return;
    if (e.key === 'Escape') this.fermerInspiration();
    else if (e.key === 'ArrowRight') this.inspirationSuivante(1);
    else if (e.key === 'ArrowLeft') this.inspirationSuivante(-1);
  }
  readonly histoire = HISTOIRE;
  readonly traditionnel = TRADITIONNEL;
  readonly petales = PETALES;
  readonly lienCarte = LIEN_CARTE;
  readonly signature = SIGNATURE;
  readonly lieu = LIEU;
  readonly deroule = DEROULE;
  readonly joursSemaine = JOURS_SEMAINE;
  readonly coins = ['hg', 'hd', 'bg', 'bd'];

  private maintenant = signal(Date.now());
  private observer?: IntersectionObserver;
  private defile = signal(false);
  private appelVisible = signal(false);
  private rafEnAttente = false;

  /** Barre RSVP : visible après la carte, masquée quand le bouton principal est à l'écran. */
  readonly barreVisible = computed(() => this.etat() === 'ouverte' && this.defile() && !this.appelVisible());

  readonly illustration = ILLUSTRATION;
  readonly photoOuverture = PHOTO_OUVERTURE;
  readonly papillons = PAPILLONS;

  /** "Mireille & Rodrigue" → ["Mireille", "Rodrigue"] */
  readonly prenoms = computed<[string, string]>(() => {
    const noms = this.mariage()?.nomsCouple ?? '';
    const [a, ...reste] = noms.split(/\s+(?:&|et)\s+/i);
    return [a?.trim() ?? '', reste.join(' & ').trim()];
  });

  /** Bloc date de l'écran d'ouverture : Samedi / Janvier | 16 | Deux mille / vingt-sept */
  readonly dateOuverture = computed(() => {
    const iso = this.mariage()?.dateMariage;
    if (!iso) return null;
    const d = this.dateLocale(iso);
    const a = d.getFullYear();
    const enSiecle = a >= 2000 && a < 2100;
    return {
      jourSemaine: d.toLocaleDateString('fr-FR', { weekday: 'long' }),
      mois: d.toLocaleDateString('fr-FR', { month: 'long' }),
      jour: d.getDate().toString().padStart(2, '0'),
      anneeDebut: enSiecle ? 'Deux mille' : '',
      anneeFin: enSiecle ? (a === 2000 ? '' : this.nombreEnLettres(a - 2000)) : String(a),
    };
  });

  /** Mois du mariage, semaine commençant le lundi. */
  readonly calendrier = computed(() => {
    const iso = this.mariage()?.dateMariage;
    if (!iso) return null;
    const date = this.dateLocale(iso);
    const a = date.getFullYear();
    const mo = date.getMonth();
    const decalage = (new Date(a, mo, 1).getDay() + 6) % 7;
    const nbJours = new Date(a, mo + 1, 0).getDate();
    const cases: (number | null)[] = [
      ...Array.from({ length: decalage }, () => null),
      ...Array.from({ length: nbJours }, (_, i) => i + 1),
    ];
    return {
      mois: date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      jour: date.getDate(),
      cases,
    };
  });

  /** Compte à rebours en direct jusqu'à la cérémonie. */
  readonly compte = computed(() => {
    const m = this.mariage();
    if (!m?.dateMariage) return null;
    const reste = this.dateLocale(m.dateMariage, this.heure(m)).getTime() - this.maintenant();
    if (reste <= 0) return null;
    const deux = (n: number) => n.toString().padStart(2, '0');
    return [
      { valeur: Math.floor(reste / 86_400_000).toString(), libelle: 'jours' },
      { valeur: deux(Math.floor(reste / 3_600_000) % 24), libelle: 'heures' },
      { valeur: deux(Math.floor(reste / 60_000) % 60), libelle: 'min' },
      { valeur: deux(Math.floor(reste / 1000) % 60), libelle: 'sec' },
    ];
  });

  readonly estAujourdhui = computed(() => {
    const d = this.mariage()?.dateMariage;
    return !!d && this.dateLocale(d).toDateString() === new Date(this.maintenant()).toDateString();
  });

  ngOnInit(): void {
    this.chargerPolices();

    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.cleOuverture = `enveloppe-ouverte:${slug}`;

    // Retour depuis une sous-page (?vers=rsvp) ou enveloppe déjà ouverte pendant cette visite :
    // on affiche directement l'invitation ouverte.
    const vers = this.route.snapshot.queryParamMap.get('vers');
    if (vers || this.dejaOuverte()) this.etat.set('ouverte');

    this.mariagePublicService.consulter(slug).subscribe({
      next: m => {
        this.mariage.set(m);
        if (this.etat() === 'ouverte') this.apresOuvertureDirecte(vers);
      },
      error: () => this.introuvable.set(true)
    });

    if (isPlatformBrowser(this.platformId)) {
      const id = setInterval(() => this.maintenant.set(Date.now()), 1000);
      this.destroyRef.onDestroy(() => { clearInterval(id); this.minuteurs.forEach(clearTimeout); this.observer?.disconnect(); });
      this.preparerMusique();
    }
  }

  // ═══════════════ Musique de fond ═══════════════

  readonly musiqueDispo = !!MUSIQUE;
  readonly musiqueJoue = signal(false);
  /** L'invité a coupé le son : on respecte son choix pendant toute la visite. */
  readonly musiqueCoupee = signal(false);
  private audio?: HTMLAudioElement;
  private fondu?: ReturnType<typeof setInterval>;
  private repriseApresMasquage = false;
  private static readonly CLE_MUSIQUE = 'musique-invitation';

  private preparerMusique(): void {
    if (!MUSIQUE) return;
    let choix: string | null = null;
    try { choix = sessionStorage.getItem(SaveTheDateComponent.CLE_MUSIQUE); } catch { /* indisponible */ }
    this.musiqueCoupee.set(choix === 'coupee');

    // Retour sur la page (enveloppe déjà ouverte) avec la musique qui tournait :
    // on la relance au premier toucher, puisque le navigateur bloque le son avant.
    if (choix === 'joue' && this.etat() === 'ouverte') {
      const relancer = () => {
        if (!this.musiqueCoupee() && !this.musiqueJoue()) this.jouerMusique();
      };
      this.document.addEventListener('pointerdown', relancer, { once: true, capture: true });
      this.destroyRef.onDestroy(() => this.document.removeEventListener('pointerdown', relancer, { capture: true }));
    }

    // Écran verrouillé / autre onglet : on met en pause, puis on reprend.
    const visibilite = () => {
      if (!this.audio) return;
      if (this.document.hidden) {
        this.repriseApresMasquage = this.musiqueJoue();
        if (this.musiqueJoue()) this.audio.pause();
      } else if (this.repriseApresMasquage) {
        this.audio.play().catch(() => this.musiqueJoue.set(false));
      }
    };
    this.document.addEventListener('visibilitychange', visibilite);

    this.destroyRef.onDestroy(() => {
      this.document.removeEventListener('visibilitychange', visibilite);
      clearInterval(this.fondu);
      if (this.audio) { this.audio.pause(); this.audio.src = ''; }
    });
  }

  basculerMusique(): void {
    if (this.musiqueJoue()) {
      this.couperMusique();
    } else {
      this.musiqueCoupee.set(false);
      this.jouerMusique();
    }
  }

  private jouerMusique(): void {
    if (!MUSIQUE || !isPlatformBrowser(this.platformId)) return;
    if (!this.audio) {
      this.audio = new Audio(MUSIQUE.src);
      this.audio.loop = true;
      this.audio.preload = 'auto';
      this.audio.addEventListener('pause', () => { if (!this.document.hidden) this.musiqueJoue.set(false); });
      this.audio.addEventListener('playing', () => this.musiqueJoue.set(true));
    }
    this.audio.volume = 0;
    // play() doit être appelé directement dans le geste (exigence iOS / Chrome)
    this.audio.play()
      .then(() => {
        this.memoriserChoixMusique('joue');
        this.fondreVolume(MUSIQUE.volume, 2500);
      })
      .catch(() => this.musiqueJoue.set(false));   // fichier absent ou son bloqué : le bouton reste là
  }

  private couperMusique(): void {
    this.musiqueCoupee.set(true);
    this.memoriserChoixMusique('coupee');
    this.fondreVolume(0, 500, () => this.audio?.pause());
  }

  /** Fondu de volume (iOS ignore `volume` : le son y démarre/s'arrête simplement sans fondu). */
  private fondreVolume(cible: number, duree: number, fin?: () => void): void {
    const a = this.audio;
    if (!a) return;
    clearInterval(this.fondu);
    const depart = a.volume;
    const t0 = performance.now();
    this.fondu = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / duree);
      a.volume = Math.max(0, Math.min(1, depart + (cible - depart) * p));
      if (p >= 1) { clearInterval(this.fondu); fin?.(); }
    }, 50);
  }

  private memoriserChoixMusique(choix: 'joue' | 'coupee'): void {
    try { sessionStorage.setItem(SaveTheDateComponent.CLE_MUSIQUE, choix); } catch { /* indisponible */ }
  }

  private minuteurs: ReturnType<typeof setTimeout>[] = [];

  /** Ouvre l'enveloppe lentement, laisse lire la lettre, puis enchaîne. */
  ouvrir(): void {
    if (this.etat() !== 'fermee') return;
    // Le toucher sur le cachet est le geste qui autorise le son : la musique part ici.
    if (!this.musiqueCoupee()) this.jouerMusique();
    this.etat.set('ouverture');
    this.minuteurs.push(setTimeout(() => this.passer(), 5600));
  }

  /** Fin de la lecture (automatique ou via le bouton « Découvrir »). */
  passer(): void {
    if (this.etat() !== 'ouverture') return;
    this.minuteurs.forEach(clearTimeout);
    this.etat.set('fondu');
    this.minuteurs.push(setTimeout(() => {
      this.etat.set('ouverte');
      this.memoriserOuverture();
      if (isPlatformBrowser(this.platformId)) window.scrollTo(0, 0);
      setTimeout(() => this.observerApparitions(), 50);
    }, 700));
  }

  // ═══════════════ Enveloppe déjà ouverte ═══════════════

  private cleOuverture = '';

  /** Retenu pour la durée de la visite (onglet) : un lien partagé à quelqu'un d'autre montre toujours l'enveloppe. */
  private memoriserOuverture(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try { sessionStorage.setItem(this.cleOuverture, '1'); } catch { /* stockage indisponible */ }
  }

  private dejaOuverte(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    try { return sessionStorage.getItem(this.cleOuverture) === '1'; } catch { return false; }
  }

  /** Une fois le contenu affiché : animations au scroll, retour à la section d'origine, URL nettoyée. */
  private apresOuvertureDirecte(vers: string | null): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.memoriserOuverture();
    setTimeout(() => {
      this.observerApparitions();
      const cible = vers ? this.document.getElementById(vers) : null;
      if (cible) {
        cible.classList.add('visible');
        cible.scrollIntoView({ block: 'center' });
      }
      if (vers) {
        this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
      }
    }, 60);
  }

  ligneLieu(m: MariagePublic): string {
    return [PAYS, LIEU.ville, this.annee(m)].filter(Boolean).join(' · ');
  }

  /** 0–99 en toutes lettres (orthographe traditionnelle) : 26 → "vingt-six", 71 → "soixante-et-onze". */
  private nombreEnLettres(n: number): string {
    const u = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
               'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
    if (n < 17) return u[n];
    if (n < 20) return 'dix-' + u[n - 10];
    const d = Math.floor(n / 10);
    const r = n % 10;
    if (d === 7) return n === 71 ? 'soixante-et-onze' : 'soixante-' + this.nombreEnLettres(n - 60);
    if (d === 8) return r === 0 ? 'quatre-vingts' : 'quatre-vingt-' + u[r];
    if (d === 9) return 'quatre-vingt-' + this.nombreEnLettres(n - 80);
    const dizaines = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];
    if (r === 0) return dizaines[d];
    return dizaines[d] + (r === 1 ? '-et-un' : '-' + u[r]);
  }

  surDefilement(): void {
    if (this.rafEnAttente || !isPlatformBrowser(this.platformId)) return;
    this.rafEnAttente = true;
    requestAnimationFrame(() => {
      this.rafEnAttente = false;
      this.defile.set(window.scrollY > window.innerHeight * 1.6); // après l'écran d'ouverture + la carte
    });
  }

  defilerVers(id: string): void {
    this.document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Télécharge un .ics : sur téléphone, il s'ouvre directement dans l'agenda. */
  ajouterAgenda(m: MariagePublic): void {
    if (!m.dateMariage || !isPlatformBrowser(this.platformId)) return;
    const p = (n: number) => n.toString().padStart(2, '0');
    const echapper = (t: string) => t.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
    const debut = this.dateLocale(m.dateMariage, this.heure(m));
    const jourIcs = (d: Date) => `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
    const heureIcs = (d: Date) => `${jourIcs(d)}T${p(d.getHours())}${p(d.getMinutes())}00`;

    const lignesDate = this.heure(m)
      ? [`DTSTART:${heureIcs(debut)}`, `DTEND:${heureIcs(new Date(debut.getTime() + 6 * 3_600_000))}`]
      : [`DTSTART;VALUE=DATE:${jourIcs(debut)}`, `DTEND;VALUE=DATE:${jourIcs(new Date(debut.getTime() + 86_400_000))}`];

    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Invitation mariage//FR', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${m.slug}-${jourIcs(debut)}@invitation`,
      `DTSTAMP:${heureIcs(new Date())}`,
      ...lignesDate,
      `SUMMARY:${echapper('Mariage de ' + m.nomsCouple)}`,
      `LOCATION:${echapper(`${LIEU.nom}, ${LIEU.ville} – ${LIEU.quartier}`)}`,
      `DESCRIPTION:${echapper('Votre invitation : ' + window.location.href)}`,
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Mariage demain !', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = this.document.createElement('a');
    a.href = url;
    a.download = `mariage-${m.slug}.ics`;
    this.document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  annee(m: MariagePublic): string {
    return m.dateMariage ? this.dateLocale(m.dateMariage).getFullYear().toString() : '';
  }

  /** Monogramme : initiale de chaque prénom/nom. "Ruth-Mireille et Jules Rodrigues" → "RM & JR". */
  /** Initiales du cachet, sur deux lignes : ["RM", "JR"]. */
  initialesCachet(m: MariagePublic): [string, string] {
    const [a, b] = this.monogramme(m).split(' & ');
    return [a ?? '', b ?? ''];
  }

  monogramme(m: MariagePublic): string {
    const initiales = (s: string) => s.trim().split(/[\s-]+/).filter(Boolean).map(p => p.charAt(0).toUpperCase()).join('');
    const parties = m.nomsCouple.split(/\s+(?:&|et)\s+/i);
    return parties.length === 2 ? `${initiales(parties[0])} & ${initiales(parties[1])}` : initiales(m.nomsCouple);
  }

  /** Heure de la cérémonie : backend, sinon 11h00. */
  heure(m: MariagePublic): string {
    return m.heureCeremonie || HEURE_PAR_DEFAUT;
  }

  formaterDate(dateIso: string): string {
    return this.dateLocale(dateIso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  dateCourte(dateIso: string): string {
    return this.dateLocale(dateIso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  jour(dateIso: string): string {
    return this.dateLocale(dateIso).getDate().toString().padStart(2, '0');
  }

  moisAnnee(dateIso: string): string {
    return this.dateLocale(dateIso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  /** "15:00" ou "15:00:00" → "15h00" */
  formaterHeure(heure: string): string {
    const [h, m] = heure.split(':');
    return m ? `${h}h${m}` : heure;
  }

  romain(n: number): string {
    return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n - 1] ?? String(n);
  }

  /** "AAAA-MM-JJ" lu en heure locale (évite le décalage d'un jour de new Date(iso)). */
  private dateLocale(iso: string, heure?: string | null): Date {
    const [a, mo, j] = iso.slice(0, 10).split('-').map(Number);
    const [h, mi] = (heure ?? '00:00').split(':').map(v => Number(v) || 0);
    return new Date(a, mo - 1, j, h ?? 0, mi ?? 0);
  }

  private observerApparitions(): void {
    const racine = this.host.nativeElement;
    const elements = racine.querySelectorAll<HTMLElement>('[data-reveal]');
    if (!isPlatformBrowser(this.platformId) || !('IntersectionObserver' in window)) {
      elements.forEach(el => el.classList.add('visible'));
      return;
    }
    this.observer?.disconnect();
    this.observer = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.target.id === 'rsvp') this.appelVisible.set(e.isIntersecting);
        if (e.isIntersecting) e.target.classList.add('visible');
      }
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    elements.forEach(el => this.observer!.observe(el));
  }

  /** Polices du thème (pour le test ; à déplacer dans index.html ensuite). */
  private chargerPolices(): void {
    if (this.document.head.querySelector('link[data-polices-save-the-date]')) return;
    const link = this.document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Montserrat:wght@400;600&family=Pinyon+Script&display=swap';
    link.setAttribute('data-polices-save-the-date', '');
    this.document.head.appendChild(link);
  }
}