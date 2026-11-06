import { Component, DestroyRef, PLATFORM_ID, ViewEncapsulation, computed, effect, inject, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { MariagePublic, MariagePublicService } from '../core/mariage-public.service';
import { couleursMariage } from './invitation-theme';

type Page = 'rsvp' | 'wishlist' | 'photos' | 'livre-or';
const PAGES: Page[] = ['rsvp', 'wishlist', 'photos', 'livre-or'];

/**
 * Menu flottant des pages invités (liste de cadeaux, partage photo, livre d'or…).
 * Posé une seule fois dans le composant racine, à côté de <app-bouton-musique /> :
 *   - visible sur /m/:slug/wishlist, /photos, /livre-or et /rsvp ;
 *   - masqué sur l'invitation elle-même (/m/:slug), qui a déjà sa propre barre ;
 *   - le lien de la page ouverte n'apparaît pas.
 */
@Component({
  selector: 'app-barre-invites',
  standalone: true,
  imports: [RouterLink],
  encapsulation: ViewEncapsulation.None,
  template: `
    @if (contexte(); as c) {
      <nav class="barre-invites" aria-label="Menu des invités"
           [style.--bi-primaire]="couleurs().primaire"
           [style.--bi-secondaire]="couleurs().secondaire"
           [style.--bi-fond]="couleurs().fond"
           [style.--bi-texte]="couleurs().texte"
           [style.--bi-tertiaire]="couleurs().tertiaire">
        <span class="bi-liens">
          <a class="bi-lien" [routerLink]="['/m', c.slug]" [queryParams]="{ vers: 'rsvp' }" aria-label="Retour à l'invitation">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7l9 6 9-6"/><rect x="3" y="5" width="18" height="14" rx="2"/></svg>
            <span>Invitation</span>
          </a>
          @if (c.page !== 'wishlist' && c.mariage?.wishlistActive !== false) {
            <a class="bi-lien" [routerLink]="['/m', c.slug, 'wishlist']" aria-label="Liste de cadeaux">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12v9H4v-9M2.5 7h19v5h-19zM12 21V7M12 7C10 3 6 3 6 5.5S9 7 12 7zM12 7c2-4 6-4 6-1.5S15 7 12 7z"/></svg>
              <span>Cadeaux</span>
            </a>
          }
          @if (c.page !== 'photos' && c.mariage?.galeriePhotoActive !== false) {
            <a class="bi-lien" [routerLink]="['/m', c.slug, 'photos']" aria-label="Partage photo">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.6-2.4A1.5 1.5 0 0 1 9.8 5h4.4a1.5 1.5 0 0 1 1.2.6L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>
              <span>Photos</span>
            </a>
          }
          @if (c.page !== 'livre-or') {
            <a class="bi-lien" [routerLink]="['/m', c.slug, 'livre-or']" aria-label="Livre d'or">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/></svg>
              <span>Livre d'or</span>
            </a>
          }
        </span>
        @if (c.page !== 'rsvp') {
          <a class="bi-confirmer" [routerLink]="['/m', c.slug, 'rsvp']">Je confirme</a>
        }
      </nav>
    }
  `,
  styles: [`
    .barre-invites {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 30;   /* sous les feuilles (40+) et la visionneuse */
      display: flex; align-items: center; justify-content: space-between; gap: .75rem;
      padding: .55rem 16px calc(.55rem + env(safe-area-inset-bottom));
      background: color-mix(in srgb, var(--bi-fond) 90%, transparent);
      -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
      border-top: 1px solid color-mix(in srgb, var(--bi-primaire) 22%, transparent);
      font-family: 'Montserrat', system-ui, sans-serif;
      animation: bi-entree 350ms cubic-bezier(.2,.7,.2,1) both;
    }
    @keyframes bi-entree { from { transform: translateY(110%); } to { transform: none; } }
    .bi-liens { display: flex; align-items: center; gap: .1rem; min-width: 0; }
    .bi-lien {
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .15rem;
      min-width: 54px; min-height: 46px; padding: 0 .3rem; border-radius: 12px;
      color: var(--bi-primaire); text-decoration: none;
      font-size: .58rem; font-weight: 600; letter-spacing: .05em; white-space: nowrap;
      transition: background 200ms ease;
    }
    .bi-lien svg { width: 21px; height: 21px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
    .bi-lien:active, .bi-lien:focus-visible { background: color-mix(in srgb, var(--bi-primaire) 10%, transparent); }
    .bi-confirmer {
      flex: none; display: inline-flex; align-items: center; min-height: 44px; padding: 0 1.1rem;
      border-radius: 999px; background: var(--bi-secondaire); color: #fff; text-decoration: none;
      font-size: .66rem; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; white-space: nowrap;
      box-shadow: 0 8px 20px -10px color-mix(in srgb, var(--bi-secondaire) 80%, transparent);
    }

    /* Le contenu des pages ne passe pas sous la barre ; les messages éphémères remontent au-dessus */
    body.avec-barre-invites { padding-bottom: calc(76px + env(safe-area-inset-bottom)); }
    body.avec-barre-invites .toast { bottom: calc(84px + env(safe-area-inset-bottom)); }

    @media (max-width: 360px) {
      .bi-lien { min-width: 44px; padding: 0 .1rem; }
      .bi-lien span { font-size: .52rem; letter-spacing: .02em; }
      .bi-confirmer { padding: 0 .8rem; letter-spacing: .1em; }
    }
    @media (min-width: 768px) {
      .barre-invites {
        left: auto; right: 1.5rem; bottom: 1.5rem;
        padding: .4rem .4rem .4rem .9rem;
        border: 1px solid color-mix(in srgb, var(--bi-primaire) 22%, transparent); border-radius: 999px;
        box-shadow: 0 12px 30px -10px color-mix(in srgb, var(--bi-texte) 30%, transparent);
      }
      body.avec-barre-invites { padding-bottom: 0; }
      body.avec-barre-invites .toast { bottom: calc(1.25rem + 84px); }
      .bi-lien:hover { background: color-mix(in srgb, var(--bi-primaire) 10%, transparent); }
    }
    @media (prefers-reduced-motion: reduce) { .barre-invites { animation: none; } }
  `],
})
export class BarreInvitesComponent {
  private router = inject(Router);
  private mariages = inject(MariagePublicService);
  private document = inject(DOCUMENT);
  private navigateur = isPlatformBrowser(inject(PLATFORM_ID));

  private url = signal(this.router.url);
  private mariage = signal<MariagePublic | null>(null);
  private slugCharge = '';

  /** null → barre masquée. */
  readonly contexte = computed(() => {
    const chemin = this.url().split(/[?#]/)[0];
    const m = chemin.match(/^\/m\/([^/]+)\/([^/]+)\/?$/);
    if (!m || !PAGES.includes(m[2] as Page)) return null;
    return { slug: decodeURIComponent(m[1]), page: m[2] as Page, mariage: this.mariage() };
  });

  readonly couleurs = computed(() => couleursMariage(this.mariage()));

  constructor() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.url.set(this.router.url));

    effect(() => {
      const c = this.contexte();
      if (this.navigateur) this.document.body.classList.toggle('avec-barre-invites', !!c);
      if (c && c.slug !== this.slugCharge) {
        this.slugCharge = c.slug;
        // Requête mise en cache par le service : pas d'appel en plus si la page l'a déjà fait.
        this.mariages.consulter(c.slug).subscribe({ next: m => this.mariage.set(m), error: () => {} });
      }
    });

    inject(DestroyRef).onDestroy(() => this.document.body.classList.remove('avec-barre-invites'));
  }
}
