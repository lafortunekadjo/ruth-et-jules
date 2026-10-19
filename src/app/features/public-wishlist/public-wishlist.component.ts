import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MariagePublic, MariagePublicService } from '../../core/mariage-public.service';
import { WishlistPublicService } from '../../core/wishlist-public.service';
import { MoyenPaiement, WishlistItem } from '../../core/models/admin.models';
import { chargerPolicesInvitation, couleursMariage, monogrammeDe } from '../../shared/invitation-theme';

type Filtre = 'tous' | 'disponibles';

/** Mots-clés (nom sans accents) → icône. Le premier qui correspond l'emporte. */
const ICONES_PAR_MOT: [RegExp, string][] = [
  [/friteuse|air ?fryer/, 'friteuse'],
  [/lave|laver|linge|seche/, 'lave-linge'],
  [/frigo|refrigerateur|congelateur/, 'frigo'],
  [/micro.?onde/, 'micro-ondes'],
  [/\b(tele|tv|televiseur|television|ecran)\b/, 'tv'],
  [/mixeur|blender|hachoir/, 'mixeur'],
  [/robot|batteur|petrin/, 'robot'],
  [/cafe|cafetiere|expresso|espresso|tasse|\bthe\b/, 'tasse'],
  [/repasser|\bfer\b/, 'fer'],
  [/aspirateur/, 'aspirateur'],
  [/assiette|vaisselle|service|couvert|\bplats?\b/, 'vaisselle'],
  [/verre|flute|champagne|carafe/, 'verres'],
  [/\b(lit|draps?|couette|matelas|oreillers?|parure|literie)\b/, 'lit'],
  [/cuisiniere|gaziniere|\bfour\b|plaque/, 'cuisiniere'],
  [/casserole|marmite|poele|cocotte|batterie/, 'casserole'],
  [/ventil|clim/, 'ventilateur'],
  [/bouilloire/, 'bouilloire'],
  [/canape|fauteuil|meuble|chaise|\btable\b/, 'canape'],
];

/** Une ligne des coordonnées de paiement, découpée autour du numéro à copier. */
interface LignePaiement { texte: string; avant: string; numero: string; apres: string; aCopier: string | null; }

/** Devise affichée — les prix arrivent du backend en nombre. */
const DEVISE = 'FCFA';

const LIBELLE_MOYEN: Record<MoyenPaiement, string> = {
  MOBILE_MONEY: 'Mobile Money',
  VIREMENT: 'Virement bancaire',
};

@Component({
  selector: 'app-public-wishlist',
  standalone: true,
  imports: [FormsModule, RouterLink],
  styleUrls: ['../../shared/invitation-commun.css'],
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
      <header class="entete">
        <a class="retour" [routerLink]="['/m', slug]" [queryParams]="{ vers: 'rsvp' }" aria-label="Retour à l'invitation">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg><span>Invitation</span>
        </a>
        <p class="entete-mono">{{ monogramme() }}</p>
      </header>

      <section class="titre-page">
        <p class="surtitre">Avec toute notre gratitude</p>
        <h1>Nos souhaits</h1>
        <div class="ornement" aria-hidden="true"><span></span><i></i><span></span></div>
        <p class="intro">Votre présence est le plus beau des cadeaux. Si vous souhaitez nous témoigner votre générosité, voici quelques pistes.</p>
      </section>

      @if (chargement()) {
        <div class="souhaits">
          @for (s of [1, 2]; track s) { <div class="squelette carte-squelette"></div> }
        </div>
      } @else if (items().length === 0) {
        <div class="vide">
          <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="18" width="34" height="24" rx="2"/><path d="M4 12h40v6H4zM24 12v30M24 12c-3-7-12-8-12-2 0 3 6 2 12 2zM24 12c3-7 12-8 12-2 0 3-6 2-12 2z"/></svg>
          <p>Nos souhaits seront bientôt partagés ici.</p>
        </div>
      } @else {
        <!-- ① Cadeaux matériels : une icône fine, le nom, c'est tout -->
        @if (materiels().length) {
          <div class="filtres-doux" role="tablist">
            <button type="button" role="tab" [class.actif]="filtre() === 'tous'" [attr.aria-selected]="filtre() === 'tous'" (click)="filtre.set('tous')">Tous</button>
            <span aria-hidden="true">·</span>
            <button type="button" role="tab" [class.actif]="filtre() === 'disponibles'" [attr.aria-selected]="filtre() === 'disponibles'" (click)="filtre.set('disponibles')">
              Encore disponibles ({{ disponibles() }})
            </button>
          </div>

          <ol class="souhaits">
            @for (item of materielsAffiches(); track item.id; let i = $index) {
              <li class="souhait apparition" [style.--i]="i" [class.souhait--offert]="estComplet(item)">
                <span class="souhait-num">{{ numero(i) }}</span>
                <span class="medaille" aria-hidden="true">
                  @switch (iconeDe(item)) {
                      @case ('friteuse') { <svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="16" rx="3.5"/><path d="M5 11h14M9.5 15.5h5M9 7.5h.01M12 7.5h.01M15 7.5h.01"/></svg> }
                      @case ('lave-linge') { <svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="13.5" r="4.5"/><path d="M10 13c1 .8 3 .8 4 0M4 7h16M7 5h.01M10 5h.01"/></svg> }
                      @case ('frigo') { <svg viewBox="0 0 24 24"><rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M6 10h12M9 5.5v2M9 13v3"/></svg> }
                      @case ('tv') { <svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="12.5" rx="1.5"/><path d="M8 21h8M12 17v4"/></svg> }
                      @case ('micro-ondes') { <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="13" rx="2"/><rect x="6" y="8" width="9" height="7" rx="1"/><path d="M18 9v.01M18 12v.01M6 20.5v-2.5M18 20.5v-2.5"/></svg> }
                      @case ('mixeur') { <svg viewBox="0 0 24 24"><path d="M7.5 3h9L15 13H9z"/><path d="M8.5 13h7l1 8h-9z"/><path d="M12 17v.01M10 7h4"/></svg> }
                      @case ('robot') { <svg viewBox="0 0 24 24"><path d="M4 9.5a5.5 4.5 0 0 1 11 0V11H4z"/><path d="M15 8h2.5a1.5 1.5 0 0 1 1.5 1.5V21H8.5"/><path d="M5.5 14h8l-1 5h-6z"/><path d="M9.5 11v3"/></svg> }
                      @case ('tasse') { <svg viewBox="0 0 24 24"><path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3c-.8 1 .8 2 0 3.5M12 3c-.8 1 .8 2 0 3.5M4 21h14"/></svg> }
                      @case ('fer') { <svg viewBox="0 0 24 24"><path d="M3 17.5h16.5a1.5 1.5 0 0 0 1.5-1.5c0-4-3-7-7-7H9.5C6 9 3 12.5 3 17.5z"/><path d="M9.5 9V6.5H17M7 14h.01M10 14h.01M13 14h.01"/></svg> }
                      @case ('aspirateur') { <svg viewBox="0 0 24 24"><circle cx="16.5" cy="17.5" r="3.5"/><path d="M13 19H5a2 2 0 0 1-2-2l2-2h8"/><path d="M8 15V6a3 3 0 0 1 6 0v1"/></svg> }
                      @case ('vaisselle') { <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="3.5"/><path d="M2.5 4v4.5a1.5 1.5 0 0 0 3 0V4M4 10v10M21.5 4c-1.6 1-2.2 3-2.2 5.5h2.2V20"/></svg> }
                      @case ('verres') { <svg viewBox="0 0 24 24"><path d="M5 3h5.5l-.8 5.2a2.4 2.4 0 0 1-4.7 0z"/><path d="M7.4 10.6V19M5 20h5M13.5 3H19l-.8 5.2a2.4 2.4 0 0 1-4.7 0z"/><path d="M16 10.6V19M13.5 20H19"/></svg> }
                      @case ('lit') { <svg viewBox="0 0 24 24"><path d="M3 19V6M3 14h18v5M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="6.8" cy="11" r="1.8"/></svg> }
                      @case ('cuisiniere') { <svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 8h16M8 5.5h.01M12 5.5h.01M16 5.5h.01"/><rect x="7" y="11" width="10" height="7" rx="1"/></svg> }
                      @case ('casserole') { <svg viewBox="0 0 24 24"><path d="M5 10h14v5.5a4.5 4.5 0 0 1-4.5 4.5h-5A4.5 4.5 0 0 1 5 15.5z"/><path d="M2.5 10h19M10 7h4M12 7V5.5"/></svg> }
                      @case ('ventilateur') { <svg viewBox="0 0 24 24"><circle cx="12" cy="10" r="1.6"/><path d="M12 8.4c-.4-3.3 1.5-5 3.4-4.6 1.9.5 1.6 3.2-3.4 4.6M13.6 10.4c3 1.3 3.6 3.8 2.3 5-1.4 1.2-3.5-.3-3.7-5M10.4 10.2c-2.7 1.9-5.1 1.3-5.5-.5-.4-1.9 1.9-3 5.5.5M12 11.6V20M8 21h8"/></svg> }
                      @case ('bouilloire') { <svg viewBox="0 0 24 24"><path d="M6 20h11l-1.2-8.5a4.3 4.3 0 0 0-8.6 0z"/><path d="M7.5 12.5c-2 0-3.8-1.2-4.5-3M16 13h1.3a2.2 2.2 0 0 0 0-4.4H16M9.5 5h4"/></svg> }
                      @case ('canape') { <svg viewBox="0 0 24 24"><path d="M4.5 11V8a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><path d="M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2z"/><path d="M5 18v2M19 18v2"/></svg> }
                      @default { <svg viewBox="0 0 24 24"><path d="M20 12v9H4v-9M2.5 7h19v5h-19zM12 21V7M12 7C10 3 6 3 6 5.5S9 7 12 7zM12 7c2-4 6-4 6-1.5S15 7 12 7z"/></svg> }
                  }
                </span>
                <h2>{{ item.nom }}</h2>
                @if (item.prix) { <p class="souhait-prix">{{ formaterPrix(item.prix) }}</p> }
                @if (lienSur(item.lien); as url) {
                  <a class="souhait-lien" [href]="url" target="_blank" rel="noopener noreferrer"
                     [attr.aria-label]="'Voir ' + item.nom + ' sur ' + domaine(url) + ' (nouvel onglet)'">
                    {{ domaine(url) }}
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>
                  </a>
                }
                @if (quantite(item) > 1 && !estComplet(item)) {
                  <p class="souhait-quantite">{{ quantite(item) - nb(item) }} / {{ quantite(item) }} à offrir</p>
                }

                @if (estComplet(item)) {
                  <p class="souhait-merci">{{ mesCadeaux().has(item.id) ? 'Vous l’offrez ♥' : 'Déjà offert ♥' }}</p>
                } @else if (mesCadeaux().has(item.id) && quantite(item) === 1) {
                  <p class="souhait-merci">Vous l’offrez ♥</p>
                } @else {
                  <button type="button" class="lien-offrir" (click)="ouvrir(item)">Je l’offre</button>
                }
              </li>
            } @empty {
              <li class="tout-offert">Tous nos souhaits ont trouvé preneur, merci ! ♥</li>
            }
          </ol>
        }

        <!-- ② Toute autre attention : coordonnées à copier -->
        @if (monetaires().length) {
          <section class="interlude apparition" [class.interlude--seul]="!materiels().length">
            @if (materiels().length) { <span class="interlude-fil" aria-hidden="true"></span> }
            <span class="medaillon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 21s-7-4.5-9.2-9C1.5 8.4 3.6 5 7 5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.4 0 5.5 3.4 4.2 7-2.2 4.5-9.2 9-9.2 9z"/></svg>
            </span>
            <p class="interlude-script">{{ materiels().length ? 'Ou toute autre attention…' : 'Un geste du cœur' }}</p>
            <p class="interlude-texte">
              Vous préférez nous laisser choisir ? Vous pouvez aussi nous accompagner librement dans nos projets.
              Chaque attention, petite ou grande, nous touchera profondément.
            </p>
          </section>

          <div class="contributions">
            @for (item of monetaires(); track item.id; let i = $index) {
              <article class="carte-douce contribution apparition" [style.--i]="i">
                <header class="contribution-entete">
                  <span class="contribution-icone" aria-hidden="true">
                    @if (item.moyenPaiement === 'VIREMENT') {
                      <svg viewBox="0 0 24 24"><path d="M3 10h18L12 4 3 10zM5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/></svg>
                    } @else {
                      <svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 17.5h2"/></svg>
                    }
                  </span>
                  <div>
                    <h2>{{ item.nom }}</h2>
                    @if (item.moyenPaiement) { <p class="contribution-moyen">{{ libelleMoyen(item.moyenPaiement) }}</p> }
                  </div>
                </header>

                @if (item.description) { <p class="contribution-desc">{{ item.description }}</p> }
                @if (item.prix) { <p class="contribution-suggere">Montant suggéré : {{ formaterPrix(item.prix) }}</p> }

                <div class="lignes">
                  @for (l of lignes(item.infosPaiement); track $index; let k = $index) {
                    @if (l.aCopier) {
                      <div class="ligne ligne--valeur">
                        <div class="ligne-texte">
                          @if (l.avant) { <span class="ligne-libelle">{{ l.avant }}</span> }
                          <span class="ligne-numero">{{ l.numero }}</span>
                          @if (l.apres) { <span class="ligne-titulaire">{{ l.apres }}</span> }
                        </div>
                        <button type="button" class="copier" (click)="copier(l.aCopier, item.id + '-' + k)"
                                [attr.aria-label]="'Copier ' + l.aCopier">
                          @if (copieCle() === item.id + '-' + k) { Copié ✓ } @else {
                            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>
                            Copier
                          }
                        </button>
                      </div>
                    } @else {
                      <p class="ligne ligne--note">{{ l.texte }}</p>
                    }
                  }
                </div>
              </article>
            }
          </div>
        }
      }

      <!-- ───── Feuille de réservation / participation ───── -->
      @if (selection(); as item) {
        <div class="voile-feuille" (click)="fermer()"></div>
        <div class="feuille" role="dialog" aria-modal="true" aria-labelledby="titre-reservation">
          <div class="resume">
            <div>
              <p class="surtitre">Vous offrez</p>
              <h2 id="titre-reservation">{{ item.nom }}</h2>
              @if (item.prix) { <p class="resume-prix">{{ formaterPrix(item.prix) }}</p> }
              @if (lienSur(item.lien); as url) {
                <a class="souhait-lien resume-lien" [href]="url" target="_blank" rel="noopener noreferrer">
                  Voir sur {{ domaine(url) }}
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>
                </a>
              }
            </div>
          </div>

          <form (ngSubmit)="confirmerReservation(item)">
            <div class="deux-colonnes">
              <div>
                <label for="res-prenom">Prénom</label>
                <input id="res-prenom" class="champ" name="prenom" [(ngModel)]="prenom"
                       required maxlength="100" autocomplete="given-name" autocapitalize="words" />
              </div>
              <div>
                <label for="res-nom">Nom</label>
                <input id="res-nom" class="champ" name="nom" [(ngModel)]="nom"
                       required maxlength="100" autocomplete="family-name" autocapitalize="words" />
              </div>
            </div>

            <p class="aide">Indiquez le nom figurant sur votre invitation. Seuls les mariés le verront.</p>

            @if (erreur()) { <p class="erreur" role="alert">{{ erreur() }}</p> }

            <div class="actions-feuille">
              <button type="submit" class="bouton" [disabled]="envoi() || !prenom().trim() || !nom().trim()">
                @if (envoi()) { <span class="spinner" aria-hidden="true"></span> Envoi… }
                @else { Confirmer }
              </button>
              <button type="button" class="bouton bouton-discret" (click)="fermer()">Annuler</button>
            </div>
          </form>
        </div>
      }

      @if (toast()) { <div class="toast" role="status">{{ toast() }}</div> }
    </div>
  `,
  styles: [`
    /* Titre */
    .ornement { display: flex; align-items: center; justify-content: center; gap: .6rem; margin: .2rem 0 .9rem; }
    .ornement span { width: 64px; height: 1px; background: color-mix(in srgb, var(--couleur-tertiaire) 80%, transparent); }
    .ornement i { width: 7px; height: 7px; transform: rotate(45deg); border: 1px solid var(--couleur-secondaire); }
    .titre-page .intro { font-family: var(--affichage); font-style: italic; font-size: 1.12rem; line-height: 1.6; }

    /* Filtre discret */
    .filtres-doux { display: flex; align-items: center; justify-content: center; gap: .6rem; margin: 0 auto 1.5rem; color: var(--encre-douce); }
    .filtres-doux button {
      min-height: 40px; padding: 0 .25rem; border: none; background: none; cursor: pointer;
      font-family: var(--texte); font-size: .66rem; letter-spacing: .22em; text-transform: uppercase; color: var(--encre-douce);
      border-bottom: 1px solid transparent; transition: color 200ms ease, border-color 200ms ease;
    }
    .filtres-doux button.actif { color: var(--couleur-secondaire); border-bottom-color: var(--couleur-secondaire); }

    /* Carte douce, commune aux souhaits et aux contributions */
    .carte-douce {
      position: relative;
      padding: 2rem 1.4rem 1.75rem;
      background: linear-gradient(180deg, #fff, color-mix(in srgb, var(--couleur-tertiaire) 9%, #fff));
      border: 1px solid color-mix(in srgb, var(--couleur-tertiaire) 38%, transparent);
      border-radius: 4px;
      box-shadow: 0 18px 40px -30px color-mix(in srgb, var(--couleur-texte) 45%, transparent);
    }
    /* fines arabesques dans les coins */
    .carte-douce::before, .carte-douce::after {
      content: ''; position: absolute; width: 34px; height: 34px; pointer-events: none;
      border: 1px solid color-mix(in srgb, var(--couleur-tertiaire) 60%, transparent);
    }
    .carte-douce::before { top: 7px; left: 7px; border-right: none; border-bottom: none; border-radius: 14px 0 0 0; }
    .carte-douce::after { bottom: 7px; right: 7px; border-left: none; border-top: none; border-radius: 0 0 14px 0; }

    /* ① Souhaits matériels : tuiles épurées */
    .souhaits {
      list-style: none; padding: 0; margin: 0 auto; max-width: 980px;
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .9rem;
    }
    .carte-squelette { height: 220px; }
    .souhait {
      position: relative;
      display: flex; flex-direction: column; align-items: center;
      padding: 1.4rem .8rem 1.2rem;
      text-align: center;
      background: linear-gradient(180deg, #fff, color-mix(in srgb, var(--couleur-tertiaire) 8%, #fff));
      border: 1px solid color-mix(in srgb, var(--couleur-tertiaire) 35%, transparent);
      border-radius: 999px 999px 6px 6px;          /* arche, comme le portrait */
      box-shadow: 0 16px 34px -28px color-mix(in srgb, var(--couleur-texte) 50%, transparent);
      transition: transform 300ms ease, box-shadow 300ms ease;
    }
    .souhait-num { font-size: .58rem; letter-spacing: .4em; color: var(--encre-douce); margin: .4rem 0 .7rem; }
    .medaille {
      width: 74px; height: 74px; border-radius: 50%;
      display: grid; place-items: center;
      background: color-mix(in srgb, var(--couleur-primaire) 7%, #fff);
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--couleur-tertiaire) 55%, transparent), 0 0 0 5px #fff, 0 0 0 6px color-mix(in srgb, var(--couleur-tertiaire) 30%, transparent);
    }
    .medaille svg { width: 34px; height: 34px; fill: none; stroke: var(--couleur-primaire); stroke-width: 1.25; stroke-linecap: round; stroke-linejoin: round; }
    .souhait h2 {
      margin-top: 1rem; min-height: 2.4em;
      display: flex; align-items: center;
      font-family: var(--affichage); font-weight: 500; font-size: 1.15rem; line-height: 1.2;
      overflow-wrap: anywhere;
    }
    .souhait-prix {
      margin-top: .35rem;
      font-family: var(--affichage); font-size: 1.05rem; font-weight: 500;
      color: var(--couleur-secondaire); font-variant-numeric: lining-nums;
    }
    .souhait-lien {
      display: inline-flex; align-items: center; gap: .3rem;
      margin-top: .3rem; min-height: 32px; padding: 0 .2rem; max-width: 100%;
      font-family: var(--texte); font-size: .62rem; letter-spacing: .08em;
      color: var(--couleur-primaire); text-decoration: none;
      border-bottom: 1px solid color-mix(in srgb, var(--couleur-primaire) 35%, transparent);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .souhait-lien:hover, .souhait-lien:focus-visible { border-bottom-color: var(--couleur-primaire); }
    .souhait-lien svg { flex: none; width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .souhait--offert .souhait-prix, .souhait--offert .souhait-lien { opacity: .5; }
    .resume-lien { margin-top: .35rem; font-size: .7rem; }
    .souhait-quantite { margin-top: .25rem; font-size: .56rem; letter-spacing: .18em; text-transform: uppercase; color: var(--couleur-primaire); }
    .lien-offrir {
      margin-top: .8rem; min-height: 40px; padding: 0 1.1rem;
      border-radius: 999px; cursor: pointer;
      border: 1px solid color-mix(in srgb, var(--couleur-secondaire) 55%, transparent);
      background: transparent; color: var(--couleur-secondaire);
      font-family: var(--texte); font-size: .62rem; font-weight: 600; letter-spacing: .2em; text-transform: uppercase;
      transition: background 250ms ease, color 250ms ease;
    }
    .lien-offrir:hover, .lien-offrir:focus-visible { background: var(--couleur-secondaire); color: #fff; }
    .souhait-merci { margin-top: .8rem; min-height: 40px; display: grid; place-items: center; font-family: var(--affichage); font-style: italic; font-size: 1rem; color: var(--couleur-secondaire); }
    .souhait--offert .medaille { opacity: .45; filter: grayscale(1); }
    .souhait--offert h2 { opacity: .55; }
    .tout-offert { grid-column: 1 / -1; text-align: center; padding: 1rem 0; font-family: var(--affichage); font-style: italic; font-size: 1.15rem; color: var(--couleur-secondaire); }
    @media (hover: hover) {
      .souhait:not(.souhait--offert):hover { transform: translateY(-3px); box-shadow: 0 22px 40px -28px color-mix(in srgb, var(--couleur-texte) 60%, transparent); }
    }

    /* ② Transition */
    .interlude { display: flex; flex-direction: column; align-items: center; max-width: 520px; margin: 3rem auto 1.75rem; text-align: center; }
    .interlude--seul { margin-top: .5rem; }
    .interlude-fil { width: 1px; height: 56px; background: linear-gradient(transparent, color-mix(in srgb, var(--couleur-tertiaire) 90%, transparent)); }
    .medaillon {
      width: 68px; height: 68px; border-radius: 50%; display: grid; place-items: center;
      background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--couleur-secondaire) 55%, #fff), var(--couleur-secondaire) 70%);
      box-shadow: 0 0 0 6px color-mix(in srgb, var(--couleur-secondaire) 12%, transparent), 0 12px 26px -10px color-mix(in srgb, var(--couleur-secondaire) 70%, transparent);
    }
    .medaillon svg { width: 26px; height: 26px; fill: #fff; }
    .interlude-script { margin-top: 1.1rem; font-family: var(--police-script, 'Pinyon Script', cursive); font-size: 2.4rem; line-height: 1.15; color: var(--couleur-secondaire); }
    .interlude-texte { margin-top: .6rem; font-family: var(--affichage); font-style: italic; font-size: 1.08rem; line-height: 1.6; color: var(--encre-douce); }

    /* Contributions */
    .contributions { display: grid; gap: 1.25rem; max-width: 560px; margin: 0 auto; }
    .contribution-entete { display: flex; align-items: center; gap: .9rem; }
    .contribution-icone {
      flex: none; width: 50px; height: 50px; border-radius: 50%; display: grid; place-items: center;
      border: 1px solid color-mix(in srgb, var(--couleur-tertiaire) 70%, transparent); background: #fff;
    }
    .contribution-icone svg { width: 22px; height: 22px; fill: none; stroke: var(--couleur-primaire); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
    .contribution h2 { font-family: var(--affichage); font-style: italic; font-weight: 500; font-size: 1.45rem; line-height: 1.2; }
    .contribution-moyen { margin-top: .15rem; font-size: .64rem; font-weight: 600; letter-spacing: .22em; text-transform: uppercase; color: var(--couleur-secondaire); }
    .contribution-desc { margin-top: .9rem; font-family: var(--affichage); font-style: italic; font-size: 1.05rem; color: var(--encre-douce); }
    .contribution-suggere { margin-top: .4rem; font-size: .66rem; letter-spacing: .2em; text-transform: uppercase; color: var(--couleur-primaire); }
    .lignes { margin-top: 1rem; padding-top: .9rem; border-top: 1px dashed color-mix(in srgb, var(--couleur-tertiaire) 60%, transparent); }
    .ligne--valeur { display: flex; align-items: center; justify-content: space-between; gap: .75rem; margin-top: .55rem; }
    .ligne--valeur:first-child { margin-top: 0; }
    .ligne--valeur { padding: .35rem 0; }
    .ligne-texte { display: flex; flex-direction: column; min-width: 0; }
    .ligne-libelle { font-size: .6rem; font-weight: 600; letter-spacing: .22em; text-transform: uppercase; color: var(--encre-douce); }
    /* Numéro toujours sur une seule ligne : la taille suit la largeur de l'écran */
    .ligne-numero {
      font-family: var(--affichage); line-height: 1.3;
      font-size: clamp(1rem, 4.6vw, 1.4rem);
      letter-spacing: .02em; white-space: nowrap;
      font-variant-numeric: lining-nums tabular-nums;
    }
    .ligne-texte { flex: 1; }
    .ligne-titulaire { font-family: var(--affichage); font-style: italic; font-size: .95rem; line-height: 1.3; color: var(--encre-douce); }
    .ligne--note { margin-top: .1rem; font-family: var(--affichage); font-style: italic; font-size: 1.02rem; color: var(--encre-douce); }
    .copier {
      flex: none; display: inline-flex; align-items: center; gap: .35rem;
      min-height: 38px; padding: 0 .95rem; border-radius: 999px; cursor: pointer;
      border: 1px solid color-mix(in srgb, var(--couleur-tertiaire) 80%, transparent); background: #fff;
      font-family: var(--texte); font-size: .62rem; font-weight: 600; letter-spacing: .18em; text-transform: uppercase; color: var(--couleur-texte);
      transition: background 200ms ease, color 200ms ease;
    }
    .copier:hover { background: color-mix(in srgb, var(--couleur-tertiaire) 15%, #fff); }
    .copier svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.7; }
    @media (max-width: 400px) {
      .contribution { padding-left: 1.1rem; padding-right: 1.1rem; }
      .copier { padding: 0 .7rem; letter-spacing: .12em; }
    }

    @media (min-width: 600px) and (max-width: 819px) {
      .souhaits { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    @media (min-width: 820px) {
      .souhaits { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1.25rem; }
      .contributions { max-width: 980px; grid-template-columns: repeat(auto-fit, minmax(320px, 460px)); justify-content: center; }
    }

    /* Feuille */
    .resume { display: flex; align-items: center; gap: .9rem; margin-bottom: 1.1rem; }
    .resume img { width: 72px; height: 72px; border-radius: 12px; object-fit: cover; flex: none; }
    .resume h2 { font-family: var(--affichage); font-weight: 500; font-size: 1.4rem; line-height: 1.2; }
    .resume .surtitre { margin-bottom: .1rem; }
    .resume-prix { font-weight: 600; color: var(--couleur-secondaire); font-size: .9rem; }

    .deux-colonnes { display: grid; grid-template-columns: 1fr 1fr; gap: .6rem; }
    .aide { font-size: .75rem; color: var(--encre-douce); margin-top: .5rem; }
    .actions-feuille { display: grid; gap: .6rem; margin-top: 1.1rem; }

  `]
})
export class PublicWishlistComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private mariagePublicService = inject(MariagePublicService);
  private wishlistPublicService = inject(WishlistPublicService);
  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);

  slug = '';
  readonly devise = DEVISE;
  readonly mariage = signal<MariagePublic | null>(null);
  readonly items = signal<WishlistItem[]>([]);
  readonly chargement = signal(true);
  readonly filtre = signal<Filtre>('tous');

  readonly selection = signal<WishlistItem | null>(null);
  readonly prenom = signal('');
  readonly nom = signal('');
  readonly envoi = signal(false);
  readonly erreur = signal('');
  readonly toast = signal('');
  /** Ligne de coordonnées venant d'être copiée (affiche « Copié ✓ »). */
  readonly copieCle = signal<string | null>(null);

  /** Cadeaux réservés depuis ce téléphone (pour afficher « Votre cadeau »). */
  readonly mesCadeaux = signal<Set<string>>(new Set());

  readonly couleurs = computed(() => couleursMariage(this.mariage()));
  readonly monogramme = computed(() => monogrammeDe(this.mariage()?.nomsCouple));
  /** ① Cadeaux matériels, présentés en premier. */
  readonly materiels = computed(() => this.items().filter(i => !this.estMonetaire(i)));
  /** ② Participations libres (Mobile Money, virement…), présentées ensuite. */
  readonly monetaires = computed(() => this.items().filter(i => this.estMonetaire(i)));
  readonly disponibles = computed(() => this.materiels().filter(i => !this.estComplet(i)).length);
  /** Matériels : disponibles d'abord, puis déjà offerts. */
  readonly materielsAffiches = computed(() => {
    const liste = this.filtre() === 'disponibles' ? this.materiels().filter(i => !this.estComplet(i)) : this.materiels();
    return [...liste].sort((a, b) => Number(this.estComplet(a)) - Number(this.estComplet(b)));
  });

  ngOnInit(): void {
    this.slug = this.route.snapshot.paramMap.get('slug') ?? '';
    if (isPlatformBrowser(this.platformId)) chargerPolicesInvitation(this.document);
    this.mariagePublicService.consulter(this.slug).subscribe({ next: m => this.mariage.set(m), error: () => {} });
    this.restaurerMesCadeaux();
    this.preremplirIdentite();
    this.charger();
  }

  charger(): void {
    this.wishlistPublicService.lister(this.slug).subscribe({
      next: items => { this.items.set(items.map(i => this.decoder(i))); this.chargement.set(false); },
      error: () => this.chargement.set(false),
    });
  }

  // ── Lecture d'un cadeau (compatible avec l'ancien format du backend) ──
  estMonetaire(i: WishlistItem): boolean { return i.type === 'MONETAIRE'; }
  estComplet(i: WishlistItem): boolean { return !this.estMonetaire(i) && (i.complet ?? i.reserve); }
  nb(i: WishlistItem): number { return i.nbReservations ?? (i.reserve ? 1 : 0); }
  quantite(i: WishlistItem): number { return Math.max(1, i.quantite ?? 1); }
  points(i: WishlistItem): boolean[] { return Array.from({ length: this.quantite(i) }, (_, k) => k < this.nb(i)); }
  taux(i: WishlistItem): number { return Math.min(100, (this.nb(i) / this.quantite(i)) * 100); }
  libelleMoyen(m: MoyenPaiement): string { return LIBELLE_MOYEN[m] ?? m; }

  ouvrir(item: WishlistItem): void {
    this.erreur.set('');
    this.selection.set(item);
    this.verrouillerDefilement(true);
  }

  fermer(): void {
    if (this.envoi()) return;
    this.selection.set(null);
    this.verrouillerDefilement(false);
  }

  confirmerReservation(item: WishlistItem): void {
    this.erreur.set('');
    this.envoi.set(true);
    this.wishlistPublicService.reserver(this.slug, item.id, {
      prenom: this.prenom().trim(),
      nom: this.nom().trim(),
      montant: null,
    }).subscribe({
      next: () => {
        this.envoi.set(false);
        this.memoriserIdentite();
        this.ajouterMonCadeau(item.id);
        this.fermer();
        this.afficherToast('Merci ! Le cadeau vous est réservé.');
        this.charger();
      },
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.erreur.set(err?.status === 409
          ? "Ce cadeau vient d'être entièrement réservé. Choisissez-en un autre ?"
          : "L'envoi n'a pas abouti. Vérifiez votre connexion et réessayez.");
        this.charger();
      }
    });
  }

  /** Copie un numéro / RIB ; repli sur une zone de texte si l'API presse-papiers est indisponible. */
  async copier(texte: string, cle: string): Promise<void> {
    let ok = false;
    try {
      await navigator.clipboard.writeText(texte);
      ok = true;
    } catch {
      const zone = this.document.createElement('textarea');
      zone.value = texte;
      zone.setAttribute('readonly', '');
      zone.style.position = 'fixed';
      zone.style.opacity = '0';
      this.document.body.appendChild(zone);
      zone.select();
      try { ok = this.document.execCommand('copy'); } catch { ok = false; }
      zone.remove();
    }
    if (!ok) { this.afficherToast('Copie impossible : recopiez le numéro à la main.'); return; }
    this.copieCle.set(cle);
    this.afficherToast('Copié ! Collez-le dans votre application.');
    setTimeout(() => { if (this.copieCle() === cle) this.copieCle.set(null); }, 2200);
  }

  /**
   * Découpe les coordonnées saisies par les mariés, une ligne par information.
   * Une ligne qui contient un numéro (téléphone, compte, RIB) reçoit un bouton « Copier »
   * qui copie seulement ce numéro ; les autres lignes (nom du titulaire…) sont affichées en note.
   */
  lignes(infos: string | null | undefined): LignePaiement[] {
    const nettoyer = (t: string) => t.replace(/^[\s:–—\-·,]+|[\s:–—\-·,]+$/g, '');
    return (infos ?? '')
      .split(/\r?\n/)
      .map(t => t.trim())
      .filter(Boolean)
      .map(texte => {
        const m = texte.match(/\+?\d[\d\s.\-]{5,}\d/);
        if (!m || m.index === undefined) return { texte, avant: '', numero: '', apres: '', aCopier: null };
        return {
          texte,
          avant: nettoyer(texte.slice(0, m.index)),          // « MTN MoMo »
          numero: m[0].trim(),                                // « 6 77 00 11 22 »
          apres: nettoyer(texte.slice(m.index + m[0].length)), // « Ruth-Mireille N. »
          aCopier: m[0].replace(/[\s.]/g, ''),               // copié sans espaces
        };
      });
  }

  /** Icône choisie d'après le nom du cadeau (mots-clés), sinon un paquet cadeau. */
  iconeDe(i: WishlistItem): string {
    const n = ` ${(i.nom ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')} `;
    return ICONES_PAR_MOT.find(([motif]) => motif.test(n))?.[1] ?? 'cadeau';
  }

  /**
   * Filet de sécurité : d'anciens cadeaux ont été enregistrés « échappés » (« &agrave; »).
   * On les remet en texte normal à l'affichage (la migration V24 les corrige en base).
   */
  private decoder(i: WishlistItem): WishlistItem {
    const d = (t: string | null | undefined) => (t && t.includes('&') ? this.decoderTexte(t) : t);
    return { ...i, nom: d(i.nom) ?? '', description: d(i.description) ?? null, infosPaiement: d(i.infosPaiement) ?? null };
  }

  private decoderTexte(t: string): string {
    if (!isPlatformBrowser(this.platformId)) return t;
    const zone = this.document.createElement('textarea');
    zone.innerHTML = t;                // le navigateur décode les entités, sans rien exécuter
    return zone.value;
  }

  numero(i: number): string {
    return String(i + 1).padStart(2, '0');
  }

  /**
   * Lien du produit, seulement s'il est sûr à ouvrir (http/https).
   * « jumia.cm/... » saisi sans protocole est complété en https://.
   */
  lienSur(lien: string | null | undefined): string | null {
    const brut = (lien ?? '').trim();
    if (!brut) return null;
    try {
      const url = new URL(/^https?:\/\//i.test(brut) ? brut : `https://${brut}`);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch {
      return null;
    }
  }

  /** « https://www.jumia.cm/produit… » → « jumia.cm » */
  domaine(url: string): string {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'le site'; }
  }

  formaterPrix(prix: number | string): string {
    const n = Number(prix);
    return Number.isFinite(n) ? `${new Intl.NumberFormat('fr-FR').format(n)} ${DEVISE}` : String(prix);
  }

  private afficherToast(texte: string): void {
    this.toast.set('');
    setTimeout(() => this.toast.set(texte));
    setTimeout(() => this.toast.set(''), 3300);
  }

  private verrouillerDefilement(actif: boolean): void {
    if (isPlatformBrowser(this.platformId)) this.document.body.style.overflow = actif ? 'hidden' : '';
  }

  // ── Mémoire locale (téléphone de l'invité) ──
  private cle(): string { return `wishlist-mes-cadeaux:${this.slug}`; }

  private ajouterMonCadeau(id: string): void {
    const s = new Set(this.mesCadeaux()).add(id);
    this.mesCadeaux.set(s);
    if (!isPlatformBrowser(this.platformId)) return;
    try { localStorage.setItem(this.cle(), JSON.stringify([...s])); } catch { /* indisponible */ }
  }

  private restaurerMesCadeaux(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const brut = localStorage.getItem(this.cle());
      if (brut) this.mesCadeaux.set(new Set(JSON.parse(brut) as string[]));
    } catch { /* indisponible */ }
  }

  /** Reprend le prénom/nom déjà saisis (ici ou lors de la confirmation de présence). */
  private preremplirIdentite(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const brut = localStorage.getItem(`wishlist-identite:${this.slug}`) ?? localStorage.getItem(`rsvp-billet:${this.slug}`);
      if (!brut) return;
      const { prenom, nom } = JSON.parse(brut) as { prenom?: string; nom?: string };
      if (prenom) this.prenom.set(prenom);
      if (nom) this.nom.set(nom);
    } catch { /* indisponible */ }
  }

  private memoriserIdentite(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(`wishlist-identite:${this.slug}`, JSON.stringify({ prenom: this.prenom().trim(), nom: this.nom().trim() }));
    } catch { /* indisponible */ }
  }
}