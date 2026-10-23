import { Component, DestroyRef, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, debounceTime, distinctUntilChanged, filter, switchMap, catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { InviteRecherche, ScanResultat, ScanService } from '../../core/scan.service';
import { AdminThemeService } from '../../shared/admin/admin-theme.service';

type Onglet = 'scanner' | 'rechercher';
type Verdict = 'ok' | 'epuise' | 'erreur';

interface Affichage {
  verdict: Verdict;
  titre: string;
  invite?: string;
  conjoint?: string | null;
  /** undefined = pas d'info (erreur), null = invité pas encore placé. */
  table?: string | null;
  detail: string;
}

/** Délai d'affichage d'une entrée validée avant de revenir au scan. */
const DUREE_OK_MS = 3500;
/** Un même QR relu dans ce délai est ignoré (le téléphone de l'invité reste devant la caméra). */
const ANTI_DOUBLON_MS = 5000;

/**
 * Accueil des invités le jour J — pensé pour un téléphone tenu à l'entrée.
 *  - Scanner : caméra plein cadre, lecture continue, résultat plein écran (vert / rouge), vibration + bip.
 *  - Rechercher : par nom, si le QR ne passe pas (écran cassé, batterie à plat, billet oublié).
 *
 * Dépendance : npm i qr-scanner@1.4.2
 */
@Component({
  selector: 'app-scan',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="ecran">
      <header class="haut">
        <div class="titres">
          @if (theme.monogramme()) { <p class="mono">{{ theme.monogramme() }}</p> }
          <h1>Accueil des invités</h1>
        </div>
        <p class="compteur" aria-live="polite" title="Entrées validées sur ce téléphone">
          <strong>{{ entreesSession() }}</strong>
          <span>entrée{{ entreesSession() > 1 ? 's' : '' }}</span>
        </p>
      </header>

      <div class="onglets" role="tablist">
        <button type="button" role="tab" [class.actif]="onglet() === 'scanner'" [attr.aria-selected]="onglet() === 'scanner'" (click)="changerOnglet('scanner')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/></svg>
          Scanner
        </button>
        <button type="button" role="tab" [class.actif]="onglet() === 'rechercher'" [attr.aria-selected]="onglet() === 'rechercher'" (click)="changerOnglet('rechercher')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>
          Par nom
        </button>
      </div>

      <!-- ───── Scanner ───── -->
      @if (onglet() === 'scanner') {
        <section class="camera">
          <div class="cadre" [class.cadre--eteint]="!cameraActive()">
            <video #video playsinline muted></video>
            @if (cameraActive()) {
              <div class="fenetre">
                <span class="coin coin--hg"></span><span class="coin coin--hd"></span>
                <span class="coin coin--bg"></span><span class="coin coin--bd"></span>
                <span class="ligne"></span>
              </div>
              <p class="consigne">Placez le QR code dans le cadre</p>
            } @else if (cameraErreur()) {
              @let e = cameraErreur()!;
              <div class="camera-erreur">
                <span class="camera-icone" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.4-2h7.8l1.4 2h2.2A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/><circle cx="12" cy="13" r="3.6"/><path d="M3 3l18 18"/></svg>
                </span>
                <p class="camera-titre">{{ e.titre }}</p>
                <p class="camera-texte">{{ e.texte }}</p>
                <div class="camera-actions">
                  <button type="button" class="btn-plein btn-petit" (click)="demarrerCamera()">Réessayer</button>
                  <button type="button" class="btn-lien" (click)="changerOnglet('rechercher')">Chercher par nom</button>
                </div>
              </div>
            } @else {
              <div class="camera-erreur"><span class="chargement" aria-label="Ouverture de la caméra"></span></div>
            }
          </div>

          <div class="actions-camera">
            @if (flashDispo()) {
              <button type="button" class="btn-outil" [class.actif]="flash()" (click)="basculerFlash()">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L5 13.5h6L10 22l8-11.5h-6z"/></svg>
                {{ flash() ? 'Lampe allumée' : 'Lampe' }}
              </button>
            }
            <button type="button" class="btn-outil" [class.actif]="saisieOuverte()" (click)="saisieOuverte.set(!saisieOuverte())">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7.5 14h9"/></svg>
              Saisir le code
            </button>
          </div>
          @if (saisieOuverte()) {
            <form class="saisie" (ngSubmit)="validerSaisie()">
              <input class="champ champ-code" name="code" [(ngModel)]="codeSaisi" placeholder="K7P-4MX" maxlength="80"
                     autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="go" aria-label="Code du billet" />
              <button type="submit" class="btn-plein" [disabled]="!codeSaisi.trim() || enCours()">Valider</button>
            </form>
          }
        </section>
      }

      <!-- ───── Recherche par nom ───── -->
      @if (onglet() === 'rechercher') {
        <section class="recherche">
          <input class="champ" type="search" [ngModel]="terme()" (ngModelChange)="chercher($event)"
                 placeholder="Nom, prénom ou téléphone" autocomplete="off" autofocus />
          @if (rechercheEnCours()) { <p class="info">Recherche…</p> }
          @else if (terme().trim().length >= 2 && resultats().length === 0) { <p class="info">Aucun invité confirmé ne correspond.</p> }
          <ul class="liste">
            @for (i of resultats(); track i.billetId) {
              @let reste = i.nbPlaces - i.nbEntreesScannees;
              <li>
                <div class="personne">
                  <p class="personne-nom">{{ i.invite }}</p>
                  @if (i.nomConjoint) { <p class="personne-conjoint">+ {{ i.nomConjoint }}</p> }
                  @if (i.telephone) { <p class="personne-tel">{{ i.telephone }}</p> }
                  @if (i.table) { <p class="personne-table">Table {{ i.table }}</p> }
                  <p class="personne-places" [class.complet]="reste <= 0">
                    {{ reste <= 0 ? 'Déjà entré' + (i.nbPlaces > 1 ? 's' : '') : reste + ' place' + (reste > 1 ? 's' : '') + ' restante' + (reste > 1 ? 's' : '') }}
                    · {{ i.nbEntreesScannees }}/{{ i.nbPlaces }}
                  </p>
                </div>
                <button type="button" class="btn-plein btn-entrer" [disabled]="reste <= 0 || enCours()" (click)="entrerParNom(i)">Faire entrer</button>
              </li>
            }
          </ul>
        </section>
      }

      <!-- ───── Résultat plein écran ───── -->
      @if (affichage(); as a) {
        <div class="verdict" [class]="'verdict verdict--' + a.verdict" role="alertdialog" aria-live="assertive" (click)="continuer()">
          <div class="verdict-icone" aria-hidden="true">
            @switch (a.verdict) {
              @case ('ok') { <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg> }
              @case ('epuise') { <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg> }
              @default { <svg viewBox="0 0 24 24"><path d="M12 7v6M12 16.5v.5"/><circle cx="12" cy="12" r="9.5"/></svg> }
            }
          </div>
          <p class="verdict-titre">{{ a.titre }}</p>
          @if (a.invite) { <p class="verdict-nom">{{ a.invite }}</p> }
          @if (a.conjoint) { <p class="verdict-conjoint">+ {{ a.conjoint }}</p> }
          @if ((a.verdict === 'ok' && a.table !== undefined) || (a.verdict === 'epuise' && a.table)) {
            <div class="verdict-table" [class.verdict-table--aucune]="!a.table">
              <span>Table</span>
              <strong>{{ a.table || 'Non attribuée' }}</strong>
            </div>
          }
          <p class="verdict-detail">{{ a.detail }}</p>
          @if (a.verdict === 'ok') {
            <span class="minuterie"><span [style.animation-duration.ms]="dureeOk"></span></span>
            <p class="verdict-aide">Touchez pour continuer</p>
          } @else {
            <button type="button" class="btn-verdict">Continuer</button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block; min-height: 100dvh;
      --c-primaire: var(--couleur-primaire, #5e86ae);
      --c-secondaire: var(--couleur-secondaire, #c65a2a);
      --c-tertiaire: var(--couleur-tertiaire, #d2b48c);
      --c-fond: var(--couleur-fond, #fbf8f1);
      --c-texte: var(--couleur-texte, #22324a);
      --ok: #2f7d4f; --ko: #b3402f; --attention: #b7791f;
      background: var(--c-fond); color: var(--c-texte);
      font-family: Montserrat, system-ui, sans-serif;
    }
    p, h1 { margin: 0; }
    .ecran { max-width: 480px; margin: 0 auto; padding: max(1rem, env(safe-area-inset-top)) 1rem calc(1.5rem + env(safe-area-inset-bottom)); }

    .haut { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1.1rem; }
    .titres { min-width: 0; }
    .mono { font-family: 'Pinyon Script', cursive; font-size: 1.5rem; line-height: 1; color: var(--c-secondaire); margin-bottom: .15rem; }
    h1 { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(1.4rem, 6.4vw, 1.75rem); line-height: 1.05; white-space: nowrap; }
    .compteur {
      flex: none; display: flex; align-items: center; gap: .45rem;
      padding: .3rem .7rem .3rem .3rem; border-radius: 999px;
      background: #fff; border: 1px solid color-mix(in srgb, var(--c-tertiaire) 55%, transparent);
      box-shadow: 0 6px 16px -10px rgba(34,50,74,.35);
    }
    .compteur strong {
      display: grid; place-items: center; min-width: 1.75rem; height: 1.75rem; padding: 0 .35rem; border-radius: 999px;
      background: var(--c-primaire); color: #fff; font-size: .95rem; font-weight: 700;
    }
    .compteur span { font-size: .62rem; line-height: 1.2; letter-spacing: .06em; text-transform: uppercase; color: color-mix(in srgb, var(--c-texte) 65%, transparent); }

    .onglets { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; margin-bottom: 1rem; border-radius: 14px; background: color-mix(in srgb, var(--c-tertiaire) 22%, #fff); }
    .onglets button {
      display: flex; align-items: center; justify-content: center; gap: .45rem;
      min-height: 46px; border: none; border-radius: 11px; background: none; cursor: pointer;
      font: 600 .85rem Montserrat, system-ui, sans-serif; color: color-mix(in srgb, var(--c-texte) 70%, transparent);
    }
    .onglets button.actif { background: #fff; color: var(--c-texte); box-shadow: 0 4px 12px -6px rgba(0,0,0,.25); }
    .onglets svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }

    /* Caméra */
    .cadre {
      position: relative; aspect-ratio: 4 / 5; max-height: 62dvh; width: 100%;
      border-radius: 24px; overflow: hidden; background: #0d1117;
      box-shadow: 0 18px 40px -22px rgba(34,50,74,.6);
    }
    .cadre video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .cadre--eteint {
      background:
        radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--c-primaire) 55%, transparent), transparent 70%),
        linear-gradient(180deg, #2a3d57, var(--c-texte));
    }
    .cadre--eteint video { opacity: 0; }

    /* fenêtre de visée : tout le reste est assombri */
    .fenetre {
      position: absolute; left: 50%; top: 45%; width: 66%; aspect-ratio: 1; transform: translate(-50%, -50%);
      border-radius: 18px; box-shadow: 0 0 0 100vmax rgba(10,14,20,.45);
    }
    .coin { position: absolute; width: 34px; height: 34px; border: 4px solid #fff; }
    .coin--hg { top: -2px; left: -2px; border-right: 0; border-bottom: 0; border-radius: 18px 0 0 0; }
    .coin--hd { top: -2px; right: -2px; border-left: 0; border-bottom: 0; border-radius: 0 18px 0 0; }
    .coin--bg { bottom: -2px; left: -2px; border-right: 0; border-top: 0; border-radius: 0 0 0 18px; }
    .coin--bd { bottom: -2px; right: -2px; border-left: 0; border-top: 0; border-radius: 0 0 18px 0; }
    .ligne {
      position: absolute; left: 8%; right: 8%; height: 2px; top: 6%;
      background: linear-gradient(90deg, transparent, var(--c-tertiaire), transparent);
      box-shadow: 0 0 14px var(--c-tertiaire);
      animation: balayer 2.2s ease-in-out infinite alternate;
    }
    @keyframes balayer { to { top: 94%; } }
    .consigne {
      position: absolute; left: 0; right: 0; bottom: 1.1rem; text-align: center;
      color: #fff; font-size: .82rem; font-weight: 600; letter-spacing: .02em; text-shadow: 0 1px 6px rgba(0,0,0,.5);
    }

    .camera-erreur {
      position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: .55rem; padding: 1.75rem; text-align: center; color: #fff;
    }
    .camera-icone {
      display: grid; place-items: center; width: 64px; height: 64px; margin-bottom: .4rem; border-radius: 50%;
      background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.18);
    }
    .camera-icone svg { width: 28px; height: 28px; fill: none; stroke: var(--c-tertiaire); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
    .camera-titre { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 1.45rem; font-weight: 500; line-height: 1.1; }
    .camera-texte { max-width: 26ch; font-size: .82rem; line-height: 1.5; color: rgba(255,255,255,.75); }
    .camera-actions { display: flex; flex-direction: column; align-items: center; gap: .35rem; margin-top: .9rem; }
    .btn-petit { min-height: 44px; padding: 0 1.6rem; border-radius: 999px; font-size: .85rem; }
    .btn-lien {
      min-height: 40px; padding: 0 .8rem; border: none; background: none; cursor: pointer;
      color: var(--c-tertiaire); font: 600 .8rem Montserrat, system-ui, sans-serif;
      text-decoration: underline; text-underline-offset: 3px;
    }
    .chargement {
      width: 34px; height: 34px; border-radius: 50%;
      border: 3px solid rgba(255,255,255,.2); border-top-color: var(--c-tertiaire);
      animation: tourner .9s linear infinite;
    }
    @keyframes tourner { to { transform: rotate(360deg); } }

    .actions-camera { display: flex; gap: .5rem; justify-content: center; flex-wrap: wrap; margin-top: 1rem; }
    .btn-outil {
      display: inline-flex; align-items: center; gap: .45rem;
      min-height: 44px; padding: 0 1.05rem; border-radius: 999px; cursor: pointer;
      border: 1px solid color-mix(in srgb, var(--c-tertiaire) 70%, transparent); background: #fff;
      color: var(--c-texte); font: 600 .8rem Montserrat, system-ui, sans-serif;
      transition: background .15s, color .15s, border-color .15s;
    }
    .btn-outil svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    .btn-outil.actif { background: var(--c-texte); border-color: var(--c-texte); color: #fff; }
    .saisie {
      display: grid; grid-template-columns: 1fr auto; gap: .5rem; margin-top: .9rem;
      animation: deplier 180ms ease-out both;
    }
    @keyframes deplier { from { opacity: 0; transform: translateY(-4px); } }

    .champ {
      width: 100%; min-height: 54px; padding: 0 1rem; box-sizing: border-box;
      border: 1px solid color-mix(in srgb, var(--c-tertiaire) 70%, transparent); border-radius: 14px;
      background: #fff; color: var(--c-texte); font: 500 1.05rem Montserrat, system-ui, sans-serif;
      outline: none;
    }
    .champ-code { text-transform: uppercase; letter-spacing: .18em; font-weight: 700; }
    .champ-code::placeholder { letter-spacing: .18em; font-weight: 500; opacity: .35; }
    .champ:focus { border-color: var(--c-secondaire); box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-secondaire) 18%, transparent); }
    .btn-plein {
      min-height: 52px; padding: 0 1.2rem; border: none; border-radius: 14px; cursor: pointer;
      background: var(--c-secondaire); color: #fff; font: 600 .95rem Montserrat, system-ui, sans-serif;
    }
    .btn-plein:disabled { opacity: .45; cursor: not-allowed; }
    .btn-clair {
      min-height: 44px; padding: 0 1rem; border-radius: 999px; cursor: pointer;
      border: 1px solid color-mix(in srgb, var(--c-tertiaire) 80%, transparent); background: #fff;
      color: var(--c-texte); font: 600 .8rem Montserrat, system-ui, sans-serif;
    }

    /* Recherche */
    .info { margin: .9rem 0; text-align: center; font-size: .85rem; color: color-mix(in srgb, var(--c-texte) 65%, transparent); }
    .liste { list-style: none; margin: .9rem 0 0; padding: 0; display: grid; gap: .6rem; }
    .liste li {
      display: flex; align-items: center; gap: .8rem; padding: .85rem .9rem;
      background: #fff; border: 1px solid color-mix(in srgb, var(--c-tertiaire) 45%, transparent); border-radius: 16px;
    }
    .personne { flex: 1; min-width: 0; }
    .personne-nom { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 600; font-size: 1.25rem; line-height: 1.15; }
    .personne-conjoint { font-size: .8rem; color: color-mix(in srgb, var(--c-texte) 70%, transparent); }
    .personne-places { margin-top: .25rem; font-size: .72rem; font-weight: 600; color: var(--ok); }
    .personne-places.complet { color: var(--ko); }
    .btn-entrer { flex: none; min-height: 46px; font-size: .82rem; }

    /* Verdict plein écran */
    .verdict {
      position: fixed; inset: 0; z-index: 100;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .4rem;
      padding: 2rem 1.5rem calc(2rem + env(safe-area-inset-bottom));
      text-align: center; color: #fff; cursor: pointer;
      animation: entrer 220ms cubic-bezier(.2,.8,.2,1) both;
    }
    @keyframes entrer { from { opacity: 0; transform: scale(1.04); } to { opacity: 1; transform: none; } }
    .verdict--ok { background: radial-gradient(circle at 50% 30%, #3f9a64, var(--ok) 70%); }
    .verdict--epuise { background: radial-gradient(circle at 50% 30%, #cc5442, var(--ko) 70%); }
    .verdict--erreur { background: radial-gradient(circle at 50% 30%, #d1912f, var(--attention) 70%); }
    .verdict-icone { width: 108px; height: 108px; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.18); margin-bottom: 1rem; }
    .verdict-icone svg { width: 58px; height: 58px; fill: none; stroke: #fff; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
    .verdict-titre { font-size: .8rem; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; opacity: .9; }
    .verdict-nom { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 600; font-size: 2.6rem; line-height: 1.05; margin-top: .3rem; }
    .verdict-conjoint { margin-top: .35rem; font-size: 1.15rem; opacity: .92; }
    .verdict-table {
      display: flex; flex-direction: column; align-items: center; gap: .1rem;
      margin-top: 1.4rem; padding: .85rem 2.2rem 1rem; border-radius: 18px;
      background: #fff; color: color-mix(in srgb, var(--c-texte) 60%, transparent); box-shadow: 0 14px 30px -14px rgba(0,0,0,.45);
      animation: entrer 260ms 120ms cubic-bezier(.2,.8,.2,1) both;
    }
    .verdict-table span { font-size: .7rem; font-weight: 700; letter-spacing: .25em; text-transform: uppercase; opacity: .75; }
    .verdict-table strong { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 2.6rem; font-weight: 600; line-height: 1; color: var(--c-texte); }
    .verdict-table--aucune { background: rgba(255,255,255,.16); color: #fff; box-shadow: none; }
    .verdict-table--aucune strong { font-size: 1.3rem; color: #fff; font-family: Montserrat, system-ui, sans-serif; }
    .personne-tel { font-size: .74rem; color: color-mix(in srgb, var(--c-texte) 60%, transparent); font-variant-numeric: tabular-nums; }
    .personne-table {
      display: inline-block; margin-top: .3rem; padding: .1rem .5rem; border-radius: 6px;
      background: color-mix(in srgb, var(--c-primaire) 14%, #fff); color: var(--c-primaire);
      font-size: .72rem; font-weight: 700;
    }
    .verdict-detail { margin-top: 1rem; padding: .55rem 1.1rem; border-radius: 999px; background: rgba(255,255,255,.18); font-size: 1rem; font-weight: 600; }
    .minuterie { width: 160px; height: 4px; margin-top: 2rem; border-radius: 4px; background: rgba(255,255,255,.25); overflow: hidden; }
    .minuterie span { display: block; height: 100%; background: #fff; transform-origin: left; animation: decompte linear forwards; }
    @keyframes decompte { from { transform: scaleX(1); } to { transform: scaleX(0); } }
    .verdict-aide { margin-top: .6rem; font-size: .75rem; opacity: .75; }
    .btn-verdict { margin-top: 2rem; min-height: 56px; min-width: 220px; border: 2px solid #fff; border-radius: 999px; background: transparent; color: #fff; font: 700 1rem Montserrat, system-ui, sans-serif; cursor: pointer; }
  `],
})
export class ScanComponent implements OnInit {
  private scanService = inject(ScanService);
  private destroyRef = inject(DestroyRef);
  readonly theme = inject(AdminThemeService);

  @ViewChild('video') set videoRef(ref: ElementRef<HTMLVideoElement> | undefined) {
    const nouvelle = ref?.nativeElement;
    // En revenant sur l'onglet « Scanner », Angular recrée l'élément <video> :
    // l'ancien lecteur filmerait dans une vidéo invisible (écran noir alors que le scan marche).
    if (nouvelle !== this.video && this.lecteur) {
      this.lecteur.destroy();
      this.lecteur = null;
    }
    this.video = nouvelle;
    if (this.video && this.onglet() === 'scanner') this.demarrerCamera();
  }
  private video?: HTMLVideoElement;
  private lecteur: import('qr-scanner').default | null = null;

  readonly onglet = signal<Onglet>('scanner');
  readonly enCours = signal(false);
  readonly affichage = signal<Affichage | null>(null);
  readonly entreesSession = signal(0);
  readonly dureeOk = DUREE_OK_MS;

  readonly cameraActive = signal(false);
  readonly cameraErreur = signal<{ titre: string; texte: string } | null>(null);
  readonly flashDispo = signal(false);
  readonly flash = signal(false);
  readonly saisieOuverte = signal(false);
  codeSaisi = '';

  readonly terme = signal('');
  readonly resultats = signal<InviteRecherche[]>([]);
  readonly rechercheEnCours = signal(false);
  private recherche$ = new Subject<string>();

  private dernierCode = '';
  private dernierInstant = 0;
  private minuteur?: ReturnType<typeof setTimeout>;
  private audio?: AudioContext;

  ngOnInit(): void {
    this.theme.chargerMariageCourant?.().catch(() => {});

    this.recherche$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      filter(t => {
        if (t.trim().length < 2) { this.resultats.set([]); return false; }
        return true;
      }),
      switchMap(t => {
        this.rechercheEnCours.set(true);
        return this.scanService.rechercher(t.trim()).pipe(catchError(() => of([] as InviteRecherche[])));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(r => { this.resultats.set(r); this.rechercheEnCours.set(false); });

    this.destroyRef.onDestroy(() => {
      this.lecteur?.destroy();
      clearTimeout(this.minuteur);
      this.audio?.close().catch(() => {});
    });
  }

  // ═══════════════ Caméra ═══════════════

  async demarrerCamera(): Promise<void> {
    if (!this.video) return;
    this.cameraErreur.set(null);
    try {
      if (!this.lecteur) {
        const QrScanner = (await import('qr-scanner')).default;
        const video = this.video;
        // Indispensable sur iPhone / certains Android pour afficher l'image dans la page
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('autoplay', '');
        // La vidéo affiche des images : la caméra est bien active, quoi que dise start()
        video.addEventListener('playing', () => { this.cameraActive.set(true); this.cameraErreur.set(null); });
        this.lecteur = new QrScanner(video, r => this.surLecture(r.data), {
          preferredCamera: 'environment',
          maxScansPerSecond: 8,
          returnDetailedScanResult: true,
        });
      }
      await this.lecteur.start();
      this.cameraActive.set(true);
      this.flashDispo.set(await this.lecteur.hasFlash().catch(() => false));
    } catch (e) {
      const filme = !!this.video && !this.video.paused && this.video.readyState >= 2;
      if (filme) return;                     // erreur secondaire alors que l'image s'affiche : on l'ignore
      this.cameraActive.set(false);
      this.cameraErreur.set(this.expliquerErreurCamera(e));
    }
  }

  private expliquerErreurCamera(e: unknown): { titre: string; texte: string } {
    if (!window.isSecureContext) {
      return { titre: 'Connexion non sécurisée', texte: "Le navigateur n'ouvre la caméra qu'en HTTPS. Ouvrez cette page avec une adresse https://." };
    }
    const nom = (e as { name?: string })?.name;
    if (nom === 'NotAllowedError' || nom === 'SecurityError') {
      return { titre: 'Accès à la caméra refusé', texte: "Autorisez la caméra dans les réglages du navigateur (icône à gauche de l'adresse), puis réessayez." };
    }
    if (nom === 'NotReadableError') {
      return { titre: 'Caméra occupée', texte: 'Une autre application utilise la caméra. Fermez-la, puis réessayez.' };
    }
    return { titre: 'Aucune caméra détectée', texte: 'Utilisez un téléphone, ou faites entrer les invités par leur nom.' };
  }

  async basculerFlash(): Promise<void> {
    await this.lecteur?.toggleFlash().catch(() => {});
    this.flash.set(!!this.lecteur?.isFlashOn());
  }

  changerOnglet(o: Onglet): void {
    this.onglet.set(o);
    if (o !== 'scanner') {
      this.lecteur?.stop();
      this.cameraActive.set(false);
    }
    // en revenant sur « Scanner », le @ViewChild relance la caméra
  }

  private surLecture(code: string): void {
    if (this.affichage() || this.enCours()) return;
    const maintenant = Date.now();
    if (code === this.dernierCode && maintenant - this.dernierInstant < ANTI_DOUBLON_MS) return;
    this.dernierCode = code;
    this.dernierInstant = maintenant;
    this.envoyer(this.scanService.scanner(code));
  }

  validerSaisie(): void {
    const code = this.codeSaisi.trim();
    if (!code) return;
    this.envoyer(this.scanService.scanner(code));
    this.codeSaisi = '';
  }

  // ═══════════════ Recherche par nom ═══════════════

  chercher(t: string): void {
    this.terme.set(t);
    this.recherche$.next(t);
  }

  entrerParNom(i: InviteRecherche): void {
    this.envoyer(this.scanService.entrerParNom(i.billetId), r =>
      this.resultats.update(liste => liste.map(x => x.billetId === i.billetId ? { ...x, nbEntreesScannees: r.nbEntreesScannees } : x)));
  }

  // ═══════════════ Résultat ═══════════════

  private envoyer(appel: Observable<ScanResultat>, apres?: (r: ScanResultat) => void): void {
    this.enCours.set(true);
    this.lecteur?.pause().catch(() => {});
    appel.subscribe({
      next: r => {
        this.enCours.set(false);
        if (r.epuise) {
          this.montrer({
            verdict: 'epuise', titre: 'Billet déjà utilisé', invite: r.invite, conjoint: r.nomConjoint, table: r.table ?? null,
            detail: `${r.nbEntreesScannees} entrée${r.nbEntreesScannees > 1 ? 's' : ''} sur ${r.nbPlaces} déjà enregistrée${r.nbPlaces > 1 ? 's' : ''}`,
          });
        } else {
          const reste = r.nbPlaces - r.nbEntreesScannees;
          this.entreesSession.update(n => n + 1);
          this.montrer({
            verdict: 'ok', titre: 'Bienvenue', invite: r.invite, conjoint: r.nomConjoint, table: r.table ?? null,
            detail: reste > 0
              ? `Entrée ${r.nbEntreesScannees} sur ${r.nbPlaces} · ${reste} place${reste > 1 ? 's' : ''} restante${reste > 1 ? 's' : ''}`
              : r.nbPlaces > 1 ? `Toutes les places utilisées (${r.nbPlaces}/${r.nbPlaces})` : 'Entrée enregistrée',
          });
        }
        apres?.(r);
      },
      error: (e: HttpErrorResponse) => {
        this.enCours.set(false);
        const message = e?.error?.message
          ?? (e?.status === 0 ? 'Pas de connexion internet.' : 'Ce QR code ne correspond à aucun billet.');
        this.montrer({ verdict: 'erreur', titre: 'Billet non reconnu', detail: message });
      },
    });
  }

  private montrer(a: Affichage): void {
    this.affichage.set(a);
    this.signaler(a.verdict);
    clearTimeout(this.minuteur);
    if (a.verdict === 'ok') this.minuteur = setTimeout(() => this.continuer(), DUREE_OK_MS);
  }

  continuer(): void {
    clearTimeout(this.minuteur);
    this.affichage.set(null);
    if (this.onglet() === 'scanner') this.lecteur?.start().catch(() => {});
  }

  /** Vibration + bip : l'hôtesse sait sans regarder l'écran. */
  private signaler(v: Verdict): void {
    navigator.vibrate?.(v === 'ok' ? 120 : [90, 70, 90, 70, 240]);
    try {
      this.audio ??= new AudioContext();
      const notes = v === 'ok' ? [880, 1320] : [330, 260];
      notes.forEach((f, i) => {
        const osc = this.audio!.createOscillator();
        const gain = this.audio!.createGain();
        osc.frequency.value = f;
        osc.type = v === 'ok' ? 'sine' : 'square';
        const t0 = this.audio!.currentTime + i * 0.13;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
        osc.connect(gain).connect(this.audio!.destination);
        osc.start(t0);
        osc.stop(t0 + 0.13);
      });
    } catch { /* pas de son : la vibration et l'écran suffisent */ }
  }
}