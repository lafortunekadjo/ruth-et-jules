import { Component, DestroyRef, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { RsvpService, IdentificationResponse } from '../../core/rsvp.service';
import { MariagePublic, MariagePublicService } from '../../core/mariage-public.service';

type Etape = 'IDENTIFICATION' | 'PRESENCE' | 'CONJOINT' | 'RESULTAT';

/** Billet gardé sur le téléphone de l'invité : s'il revient sur la page, il retrouve son billet. */
interface BilletMemorise {
  prenom: string;
  nom: string;
  /** Ancien format : nom du conjoint (non vide = billet 2 places). */
  conjoint?: string;
  deuxPlaces?: boolean;
  statut: string;
  billetUrl: string | null;
  /** Code court imprimé sous le QR (ex. K7P-4MX), à saisir si le scan échoue. */
  codeBillet?: string | null;
}

/** Palette « Élégance Côtière » : valeurs par défaut si le backend n'envoie rien. */
const PALETTE = {
  primaire: '#5e86ae',
  secondaire: '#c65a2a',
  tertiaire: '#d2b48c',
  fond: '#fbf8f1',
  texte: '#22324a',
};

const HEX = /^#([0-9a-f]{6})$/i;

/** Format du billet : portrait 2:3 (1080×1620), celui de la maquette. */
const BILLET_L = 1080;
const BILLET_H = 1620;

/**
 * Aquarelles du billet, propres à CE mariage : public/mariages/mireille-rodrigue/billet/
 * x, y, l, h = position et taille dans la maquette 1024×1536 (mises à l'échelle au dessin).
 * Si un fichier manque, le billet est généré sans lui.
 */
const DOSSIER_BILLET = '/mariages/mireille-rodrigue/billet';
const DECORS_BILLET = [
  { fichier: 'plage-bas-gauche.webp', x: 44, y: 1183, l: 316, h: 317 },
  { fichier: 'plage-droite.webp', x: 853, y: 715, l: 137, h: 115 },
  { fichier: 'fleurs-haut-gauche.webp', x: 0, y: 0, l: 400, h: 470 },
  { fichier: 'feuillage-haut-droite.webp', x: 853, y: 20, l: 171, h: 220 },
  { fichier: 'fleurs-bas-droite.webp', x: 680, y: 999, l: 344, h: 537 },
];

/** Lieu précis (le backend n'a que la ville pour l'instant). */
const LIEU = { nom: 'Les Palétuviers Matanda', ville: 'Douala', quartier: 'Bonassama' };

/** Heure de la cérémonie si le backend n'en envoie pas. */
const HEURE_PAR_DEFAUT = '14:00';

/** Pétales du petit feu d'artifice à la confirmation. */
const CONFETTIS = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2;
  const distance = 90 + (i % 3) * 35;
  return {
    dx: Math.round(Math.cos(angle) * distance),
    dy: Math.round(Math.sin(angle) * distance - 40),
    rot: (i * 47) % 360,
    couleur: ['var(--couleur-secondaire)', 'var(--couleur-tertiaire)', 'var(--couleur-primaire)'][i % 3],
    delai: (i % 4) * 40,
  };
});

@Component({
  selector: 'app-rsvp',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div
      class="scene"
      [style.--couleur-primaire]="couleurs().primaire"
      [style.--couleur-secondaire]="couleurs().secondaire"
      [style.--couleur-tertiaire]="couleurs().tertiaire"
      [style.--couleur-fond]="couleurs().fond"
      [style.--couleur-texte]="couleurs().texte"
      [style.--police-affichage]="mariage()?.police ? mariage()!.police + ', Cormorant Garamond, Georgia, serif' : null"
    >
      <!-- ───── En-tête ───── -->
      <header class="entete">
        <a class="retour" [routerLink]="['/m', slug]" aria-label="Retour à l'invitation">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
          <span>Invitation</span>
        </a>
        @if (mariage(); as m) {
          <p class="entete-mono">{{ monogramme() }}</p>
          <p class="entete-noms">{{ m.nomsCouple }}</p>
        }
      </header>

      <!-- ───── Progression ───── -->
      @if (etape() !== 'RESULTAT') {
        <ol class="progression" aria-label="Étapes de la réservation">
          @for (e of etapes; track e; let i = $index) {
            <li [class.faite]="indexEtape() > i" [class.active]="indexEtape() === i">
              <span class="pastille">{{ i + 1 }}</span>
              <span class="libelle">{{ e }}</span>
            </li>
          }
        </ol>
      }

      <main class="carte" [class.carte--resultat]="etape() === 'RESULTAT'">
        @switch (etape()) {

          <!-- Étape 1 : identification -->
          @case ('IDENTIFICATION') {
            <form class="etape" (ngSubmit)="identifier()">
              <h1>Confirmez votre présence</h1>

              <div class="mode-ident" role="tablist" aria-label="Me retrouver par">
                <button type="button" role="tab" [class.actif]="modeIdent() === 'nom'" [attr.aria-selected]="modeIdent() === 'nom'"
                        (click)="changerModeIdent('nom')">Par mon nom</button>
                <button type="button" role="tab" [class.actif]="modeIdent() === 'telephone'" [attr.aria-selected]="modeIdent() === 'telephone'"
                        (click)="changerModeIdent('telephone')">Par téléphone</button>
              </div>

              @if (modeIdent() === 'nom') {
                <p class="intro">Indiquez votre prénom et votre nom tels qu'ils figurent sur votre invitation.</p>

                <label for="rsvp-prenom">Prénom</label>
                <input id="rsvp-prenom" class="champ" name="prenom" [(ngModel)]="prenom"
                       required maxlength="100" autocomplete="given-name" autocapitalize="words" enterkeyhint="next" />

                <label for="rsvp-nom">Nom</label>
                <input id="rsvp-nom" class="champ" name="nom" [(ngModel)]="nom"
                       required maxlength="100" autocomplete="family-name" autocapitalize="words" enterkeyhint="go" />
              } @else {
                <p class="intro">Indiquez le numéro de téléphone que les mariés ont enregistré pour vous.</p>

                <label for="rsvp-tel">Numéro de téléphone</label>
                <input id="rsvp-tel" class="champ" name="telephone" [(ngModel)]="telephone" type="tel" inputmode="tel"
                       required maxlength="25" autocomplete="tel" placeholder="6 77 00 11 22" enterkeyhint="go" />
              }

              @if (erreur()) { <p class="erreur" role="alert">{{ erreur() }}</p> }
              <button type="submit" class="bouton" [disabled]="chargement() || !identificationPrete()">
                @if (chargement()) { <span class="spinner" aria-hidden="true"></span> Recherche… } @else { Continuer }
              </button>
            </form>
          }

          <!-- Étape 2 : présence -->
          @case ('PRESENCE') {
            <div class="etape">
              <h1>Bonjour {{ identification()?.prenom }}</h1>
              <p class="intro">Serez-vous des nôtres pour ce grand jour ?</p>

              <div class="choix">
                <button class="bouton" (click)="repondrePresence(true)" [disabled]="chargement()">Je serai présent·e</button>
                <button class="bouton bouton-discret" (click)="repondrePresence(false)" [disabled]="chargement()">Je ne pourrai pas venir</button>
              </div>
              @if (erreur()) { <p class="erreur" role="alert">{{ erreur() }}</p> }
            </div>
          }

          <!-- Étape 3 : conjoint (uniquement si typePlace === COUPLE) -->
          @case ('CONJOINT') {
            <div class="etape">
              <h1>Votre invitation est pour deux</h1>
              <p class="intro">Votre conjoint·e sera-t-il/elle présent·e ?</p>

              <div class="choix">
                <button class="bouton" (click)="choisirConjoint(true)" [disabled]="chargement()">
                  @if (chargement() && conjointPresentChoisi()) { <span class="spinner" aria-hidden="true"></span> Validation… } @else { Oui, nous viendrons ensemble }
                </button>
                <button class="bouton bouton-discret" (click)="choisirConjoint(false)" [disabled]="chargement()">Non, je viens seul·e</button>
              </div>

              @if (erreur()) { <p class="erreur" role="alert">{{ erreur() }}</p> }
            </div>
          }

          <!-- Étape 4 : résultat -->
          @case ('RESULTAT') {
            <div class="resultat">
              @if (resultatStatut() === 'DECLINE') {
                <h1>Merci pour votre réponse</h1>
                <p class="intro">Vous nous manquerez, mais nous vous remercions d'avoir pris le temps de répondre.</p>
                <a class="bouton bouton-discret" [routerLink]="['/m', slug]">Revenir à l'invitation</a>
              } @else {
                <div class="confirmation">
                  <div class="coche-zone" aria-hidden="true">
                    @for (c of confettis; track $index) {
                      <span class="confetti" [style.--dx.px]="c.dx" [style.--dy.px]="c.dy" [style.--rot.deg]="c.rot"
                            [style.background]="c.couleur" [style.animation-delay.ms]="c.delai"></span>
                    }
                    <svg class="coche" viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg>
                  </div>
                  <h1>Votre présence est confirmée</h1>
                  <p class="intro">Voici votre billet. Présentez-le à l'entrée le jour J.</p>
                </div>

                @if (billetUrl()) {
                  <!-- Le billet affiché EST l'image téléchargée : même rendu, même format -->
                  <figure class="billet">
                    @if (billetImage(); as img) {
                      <img [src]="img" [alt]="altBillet()" />
                    } @else if (billetErreur()) {
                      <button type="button" class="billet-erreur" (click)="preparerBillet()">
                        Le billet n'a pas pu être préparé.<br /><u>Réessayer</u>
                      </button>
                    } @else {
                      <div class="billet-chargement" aria-label="Préparation du billet">
                        <span class="spinner spinner--sombre" aria-hidden="true"></span>
                        <span>Préparation de votre billet…</span>
                      </div>
                    }
                  </figure>

                  <div class="actions">
                    <button type="button" class="bouton" (click)="enregistrerBillet()" [disabled]="!billetImage()">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>
                      Enregistrer mon billet
                    </button>
                    <button type="button" class="bouton bouton-discret" (click)="afficherQr()" [disabled]="!qrAffichage()">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/></svg>
                      Afficher mon QR code
                    </button>
                    @if (partageDispo) {
                      <button type="button" class="bouton bouton-discret" (click)="partagerBillet()" [disabled]="!billetImage()">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/></svg>
                        Partager / envoyer
                      </button>
                    }
                  </div>
                  <p class="astuce">Gardez l'image dans votre galerie : elle s'affichera même sans connexion le jour J.</p>

                  <!-- QR en plein écran : pour un scan rapide à l'entrée -->
                  @if (qrPleinEcran() && qrAffichage()) {
                    <div class="qr-plein-ecran" role="dialog" aria-modal="true" aria-label="QR code d'accès" (click)="fermerQr()">
                      <p class="qr-pe-noms">{{ mariage()?.nomsCouple }}</p>
                      <img [src]="qrAffichage()" alt="QR code d'accès" />
                      <p class="qr-pe-invite">{{ nomInvite() }}</p>
                      @if (codeBillet()) { <p class="qr-pe-code">Code <strong>{{ codeBillet() }}</strong></p> }
                      <p class="qr-pe-aide">Montez la luminosité de l'écran · touchez pour fermer</p>
                    </div>
                  }
                } @else {
                  <p class="en-attente">Votre billet est en cours de préparation. Revenez sur cette page un peu plus tard pour le récupérer.</p>
                }
              }

              <button type="button" class="lien-discret" (click)="recommencer()">Ce n'est pas vous ? Répondre pour un autre invité</button>
            </div>
          }
        }
      </main>
    </div>
  `,
  styles: [`
    /* MOBILE FIRST : styles de base pour téléphone, améliorations en min-width. */
    :host {
      display: block;
      --police-script: 'Pinyon Script', 'Great Vibes', cursive;
    }
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    p, h1 { margin: 0; }

    .scene {
      --affichage: var(--police-affichage, 'Cormorant Garamond', Georgia, serif);
      --texte: var(--police-texte, 'Montserrat', system-ui, sans-serif);
      --encre-douce: color-mix(in srgb, var(--couleur-texte) 72%, transparent);
      --bordure: color-mix(in srgb, var(--couleur-primaire) 25%, transparent);
      --or: linear-gradient(135deg, color-mix(in srgb, var(--couleur-tertiaire) 70%, #fff) 0%, var(--couleur-secondaire) 55%, color-mix(in srgb, var(--couleur-secondaire) 70%, #000) 100%);
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: max(.75rem, env(safe-area-inset-top)) 16px calc(2rem + env(safe-area-inset-bottom));
      background:
        radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--couleur-tertiaire) 22%, var(--couleur-fond)), var(--couleur-fond) 60%);
      color: var(--couleur-texte);
      font-family: var(--texte);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }

    /* ---------- En-tête ---------- */
    .entete { position: relative; width: 100%; max-width: 440px; text-align: center; padding: .5rem 0 1rem; }
    .retour {
      position: absolute; left: -6px; top: .35rem;
      display: inline-flex; align-items: center; gap: .15rem;
      min-height: 44px; padding: 0 .4rem;
      font-size: .72rem; letter-spacing: .1em; text-transform: uppercase;
      color: var(--encre-douce); text-decoration: none;
    }
    .retour svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; }
    .entete-mono { font-family: var(--police-script); font-size: 2rem; line-height: 1.3; background: var(--or); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .entete-noms { font-family: var(--affichage); font-style: italic; font-size: 1.05rem; color: var(--encre-douce); }

    /* ---------- Progression ---------- */
    .progression {
      display: flex; justify-content: center; gap: .4rem;
      width: 100%; max-width: 440px;
      list-style: none; margin: 0 0 1rem; padding: 0;
    }
    .progression li { flex: 1; display: flex; flex-direction: column; align-items: center; gap: .3rem; position: relative; }
    .progression li:not(:last-child)::after {
      content: ''; position: absolute; top: 13px; left: calc(50% + 18px); right: calc(-50% + 14px);
      height: 1px; background: var(--bordure);
    }
    .progression li.faite::after { background: var(--couleur-secondaire); }
    .progression .pastille {
      width: 27px; height: 27px; border-radius: 50%;
      display: grid; place-items: center;
      font-size: .72rem; font-weight: 600;
      border: 1px solid var(--bordure); background: #fff; color: var(--encre-douce);
      transition: background 300ms ease, color 300ms ease, border-color 300ms ease;
    }
    .progression li.active .pastille { border-color: var(--couleur-secondaire); color: var(--couleur-secondaire); box-shadow: 0 0 0 4px color-mix(in srgb, var(--couleur-secondaire) 15%, transparent); }
    .progression li.faite .pastille { background: var(--couleur-secondaire); border-color: var(--couleur-secondaire); color: #fff; }
    .progression .libelle { font-size: .6rem; letter-spacing: .1em; text-transform: uppercase; color: var(--encre-douce); }

    /* ---------- Carte ---------- */
    .carte {
      width: 100%;
      max-width: 440px;
      background: #fff;
      border: 1px solid color-mix(in srgb, var(--couleur-tertiaire) 50%, transparent);
      border-radius: 14px;
      padding: 1.75rem 1.25rem 1.5rem;
      box-shadow: 0 18px 44px -20px color-mix(in srgb, var(--couleur-texte) 30%, transparent);
      text-align: center;
    }
    .carte--resultat { background: transparent; border: none; box-shadow: none; padding: 0; }
    .etape { animation: glisser 450ms cubic-bezier(.2,.7,.2,1) both; }
    @keyframes glisser { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: none; } }

    h1 { font-family: var(--affichage); font-size: 1.75rem; font-weight: 500; line-height: 1.2; margin-bottom: .5rem; }
    .intro { font-size: .92rem; color: var(--encre-douce); margin-bottom: 1.25rem; }
    .mode-ident {
      display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; margin: .25rem 0 1.1rem;
      border-radius: 999px; background: color-mix(in srgb, var(--couleur-tertiaire) 22%, #fff);
    }
    .mode-ident button {
      min-height: 40px; border: none; border-radius: 999px; background: none; cursor: pointer;
      font: 600 .78rem var(--texte, Montserrat, sans-serif); color: var(--encre-douce); letter-spacing: .02em;
    }
    .mode-ident button.actif { background: #fff; color: var(--couleur-texte); box-shadow: 0 4px 12px -6px rgba(0,0,0,.25); }

    label { display: block; text-align: left; font-size: .75rem; font-weight: 600; letter-spacing: .04em; margin: 1rem 0 .35rem; color: var(--encre-douce); }
    .champ {
      width: 100%;
      min-height: 52px;
      font-family: var(--texte);
      font-size: 16px; /* ≥ 16px : évite le zoom automatique sur iPhone */
      padding: .75rem 1rem;
      border: 1px solid color-mix(in srgb, var(--couleur-texte) 18%, transparent);
      border-radius: 10px;
      background: color-mix(in srgb, var(--couleur-fond) 50%, #fff);
      color: var(--couleur-texte);
      transition: border-color 200ms ease, box-shadow 200ms ease;
    }
    .champ:focus { outline: none; border-color: var(--couleur-primaire); box-shadow: 0 0 0 4px color-mix(in srgb, var(--couleur-primaire) 15%, transparent); }

    .choix { display: flex; flex-direction: column; gap: .75rem; }

    .bouton {
      display: inline-flex; align-items: center; justify-content: center; gap: .55rem;
      width: 100%;
      min-height: 52px;
      margin-top: 1.5rem;
      padding: 0 1.5rem;
      border: none;
      border-radius: 999px;
      background: var(--couleur-secondaire);
      color: #fff;
      font-family: var(--texte); font-size: .8rem; font-weight: 600; letter-spacing: .12em; text-transform: uppercase;
      text-decoration: none;
      cursor: pointer;
      box-shadow: 0 8px 22px color-mix(in srgb, var(--couleur-secondaire) 30%, transparent);
      transition: transform 120ms ease, opacity 150ms ease;
    }
    .bouton svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .bouton:disabled { opacity: .5; cursor: not-allowed; }
    .bouton:active:not(:disabled) { transform: scale(.98); }
    .choix .bouton { margin-top: 0; }
    .bouton-discret { background: #fff; color: var(--couleur-texte); border: 1px solid var(--bordure); box-shadow: none; }

    .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: tourner 800ms linear infinite; }
    .bouton-discret .spinner { border-color: var(--bordure); border-top-color: var(--couleur-texte); }
    @keyframes tourner { to { transform: rotate(360deg); } }

    .erreur { color: #b3402f; font-size: .85rem; margin-top: 1rem; }

    /* ---------- Résultat ---------- */
    .resultat { display: flex; flex-direction: column; align-items: stretch; }
    .resultat > h1, .resultat > .intro { text-align: center; }
    .confirmation { text-align: center; animation: glisser 500ms ease both; }

    .coche-zone { position: relative; width: 64px; height: 64px; margin: .25rem auto 1rem; }
    .coche { width: 64px; height: 64px; fill: none; stroke: var(--couleur-secondaire); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
    .coche circle { stroke-dasharray: 151; stroke-dashoffset: 151; animation: tracer 700ms ease forwards; }
    .coche path { stroke-dasharray: 36; stroke-dashoffset: 36; animation: tracer 400ms 600ms ease forwards; }
    @keyframes tracer { to { stroke-dashoffset: 0; } }
    .confetti {
      position: absolute; left: 50%; top: 50%;
      width: 8px; height: 11px; margin: -5px 0 0 -4px;
      border-radius: 80% 0 80% 0;
      opacity: 0;
      animation: eclater 1.3s 700ms cubic-bezier(.15,.7,.3,1) forwards;
    }
    @keyframes eclater {
      0% { opacity: 1; transform: translate(0, 0) rotate(0); }
      70% { opacity: 1; }
      100% { opacity: 0; transform: translate(var(--dx), calc(var(--dy) + 60px)) rotate(var(--rot)); }
    }

    /* ---------- Billet ---------- */
    /* L'image entière est affichée : c'est exactement le fichier téléchargé (2:3). */
    .billet {
      position: relative;
      width: 100%;
      max-width: 420px;
      margin: 1rem auto 0;
      aspect-ratio: 1080 / 1620;       /* réserve la place : pas de saut de mise en page */
      border-radius: 14px;
      overflow: hidden;
      background: var(--couleur-fond);
      box-shadow: 0 22px 50px -24px color-mix(in srgb, var(--couleur-texte) 45%, transparent);
      animation: imprimer 1.1s 200ms cubic-bezier(.2,.7,.2,1) both;
    }
    .billet img {
      display: block;
      width: 100%;
      height: auto;
    }
    @keyframes imprimer {
      from { clip-path: inset(0 0 100% 0); transform: translateY(-12px); }
      to { clip-path: inset(0 0 0 0); transform: none; }
    }

    .qr-plein-ecran {
      position: fixed; inset: 0; z-index: 60;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.25rem;
      padding: 2rem 1.5rem calc(2rem + env(safe-area-inset-bottom));
      background: #fff;
      text-align: center;
      animation: fondu-qr 200ms ease both;
      cursor: pointer;
    }
    @keyframes fondu-qr { from { opacity: 0; } to { opacity: 1; } }
    .qr-pe-code { margin: .2rem 0 0; font-size: .8rem; letter-spacing: .2em; text-transform: uppercase; opacity: .75; }
    .qr-pe-code strong { font-size: 1.15rem; letter-spacing: .18em; opacity: 1; }
    .qr-plein-ecran img { width: min(82vw, 60vh, 420px); height: auto; image-rendering: pixelated; }
    .qr-pe-noms { font-family: var(--police-script); font-size: 2rem; color: var(--couleur-primaire); }
    .qr-pe-invite { font-family: var(--affichage); font-size: 1.5rem; color: var(--couleur-texte); }
    .qr-pe-aide { font-size: .75rem; color: var(--encre-douce); }

    .billet-chargement, .billet-erreur {
      width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .75rem;
      border-radius: 18px;
      font-family: var(--affichage); font-style: italic; font-size: 1.05rem; color: var(--encre-douce);
    }
    .billet-chargement {
      background: linear-gradient(90deg, #f3efe7 25%, #faf7f1 50%, #f3efe7 75%) 0 0 / 200% 100%;
      animation: miroiter 1.2s linear infinite;
    }
    @keyframes miroiter { to { background-position: -200% 0; } }
    .billet-erreur { border: 1px dashed #d9a79a; background: #fbf3ef; color: #b3402f; cursor: pointer; font-family: var(--texte); font-style: normal; font-size: .9rem; }
    .spinner--sombre { border-color: var(--bordure); border-top-color: var(--couleur-secondaire); width: 22px; height: 22px; }

    .actions { display: grid; gap: .7rem; margin-top: 1.25rem; }
    .actions .bouton { margin-top: 0; }
    .astuce { font-size: .78rem; color: var(--encre-douce); text-align: center; margin-top: .9rem; }
    .en-attente { margin-top: 1rem; padding: 1rem; border-radius: 12px; background: #fff; border: 1px dashed var(--bordure); font-size: .9rem; color: var(--encre-douce); text-align: center; }

    .lien-discret {
      align-self: center;
      min-height: 44px;
      margin-top: 1.25rem;
      background: none; border: none;
      font-family: var(--texte); font-size: .8rem;
      color: var(--encre-douce);
      text-decoration: underline; text-underline-offset: 3px;
      cursor: pointer;
    }

    @media (min-width: 600px) {
      .scene { justify-content: center; padding-top: 2rem; }
      .carte { padding: 2.25rem 2rem; }
      .carte--resultat { padding: 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 1ms !important; animation-delay: 0ms !important; transition-duration: 1ms !important; }
      .confetti { display: none; }
    }
  `]
})
export class RsvpComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private rsvpService = inject(RsvpService);
  private mariagePublicService = inject(MariagePublicService);
  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);
  private destroyRef = inject(DestroyRef);

  slug = '';
  readonly etapes = ['Identification', 'Présence', 'Confirmation'];
  readonly confettis = CONFETTIS;
  readonly partageDispo = isPlatformBrowser(this.platformId) && typeof navigator !== 'undefined' && 'canShare' in navigator;

  readonly etape = signal<Etape>('IDENTIFICATION');
  readonly chargement = signal(false);
  readonly erreur = signal('');

  readonly mariage = signal<MariagePublic | null>(null);

  readonly prenom = signal('');
  readonly nom = signal('');

  readonly identification = signal<IdentificationResponse | null>(null);
  readonly conjointPresentChoisi = signal(false);
  /** Billet couple confirmé : 2 places (le nom du conjoint n'est plus demandé). */
  readonly deuxPlaces = signal(false);

  readonly resultatStatut = signal('');
  readonly billetUrl = signal<string | null>(null);
  readonly codeBillet = signal<string | null>(null);

  /** Image finale du billet (PNG) : affichée à l'écran ET téléchargée. */
  readonly billetImage = signal<string | null>(null);
  readonly billetErreur = signal(false);
  private billetBlob: Blob | null = null;
  /** QR seul (URL locale), pour l'affichage plein écran. */
  readonly qrAffichage = signal<string | null>(null);
  readonly qrPleinEcran = signal(false);
  private qrCree = false;
  private verrouEcran: { release: () => Promise<void> } | null = null;
  private preparationId = 0;
  private decors?: Promise<Record<string, HTMLImageElement | null>>;

  readonly indexEtape = computed(() => ({ IDENTIFICATION: 0, PRESENCE: 1, CONJOINT: 1, RESULTAT: 2 })[this.etape()]);

  /** Couleurs du backend (hex), sinon palette par défaut — utilisées en CSS et dans l'image du billet. */
  readonly couleurs = computed(() => {
    const m = this.mariage();
    const c = (v: string | null | undefined, d: string) => (v && HEX.test(v) ? v : d);
    return {
      primaire: c(m?.couleurPrimaire, PALETTE.primaire),
      secondaire: c(m?.couleurSecondaire, PALETTE.secondaire),
      tertiaire: c(m?.couleurTertiaire, PALETTE.tertiaire),
      fond: c(m?.couleurFond, PALETTE.fond),
      texte: c(m?.couleurTexte, PALETTE.texte),
    };
  });

  readonly monogramme = computed(() => {
    const noms = this.mariage()?.nomsCouple ?? '';
    // initiale de chaque prénom/nom : "Ruth-Mireille et Jules Rodrigues" → "RM & JR"
    const initiales = (s: string) => s.trim().split(/[\s-]+/).filter(Boolean).map(p => p.charAt(0).toUpperCase()).join('');
    const parties = noms.split(/\s+(?:&|et)\s+/i);
    return parties.length === 2 ? `${initiales(parties[0])} & ${initiales(parties[1])}` : initiales(noms);
  });

  /** "Ruth-Mireille et Jules Rodrigues" → ["Ruth-Mireille", "Jules Rodrigues"] */
  readonly prenoms = computed<[string, string]>(() => {
    const [a, ...reste] = (this.mariage()?.nomsCouple ?? '').split(/\s+(?:&|et)\s+/i);
    return [a?.trim() ?? '', reste.join(' & ').trim()];
  });

  readonly heure = computed(() => this.formaterHeure(this.mariage()?.heureCeremonie || HEURE_PAR_DEFAUT));

  readonly nomInvite = computed(() => {
    const i = this.identification();
    return `${i?.prenom ?? this.prenom()} ${i?.nom ?? this.nom()}`.trim();
  });

  readonly altBillet = computed(() =>
    `Billet d'invitation au mariage de ${this.mariage()?.nomsCouple ?? ''} pour ${this.nomInvite()}` +
    (this.deuxPlaces() ? ' (2 places)' : '') + ', avec le QR code d\'accès');

  readonly dateBillet = computed(() => {
    const iso = this.mariage()?.dateMariage;
    if (!iso) return null;
    const d = this.dateLocale(iso);
    return { longue: d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) };
  });

  readonly ligneHeureLieu = computed(() => {
    const m = this.mariage();
    return [this.heure(), LIEU.nom].join(' · ');
  });

  ngOnInit(): void {
    this.slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.chargerPolices();

    this.mariagePublicService.consulter(this.slug).subscribe({
      next: m => this.mariage.set(m),
      error: () => {} // la page reste fonctionnelle sans les infos de vitrine
    });

    this.restaurerBillet();
    this.destroyRef.onDestroy(() => this.libererBillet());
  }

  // ═══════════════ Parcours RSVP (logique inchangée) ═══════════════

  /** Identification par nom (prénom + nom) ou par numéro de téléphone. */
  readonly modeIdent = signal<'nom' | 'telephone'>('nom');
  readonly telephone = signal('');

  changerModeIdent(mode: 'nom' | 'telephone'): void {
    this.modeIdent.set(mode);
    this.erreur.set('');
  }

  identificationPrete(): boolean {
    return this.modeIdent() === 'telephone'
      ? this.telephone().replace(/\D/g, '').length >= 8
      : !!this.prenom().trim() && !!this.nom().trim();
  }

  identifier(): void {
    this.erreur.set('');
    this.chargement.set(true);

    const demande = this.modeIdent() === 'telephone'
      ? { telephone: this.telephone().trim() }
      : { nom: this.nom().trim(), prenom: this.prenom().trim() };
    this.rsvpService.identifier(this.slug, demande)
      .subscribe({
        next: (res) => {
          this.identification.set(res);
          this.etape.set('PRESENCE');
          this.chargement.set(false);
        },
        error: (err) => {
          this.erreur.set(err?.error?.message ?? (err?.status === 409
            ? "Plusieurs invitations correspondent. Merci de contacter les mariés directement."
            : "Nous ne trouvons pas votre invitation. Vérifiez votre saisie ou contactez les mariés."));
          this.chargement.set(false);
        }
      });
  }

  repondrePresence(present: boolean): void {
    const ident = this.identification();
    if (!ident) return;
    this.erreur.set('');
    this.chargement.set(true);

    this.rsvpService.confirmerPresence(this.slug, ident.rsvpSessionToken, present)
      .subscribe({
        next: (res) => {
          this.chargement.set(false);
          if (res.questionConjointRequise) {
            this.etape.set('CONJOINT');
          } else {
            this.afficherResultat(res.statut, res.billetUrl, res.codeBillet ?? null);
          }
        },
        error: () => {
          this.erreur.set("Une erreur est survenue, merci de réessayer.");
          this.chargement.set(false);
        }
      });
  }

  choisirConjoint(present: boolean): void {
    this.conjointPresentChoisi.set(present);
    this.validerConjoint();
  }

  validerConjoint(): void {
    const ident = this.identification();
    if (!ident) return;
    this.erreur.set('');
    this.chargement.set(true);

    const avecConjoint = this.conjointPresentChoisi();

    this.rsvpService.confirmerConjoint(this.slug, ident.rsvpSessionToken, avecConjoint)
      .subscribe({
        next: (res) => {
          this.chargement.set(false);
          this.deuxPlaces.set(avecConjoint);
          this.afficherResultat(res.statut, res.billetUrl, res.codeBillet ?? null);
        },
        error: () => {
          this.erreur.set("Une erreur est survenue, merci de réessayer.");
          this.chargement.set(false);
        }
      });
  }

  /** Repart de zéro (autre invité sur le même téléphone). */
  recommencer(): void {
    this.oublierBillet();
    this.libererBillet();
    this.identification.set(null);
    this.prenom.set('');
    this.nom.set('');
    this.conjointPresentChoisi.set(false);
    this.deuxPlaces.set(false);
    this.resultatStatut.set('');
    this.billetUrl.set(null);
    this.codeBillet.set(null);
    this.erreur.set('');
    this.etape.set('IDENTIFICATION');
    if (isPlatformBrowser(this.platformId)) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private afficherResultat(statut: string, billetUrl: string | null, codeBillet: string | null): void {
    this.resultatStatut.set(statut);
    this.billetUrl.set(billetUrl);
    this.codeBillet.set(codeBillet);
    this.etape.set('RESULTAT');
    this.memoriserBillet();
    if (billetUrl) this.preparerBillet();
    if (isPlatformBrowser(this.platformId)) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ═══════════════ Préparation du billet ═══════════════

  /**
   * 1. récupère le QR du backend en blob via HttpClient (intercepteurs/CORS respectés,
   *    et pas de « tainted canvas ») ;
   * 2. dessine le billet (PNG 1080×1620) ;
   * 3. affiche CETTE image — c'est aussi celle qui est téléchargée/partagée.
   */
  async preparerBillet(): Promise<void> {
    const url = this.billetUrl();
    if (!url || !isPlatformBrowser(this.platformId)) return;
    const id = ++this.preparationId;
    this.billetErreur.set(false);
    this.libererBillet();

    const crees: string[] = [];
    try {
      const qrLocal = await this.versUrlLocale(url, crees);
      const qr = await this.chargerImage(qrLocal);
      await this.policesPretes();
      const blob = await this.dessinerBillet(qr);
      if (id !== this.preparationId) { crees.forEach(u => URL.revokeObjectURL(u)); return; }
      this.billetBlob = blob;
      this.billetImage.set(URL.createObjectURL(blob));
      this.qrAffichage.set(qrLocal);
      this.qrCree = crees.includes(qrLocal);
    } catch {
      crees.forEach(u => URL.revokeObjectURL(u));
      if (id === this.preparationId) this.billetErreur.set(true);
    }
  }

  private libererBillet(): void {
    const img = this.billetImage();
    if (img) URL.revokeObjectURL(img);
    const qr = this.qrAffichage();
    if (qr && this.qrCree) URL.revokeObjectURL(qr);
    this.billetImage.set(null);
    this.qrAffichage.set(null);
    this.qrCree = false;
    this.billetBlob = null;
    this.fermerQr();
  }

  /** QR en grand + écran maintenu allumé (si le téléphone le permet). */
  async afficherQr(): Promise<void> {
    this.qrPleinEcran.set(true);
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release: () => Promise<void> }> } };
    try { this.verrouEcran = (await nav.wakeLock?.request('screen')) ?? null; } catch { /* non supporté */ }
  }

  fermerQr(): void {
    this.qrPleinEcran.set(false);
    this.verrouEcran?.release().catch(() => {});
    this.verrouEcran = null;
  }

  /** data: → tel quel ; sinon téléchargé en blob puis converti en URL locale. */
  private versUrlLocale(url: string, aLiberer: string[]): Promise<string> {
    if (url.startsWith('data:') || url.startsWith('blob:')) return Promise.resolve(url);
    return new Promise((resolve, reject) => {
      this.http.get(url, { responseType: 'blob' }).subscribe({
        next: blob => { const u = URL.createObjectURL(blob); aLiberer.push(u); resolve(u); },
        error: reject,
      });
    });
  }

  /** Attend la feuille Google Fonts puis les polices utilisées (3 s max, sinon polices de repli). */
  private async policesPretes(): Promise<void> {
    const lien = this.document.head.querySelector<HTMLLinkElement>('link[data-polices-save-the-date]');
    if (lien && !lien.sheet) {
      await new Promise<void>(r => { lien.addEventListener('load', () => r(), { once: true }); setTimeout(r, 3000); });
    }
    const fonts = (this.document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts) return;
    await Promise.race([
      Promise.all(["400 80px 'Pinyon Script'", "italic 400 40px 'Cormorant Garamond'", "italic 500 40px 'Cormorant Garamond'", "500 40px 'Cormorant Garamond'",
                   '600 24px Montserrat', '400 24px Montserrat'].map(f => fonts.load(f).catch(() => null))),
      new Promise(r => setTimeout(r, 3000)),
    ]);
  }

  // ═══════════════ Enregistrer / partager ═══════════════

  enregistrerBillet(): void {
    const fichier = this.fichierBillet();
    if (!fichier) return;
    const url = URL.createObjectURL(fichier);
    const a = this.document.createElement('a');
    a.href = url;
    a.download = fichier.name;
    this.document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /** Feuille de partage du téléphone : « Enregistrer l'image », WhatsApp, etc. */
  async partagerBillet(): Promise<void> {
    const fichier = this.fichierBillet();
    if (!fichier) return;
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [fichier] })) {
      try {
        await navigator.share({ files: [fichier], title: 'Mon billet', text: `Mariage de ${this.mariage()?.nomsCouple ?? ''}` });
      } catch { /* partage annulé */ }
    } else {
      this.enregistrerBillet();
    }
  }

  private fichierBillet(): File | null {
    if (!this.billetBlob) return null;
    const nom = this.nomInvite().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');
    return new File([this.billetBlob], `billet-${this.slug}-${nom}.png`, { type: 'image/png' });
  }

  // ═══════════════ Dessin du billet (1080 × 1620) ═══════════════
  // Mise en page calquée sur la maquette « Élégance Côtière » (1024 × 1536) :
  // toutes les coordonnées ci-dessous sont celles de la maquette, mises à l'échelle par k.

  /** Aquarelles du billet (fleurs, plage) ; une image absente n'empêche pas le billet. */
  private chargerDecors(): Promise<Record<string, HTMLImageElement | null>> {
    this.decors ??= Promise.all(
      DECORS_BILLET.map(d => this.chargerImage(`${DOSSIER_BILLET}/${d.fichier}`).catch(() => null)),
    ).then(imgs => Object.fromEntries(DECORS_BILLET.map((d, i) => [d.fichier, imgs[i]])));
    return this.decors;
  }

  private async dessinerBillet(qr: HTMLImageElement): Promise<Blob> {
    const m = this.mariage();
    const c = this.couleurs();
    const decors = await this.chargerDecors();
    const S = "'Pinyon Script', 'Great Vibes', cursive";
    const A = "'Cormorant Garamond', Georgia, serif";
    const T = 'Montserrat, system-ui, sans-serif';
    const W = BILLET_L, H = BILLET_H;
    const k = W / 1024;
    const P = (v: number) => v * k;

    const canvas = this.document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.textBaseline = 'alphabetic';

    // Teintes dérivées des couleurs du mariage
    const encre = c.texte;                                              // bleu nuit
    const or = this.melanger(c.tertiaire, '#7a5418', .42);              // doré des filets et surtitres
    const orClair = this.alpha(this.melanger(c.tertiaire, '#7a5418', .25), .9);
    const ciel = this.melanger(c.primaire, '#ffffff', .8);              // fond aquarelle autour de la carte
    const papier = this.melanger(c.fond, c.tertiaire, .06);
    const pale = this.melanger(c.primaire, '#ffffff', .2);              // quartier
    const rnd = this.aleatoire(7);

    // ══ Fond aquarelle bleu pâle ══
    ctx.fillStyle = ciel;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) {
      const x = rnd() * W, y = rnd() * H, r = 120 + rnd() * 320;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const teinte = rnd() > .5 ? this.melanger(c.primaire, '#ffffff', .62) : '#ffffff';
      g.addColorStop(0, this.alpha(teinte, .1 + rnd() * .12));
      g.addColorStop(1, this.alpha(teinte, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // ══ Carte : coins rentrants + encoches de perforation ══
    const X = P(40), Y = P(32), X2 = P(983), Y2 = P(1504);
    const RC = P(47), RE = P(32), yPerfo = P(839);
    const contour = () => this.contourBillet(ctx, X, Y, X2, Y2, RC, yPerfo, RE);

    ctx.save();
    contour();
    ctx.fillStyle = papier;
    ctx.fill();
    ctx.clip();
    // grain de papier, très léger
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = this.alpha(rnd() > .5 ? c.tertiaire : '#ffffff', .05 + rnd() * .08);
      ctx.fillRect(X + rnd() * (X2 - X), Y + rnd() * (Y2 - Y), 1.6, 1.6);
    }
    // paysages côtiers peints dans la carte
    this.poserDecor(ctx, decors, 'plage-bas-gauche.webp', k);
    this.poserDecor(ctx, decors, 'plage-droite.webp', k);
    ctx.restore();

    ctx.lineWidth = P(2.4);
    ctx.strokeStyle = or;
    contour();
    ctx.stroke();

    // ══ Haut : monogramme, surtitre, prénoms ══
    const [mono1, mono2] = this.monogramme().split(' & ');
    if (mono2) {
      ctx.font = `500 ${P(40)}px ${A}`;
      const l1 = ctx.measureText(mono1 + ' ').width;
      ctx.font = `italic 500 ${P(34)}px ${A}`;
      const le = ctx.measureText('&').width;
      ctx.font = `500 ${P(40)}px ${A}`;
      const l2 = ctx.measureText(' ' + mono2).width;
      let x = W / 2 - (l1 + le + l2) / 2;
      this.ecrire(ctx, mono1 + ' ', x, P(133), { police: n => `500 ${n}px ${A}`, taille: P(40), couleur: encre });
      x += l1;
      this.ecrire(ctx, '&', x, P(133), { police: n => `italic 500 ${n}px ${A}`, taille: P(34), couleur: or });
      x += le;
      this.ecrire(ctx, ' ' + mono2, x, P(133), { police: n => `500 ${n}px ${A}`, taille: P(40), couleur: encre });
    } else {
      this.ecrire(ctx, this.monogramme(), W / 2, P(133), { police: n => `500 ${n}px ${A}`, taille: P(40), couleur: encre, align: 'center' });
    }
    this.ornement(ctx, W / 2, P(174), P(118), P(22), or);

    this.titreEncadre(ctx, "BILLET D'INVITATION", P(251), P(97), P(24),
      { police: n => `600 ${n}px ${T}`, taille: P(25), esp: P(8.5), couleur: or }, or, k);

    const [p1, p2] = this.prenoms();
    const optNom = { police: (n: number) => `400 ${n}px ${S}`, taille: P(86), max: P(600), couleur: c.secondaire, align: 'center' as const };
    if (p2) {
      this.ecrire(ctx, p1, W / 2, P(372), optNom);
      this.titreEncadre(ctx, '&', P(436), P(140), P(22),
        { police: n => `400 ${n}px ${A}`, taille: P(52), couleur: encre }, or, k, P(-17));
      this.ecrire(ctx, p2, W / 2, P(522), optNom);
    } else {
      this.ecrire(ctx, m?.nomsCouple ?? '', W / 2, P(450), optNom);
    }

    // ══ Date & lieu : icône | filet | texte ══
    const xIcone = P(286), xFilet = P(344), xTexte = P(377), maxTexte = P(575);
    const date = this.dateBillet();
    this.iconeCalendrier(ctx, xIcone, P(629), P(46), encre, k);
    this.filetVertical(ctx, xFilet, P(592), P(680), or, k);
    if (date) {
      const d = date.longue.charAt(0).toUpperCase() + date.longue.slice(1);
      this.ecrire(ctx, d, xTexte, P(635), { police: n => `500 ${n}px ${A}`, taille: P(40), max: maxTexte, couleur: encre });
    }
    this.ecrire(ctx, `À ${this.heure().toUpperCase()}`, xTexte, P(673), { police: n => `600 ${n}px ${T}`, taille: P(21), esp: P(6), couleur: or });

    this.iconeLieu(ctx, xIcone, P(750), P(48), c.secondaire);
    this.filetVertical(ctx, xFilet, P(718), P(800), or, k);
    this.ecrire(ctx, LIEU.nom.toUpperCase(), xTexte, P(758), { police: n => `500 ${n}px ${A}`, taille: P(31), max: maxTexte, esp: P(1.6), couleur: encre });
    this.ecrire(ctx, `${LIEU.ville} – ${LIEU.quartier}`.toUpperCase(), xTexte, P(792), { police: n => `400 ${n}px ${T}`, taille: P(18), max: maxTexte, esp: P(6.5), couleur: pale });

    // ══ Perforation ══
    ctx.save();
    ctx.setLineDash([P(9), P(7)]);
    ctx.lineWidth = P(1.6);
    ctx.strokeStyle = or;
    ctx.beginPath();
    ctx.moveTo(X + RE + P(6), yPerfo);
    ctx.lineTo(X2 - RE - P(6), yPerfo);
    ctx.stroke();
    ctx.restore();

    // ══ Talon : invité, places, QR ══
    this.titreEncadre(ctx, 'INVITÉ·E', P(911), P(100), P(36),
      { police: n => `600 ${n}px ${T}`, taille: P(21), esp: P(6), couleur: encre }, or, k);
    this.ecrire(ctx, this.nomInvite().toUpperCase(), W / 2, P(970), { police: n => `500 ${n}px ${A}`, taille: P(36), max: P(780), esp: P(1.4), couleur: encre, align: 'center' });

    const places = this.deuxPlaces() ? '2 PLACES' : '1 PLACE';
    const optPlaces = { police: (n: number) => `600 ${n}px ${T}`, taille: P(20), esp: P(5.5), couleur: encre };
    ctx.font = optPlaces.police(optPlaces.taille);
    const lPlaces = this.largeurTexte(ctx, places, optPlaces.esp);
    const lPastille = P(44) + P(26) + P(14) + lPlaces + P(40);
    const xPastille = W / 2 - lPastille / 2;
    ctx.lineWidth = P(1.8);
    ctx.strokeStyle = or;
    this.rectArrondi(ctx, xPastille, P(1003), lPastille, P(54), P(27));
    ctx.stroke();
    this.iconePersonne(ctx, xPastille + P(44) + P(13), P(1030), P(26), or, k);
    this.ecrire(ctx, places, xPastille + P(44) + P(26) + P(14), P(1037), optPlaces);

    // QR dans un cadre blanc à coins dorés
    const tCadre = P(262), xCadre = W / 2 - tCadre / 2, yCadre = P(1088);
    ctx.fillStyle = '#ffffff';
    this.rectArrondi(ctx, xCadre, yCadre, tCadre, tCadre, P(8));
    ctx.fill();
    ctx.lineWidth = P(1.6);
    ctx.strokeStyle = orClair;
    ctx.stroke();
    this.coinsCadre(ctx, xCadre + P(10), yCadre + P(10), tCadre - P(20), P(26), or, k);
    const tQr = P(214);
    ctx.imageSmoothingEnabled = false;             // modules du QR bien nets
    ctx.drawImage(qr, W / 2 - tQr / 2, yCadre + (tCadre - tQr) / 2, tQr, tQr);
    ctx.imageSmoothingEnabled = true;

    const code = this.codeBillet();
    if (code) {
      // Code de secours, si le QR ne passe pas : « CODE  K7P-4MX »
      this.ecrire(ctx, "Présentez ce code à l'entrée", W / 2, P(1394), { police: n => `italic 500 ${n}px ${A}`, taille: P(28), max: P(600), couleur: encre, align: 'center' });
      const optLabel = { police: (n: number) => `600 ${n}px ${T}`, taille: P(15), esp: P(5), couleur: pale };
      const optCode = { police: (n: number) => `700 ${n}px ${T}`, taille: P(25), esp: P(5), couleur: encre };
      ctx.font = optLabel.police(optLabel.taille);
      const lLabel = this.largeurTexte(ctx, 'CODE', optLabel.esp);
      ctx.font = optCode.police(optCode.taille);
      const lCode = this.largeurTexte(ctx, code, optCode.esp);
      const ecart = P(16);
      const x0 = W / 2 - (lLabel + ecart + lCode) / 2;
      this.ecrire(ctx, 'CODE', x0, P(1444), optLabel);
      this.ecrire(ctx, code, x0 + lLabel + ecart, P(1446), optCode);
    } else {
      this.ornement(ctx, W / 2, P(1372), P(118), P(22), or);
      this.ecrire(ctx, "Présentez ce code à l'entrée", W / 2, P(1422), { police: n => `italic 500 ${n}px ${A}`, taille: P(30), max: P(600), couleur: encre, align: 'center' });
    }

    // ══ Bouquets par-dessus le cadre, comme sur la maquette ══
    this.poserDecor(ctx, decors, 'fleurs-haut-gauche.webp', k);
    this.poserDecor(ctx, decors, 'feuillage-haut-droite.webp', k);
    this.poserDecor(ctx, decors, 'fleurs-bas-droite.webp', k);

    return new Promise((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
  }

  private poserDecor(ctx: CanvasRenderingContext2D, decors: Record<string, HTMLImageElement | null>, fichier: string, k: number): void {
    const img = decors[fichier];
    const d = DECORS_BILLET.find(x => x.fichier === fichier);
    if (!img || !d) return;
    ctx.drawImage(img, d.x * k, d.y * k, d.l * k, d.h * k);
  }

  /** Contour du billet : coins en quart de cercle rentrant, encoches à la perforation. */
  private contourBillet(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, rc: number, yp: number, re: number): void {
    ctx.beginPath();
    ctx.moveTo(x1 + rc, y1);
    ctx.lineTo(x2 - rc, y1);
    ctx.arc(x2, y1, rc, Math.PI, Math.PI / 2, true);
    ctx.lineTo(x2, yp - re);
    ctx.arc(x2, yp, re, -Math.PI / 2, Math.PI / 2, true);
    ctx.lineTo(x2, y2 - rc);
    ctx.arc(x2, y2, rc, -Math.PI / 2, Math.PI, true);
    ctx.lineTo(x1 + rc, y2);
    ctx.arc(x1, y2, rc, 0, -Math.PI / 2, true);
    ctx.lineTo(x1, yp + re);
    ctx.arc(x1, yp, re, Math.PI / 2, -Math.PI / 2, true);
    ctx.lineTo(x1, y1 + rc);
    ctx.arc(x1, y1, rc, Math.PI / 2, 0, true);
    ctx.closePath();
  }

  /** Texte centré entre deux filets dorés. */
  private titreEncadre(
    ctx: CanvasRenderingContext2D, texte: string, y: number, longueur: number, ecart: number,
    o: { police: (n: number) => string; taille: number; couleur: string; esp?: number },
    couleurFilet: string, k: number, decalageFilet = -o.taille * .36,
  ): void {
    const W = ctx.canvas.width;
    ctx.font = o.police(o.taille);
    const l = this.largeurTexte(ctx, texte, o.esp ?? 0);
    this.ecrire(ctx, texte, W / 2, y, { ...o, align: 'center' });
    const yf = y + decalageFilet;
    ctx.lineWidth = 1.4 * k;
    ctx.strokeStyle = couleurFilet;
    ctx.beginPath();
    ctx.moveTo(W / 2 - l / 2 - ecart, yf); ctx.lineTo(W / 2 - l / 2 - ecart - longueur, yf);
    ctx.moveTo(W / 2 + l / 2 + ecart, yf); ctx.lineTo(W / 2 + l / 2 + ecart + longueur, yf);
    ctx.stroke();
  }

  /** Coquillage entre deux filets. */
  private ornement(ctx: CanvasRenderingContext2D, x: number, y: number, longueur: number, taille: number, couleur: string): void {
    const ecart = taille * 1.05;
    ctx.lineWidth = Math.max(1, taille / 16);
    ctx.strokeStyle = couleur;
    ctx.beginPath();
    ctx.moveTo(x - ecart, y); ctx.lineTo(x - ecart - longueur, y);
    ctx.moveTo(x + ecart, y); ctx.lineTo(x + ecart + longueur, y);
    ctx.stroke();
    this.coquillage(ctx, x, y, taille, couleur);
  }

  private coquillage(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, couleur: string): void {
    const r = t * .62;
    const base = y + t * .42;
    ctx.save();
    // éventail
    ctx.beginPath();
    ctx.moveTo(x - t * .12, base);
    ctx.lineTo(x - r, y);
    ctx.arc(x, y, r, Math.PI, 0);
    ctx.lineTo(x + t * .12, base);
    ctx.closePath();
    ctx.fillStyle = this.alpha(this.melanger(couleur, '#ffffff', .25), .95);
    ctx.fill();
    // côtes
    ctx.strokeStyle = this.melanger(couleur, '#000000', .2);
    ctx.lineWidth = Math.max(.8, t / 22);
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI + (Math.PI * i) / 6;
      ctx.beginPath();
      ctx.moveTo(x, base - t * .04);
      ctx.lineTo(x + Math.cos(a) * r * .96, y + Math.sin(a) * r * .96);
      ctx.stroke();
    }
    // charnière
    ctx.fillStyle = couleur;
    ctx.beginPath();
    ctx.ellipse(x, base, t * .2, t * .09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private filetVertical(ctx: CanvasRenderingContext2D, x: number, y1: number, y2: number, couleur: string, k: number): void {
    ctx.lineWidth = 1.4 * k;
    ctx.strokeStyle = couleur;
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();
  }

  private iconeCalendrier(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, couleur: string, k: number): void {
    const x = cx - t / 2, y = cy - t / 2 + t * .06;
    ctx.save();
    ctx.lineWidth = 2.6 * k;
    ctx.strokeStyle = couleur;
    ctx.lineCap = 'round';
    this.rectArrondi(ctx, x, y, t, t * .9, t * .14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + t * .26); ctx.lineTo(x + t, y + t * .26);
    ctx.moveTo(x + t * .28, y - t * .1); ctx.lineTo(x + t * .28, y + t * .1);
    ctx.moveTo(x + t * .72, y - t * .1); ctx.lineTo(x + t * .72, y + t * .1);
    ctx.stroke();
    ctx.fillStyle = couleur;
    for (let l = 0; l < 3; l++) {
      for (let col = 0; col < 4; col++) {
        ctx.fillRect(x + t * (.17 + col * .22) - t * .04, y + t * (.42 + l * .15) - t * .03, t * .08, t * .06);
      }
    }
    ctx.restore();
  }

  private iconeLieu(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, couleur: string): void {
    const r = t * .36;
    const yc = cy - t * .12;
    ctx.save();
    ctx.fillStyle = couleur;
    ctx.beginPath();
    ctx.arc(cx, yc, r, Math.PI * .82, Math.PI * .18);
    ctx.quadraticCurveTo(cx + r * .45, yc + r * 1.25, cx, cy + t * .5);
    ctx.quadraticCurveTo(cx - r * .45, yc + r * 1.25, cx - r * Math.cos(Math.PI * .18), yc + r * Math.sin(Math.PI * .18));
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, yc, r * .4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private iconePersonne(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, couleur: string, k: number): void {
    ctx.save();
    ctx.lineWidth = 1.8 * k;
    ctx.strokeStyle = couleur;
    ctx.beginPath();
    ctx.arc(cx, cy - t * .2, t * .22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - t * .42, cy + t * .48);
    ctx.quadraticCurveTo(cx - t * .42, cy + t * .1, cx, cy + t * .1);
    ctx.quadraticCurveTo(cx + t * .42, cy + t * .1, cx + t * .42, cy + t * .48);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  /** Quatre équerres dorées à l'intérieur du cadre du QR. */
  private coinsCadre(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, l: number, couleur: string, k: number): void {
    ctx.save();
    ctx.lineWidth = 1.8 * k;
    ctx.strokeStyle = couleur;
    ctx.beginPath();
    for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + t, y, -1, 1], [x, y + t, 1, -1], [x + t, y + t, -1, -1]]) {
      ctx.moveTo(cx, cy + sy * l);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + sx * l, cy);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Générateur pseudo-aléatoire à graine : le billet est identique à chaque génération. */
  private aleatoire(graine: number): () => number {
    let s = graine;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  /** Écrit un texte (espacement des lettres, réduction automatique, alignement gauche/centre). */
  private ecrire(
    ctx: CanvasRenderingContext2D, texte: string, x: number, y: number,
    o: { police: (n: number) => string; taille: number; couleur: string | CanvasGradient; max?: number; esp?: number; align?: 'left' | 'center' },
  ): void {
    const esp = o.esp ?? 0;
    let n = o.taille;
    ctx.font = o.police(n);
    let w = this.largeurTexte(ctx, texte, esp);
    while (o.max && w > o.max && n > 10) {
      n -= 1;
      ctx.font = o.police(n);
      w = this.largeurTexte(ctx, texte, esp);
    }
    ctx.fillStyle = o.couleur;
    ctx.textAlign = 'left';
    let cx = o.align === 'center' ? x - w / 2 : x;
    if (!esp) {
      ctx.fillText(texte, cx, y);
    } else {
      for (const l of texte) { ctx.fillText(l, cx, y); cx += ctx.measureText(l).width + esp; }
    }
    ctx.textAlign = 'center';
  }

  private largeurTexte(ctx: CanvasRenderingContext2D, texte: string, esp: number): number {
    if (!esp) return ctx.measureText(texte).width;
    const lettres = [...texte];
    return lettres.reduce((a, l) => a + ctx.measureText(l).width, 0) + esp * (lettres.length - 1);
  }

  // ═══════════════ Billet mémorisé sur le téléphone ═══════════════

  private cleStockage(): string {
    return `rsvp-billet:${this.slug}`;
  }

  private memoriserBillet(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const i = this.identification();
    const donnees: BilletMemorise = {
      prenom: i?.prenom ?? this.prenom(),
      nom: i?.nom ?? this.nom(),
      deuxPlaces: this.deuxPlaces(),
      statut: this.resultatStatut(),
      billetUrl: this.billetUrl(),
      codeBillet: this.codeBillet(),
    };
    try { localStorage.setItem(this.cleStockage(), JSON.stringify(donnees)); } catch { /* stockage indisponible */ }
  }

  private restaurerBillet(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const brut = localStorage.getItem(this.cleStockage());
      if (!brut) return;
      const b = JSON.parse(brut) as BilletMemorise;
      this.prenom.set(b.prenom);
      this.nom.set(b.nom);
      this.deuxPlaces.set(!!b.deuxPlaces || !!b.conjoint);
      this.resultatStatut.set(b.statut);
      this.billetUrl.set(b.billetUrl);
      this.codeBillet.set(b.codeBillet ?? null);
      this.etape.set('RESULTAT');
      if (b.billetUrl) this.preparerBillet();
    } catch { /* données illisibles : on repart de zéro */ }
  }

  private oublierBillet(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try { localStorage.removeItem(this.cleStockage()); } catch { /* rien */ }
  }

  // ═══════════════ Utilitaires ═══════════════

  private chargerImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  private rectArrondi(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  private melanger(a: string, b: string, t: number): string {
    const pa = this.rgb(a), pb = this.rgb(b);
    const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
    return '#' + m.map(v => v.toString(16).padStart(2, '0')).join(''); // hex : réutilisable par alpha()
  }

  private alpha(hex: string, a: number): string {
    const [r, g, b] = this.rgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  private rgb(hex: string): number[] {
    const h = hex.replace('#', '');
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  }

  private dateLocale(iso: string): Date {
    const [a, mo, j] = iso.slice(0, 10).split('-').map(Number);
    return new Date(a, mo - 1, j);
  }

  private formaterHeure(heure: string): string {
    const [h, m] = heure.split(':');
    return m ? `${h}h${m}` : heure;
  }

  private chargerPolices(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.document.head.querySelector('link[data-polices-save-the-date]')) return;
    const link = this.document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Montserrat:wght@400;600&family=Pinyon+Script&display=swap';
    link.setAttribute('data-polices-save-the-date', '');
    this.document.head.appendChild(link);
  }
}
