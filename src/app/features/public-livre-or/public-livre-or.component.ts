import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MariagePublic, MariagePublicService } from '../../core/mariage-public.service';
import { LivreOrPublicService } from '../../core/livre-or-public.service';
import { MessageLivreOr } from '../../core/models/admin.models';
import { chargerPolicesInvitation, couleursMariage, monogrammeDe } from '../../shared/invitation-theme';

/** Option choisie par les mariés : afficher (ou non) les messages approuvés aux autres invités. */
type MariageAvecOptions = MariagePublic & { livreOrPublic?: boolean | null };

const LONGUEUR_MAX = 2000;
const LONGUEUR_APERCU = 280;
const INCLINAISONS = [-1.4, .9, -.6, 1.3, -1, .5];

@Component({
  selector: 'app-public-livre-or',
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
        <p class="surtitre">Un mot pour les mariés</p>
        <h1>Livre d'or</h1>
        <p class="intro">
          Un souvenir, un vœu, un conseil… Laissez quelques mots à {{ mariage()?.nomsCouple || 'les mariés' }}.
        </p>
      </section>

      <!-- ───── Écrire un mot ───── -->
      <section class="papier" [class.papier--envoye]="etat() === 'envoye'">
        @if (etat() !== 'envoye') {
          <form (ngSubmit)="deposer()">
            <label for="lo-message">Votre message</label>
            <textarea id="lo-message" class="champ ligne" name="message" [(ngModel)]="message"
                      required [attr.maxlength]="longueurMax" rows="6"
                      placeholder="Chers mariés…"></textarea>
            <p class="compteur" [class.compteur--limite]="message().length > longueurMax - 100">
              {{ message().length }} / {{ longueurMax }}
            </p>

            <label for="lo-auteur">Signé</label>
            <input id="lo-auteur" class="champ" name="auteur" [(ngModel)]="auteur"
                   required maxlength="150" autocomplete="name" autocapitalize="words" placeholder="Votre nom" />

            @if (erreur()) { <p class="erreur" role="alert">{{ erreur() }}</p> }

            <button type="submit" class="bouton envoyer" [disabled]="etat() === 'envoi' || !auteur().trim() || !message().trim()">
              @if (etat() === 'envoi') {
                <span class="spinner" aria-hidden="true"></span> Envoi…
              } @else {
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l18-8-8 18-2-8-8-2z"/></svg>
                Envoyer mon mot
              }
            </button>
            <p class="aide">
              {{ messagesPublics()
                  ? 'Votre mot sera visible ici après validation par les mariés.'
                  : 'Votre mot sera transmis uniquement aux mariés.' }}
            </p>
          </form>
        } @else {
          <div class="confirmation" role="status">
            <div class="enveloppe-volante" aria-hidden="true">
              <svg viewBox="0 0 64 44"><rect x="2" y="2" width="60" height="40" rx="3"/><path d="M2 4l30 22L62 4"/></svg>
              <span class="coeur">♥</span>
            </div>
            <h2>Merci {{ dernierAuteur() }} !</h2>
            <p>
              Votre mot s'envole vers les mariés.
              @if (messagesPublics()) { Il apparaîtra ici dès qu'ils l'auront validé. }
            </p>
            <button type="button" class="bouton bouton-discret" (click)="ecrireAutre()">Écrire un autre mot</button>
          </div>
        }
      </section>

      <!-- ───── Messages approuvés (si les mariés l'ont permis) ───── -->
      @if (messagesPublics()) {
        <div class="separateur" aria-hidden="true"><span class="losange"></span></div>

        @if (chargement()) {
          <div class="mur">
            @for (h of [140, 190, 120]; track $index) { <div class="squelette" [style.height.px]="h"></div> }
          </div>
        } @else if (messages().length === 0) {
          <div class="vide">
            <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 6h22l8 8v28H10z"/><path d="M32 6v8h8M16 22h16M16 28h16M16 34h10"/></svg>
            <p>Soyez le premier à laisser un mot !</p>
          </div>
        } @else {
          <p class="compteur-messages">{{ messages().length }} mot{{ messages().length > 1 ? 's' : '' }} doux</p>
          <div class="mur">
            @for (m of messages(); track m.id; let i = $index) {
              <article class="mot apparition" [style.--i]="i % 8" [style.--incl.deg]="inclinaison(i)" [class]="'mot apparition mot--' + (i % 3)">
                <span class="guillemet" aria-hidden="true">“</span>
                <p class="mot-texte">{{ estOuvert(m.id) || m.message.length <= longueurApercu ? m.message : apercu(m.message) }}</p>
                @if (m.message.length > longueurApercu) {
                  <button type="button" class="lire-suite" (click)="basculer(m.id)">
                    {{ estOuvert(m.id) ? 'Réduire' : 'Lire la suite' }}
                  </button>
                }
                <p class="mot-auteur">{{ m.auteur }}</p>
              </article>
            }
          </div>
        }
      } @else {
        <p class="note-privee">Les mots du livre d'or sont réservés aux mariés.</p>
      }
    </div>
  `,
  styles: [`
    /* Papier à lettres */
    .papier {
      position: relative;
      max-width: 560px; margin: 0 auto;
      padding: 1.4rem 1.15rem 1.25rem;
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--couleur-tertiaire) 12%, #fff), #fff 40%);
      border: 1px solid color-mix(in srgb, var(--couleur-tertiaire) 50%, transparent);
      border-radius: 18px;
      box-shadow: 0 18px 44px -26px color-mix(in srgb, var(--couleur-texte) 45%, transparent);
      animation: monter 600ms 120ms cubic-bezier(.2,.7,.2,1) both;
    }
    .papier::before {
      content: ''; position: absolute; inset: 6px;
      border: 1px solid color-mix(in srgb, var(--couleur-tertiaire) 30%, transparent);
      border-radius: 13px; pointer-events: none;
    }
    .papier label { margin-top: .25rem; }
    .papier .champ + label, .compteur + label { margin-top: .9rem; }

    /* Zone de texte façon papier ligné */
    .champ.ligne {
      font-family: var(--affichage);
      font-size: 1.15rem;
      line-height: 2rem;
      padding-top: .35rem;
      background:
        repeating-linear-gradient(180deg, transparent 0, transparent calc(2rem - 1px), color-mix(in srgb, var(--couleur-primaire) 18%, transparent) calc(2rem - 1px), color-mix(in srgb, var(--couleur-primaire) 18%, transparent) 2rem) 0 .35rem / 100% 2rem local,
        #fffefb;
    }
    .compteur { text-align: right; font-size: .7rem; color: var(--encre-douce); margin-top: .25rem; }
    .compteur--limite { color: var(--couleur-secondaire); font-weight: 600; }
    .envoyer { margin-top: 1.25rem; }
    .aide { font-size: .75rem; color: var(--encre-douce); text-align: center; margin-top: .7rem; }

    /* Confirmation */
    .confirmation { text-align: center; padding: .5rem 0; animation: monter 500ms ease both; }
    .confirmation h2 { font-family: var(--police-script); font-weight: 400; font-size: 2.4rem; line-height: 1.3; color: var(--couleur-primaire); margin-top: .5rem; }
    .confirmation p { color: var(--encre-douce); font-size: .92rem; margin: .25rem 0 1.25rem; }
    .enveloppe-volante { position: relative; width: 84px; height: 64px; margin: .5rem auto 0; animation: envol 1.6s cubic-bezier(.3,.6,.3,1) both; }
    .enveloppe-volante svg { width: 84px; height: 58px; fill: #fff; stroke: var(--couleur-secondaire); stroke-width: 1.6; stroke-linejoin: round; }
    .enveloppe-volante .coeur { position: absolute; left: 50%; top: 18px; translate: -50% 0; color: var(--couleur-secondaire); font-size: 1rem; }
    @keyframes envol {
      0% { transform: translate(0, 30px) scale(.6) rotate(-8deg); opacity: 0; }
      35% { transform: translate(0, 0) scale(1) rotate(0); opacity: 1; }
      55% { transform: translate(6px, -6px) rotate(4deg); }
      75% { transform: translate(-4px, -2px) rotate(-3deg); }
      100% { transform: none; }
    }

    /* Mur de mots */
    .compteur-messages { text-align: center; font-size: .66rem; letter-spacing: .25em; text-transform: uppercase; color: var(--encre-douce); margin-bottom: 1rem; }
    .mur { columns: 1; column-gap: 1rem; max-width: 900px; margin: 0 auto; }
    .mur > * { break-inside: avoid; margin-bottom: 1rem; }
    .mot {
      position: relative;
      padding: 1.4rem 1.2rem 1.1rem;
      border-radius: 4px 14px 4px 14px;
      box-shadow: 0 10px 24px -16px color-mix(in srgb, var(--couleur-texte) 45%, transparent);
      rotate: var(--incl); /* propriété séparée : n'entre pas en conflit avec l'animation d'apparition */
    }
    .mot--0 { background: color-mix(in srgb, var(--couleur-tertiaire) 16%, #fff); }
    .mot--1 { background: color-mix(in srgb, var(--couleur-primaire) 10%, #fff); }
    .mot--2 { background: color-mix(in srgb, var(--couleur-secondaire) 8%, #fff); }
    .guillemet { position: absolute; top: -.35rem; left: .8rem; font-family: var(--affichage); font-size: 3.6rem; line-height: 1; color: color-mix(in srgb, var(--couleur-secondaire) 55%, transparent); }
    .mot-texte { font-family: var(--affichage); font-size: 1.12rem; line-height: 1.55; white-space: pre-line; word-break: break-word; }
    .lire-suite { min-height: 40px; padding: 0; margin-top: .2rem; border: none; background: none; font-family: var(--texte); font-size: .75rem; font-weight: 600; color: var(--couleur-primaire); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
    .mot-auteur { margin-top: .6rem; text-align: right; font-family: var(--police-script); font-size: 1.6rem; line-height: 1.2; color: var(--couleur-primaire); }
    .mot-auteur::before { content: '— '; font-family: var(--affichage); font-size: 1rem; }

    .note-privee { max-width: 420px; margin: 2rem auto 0; text-align: center; font-family: var(--affichage); font-style: italic; color: var(--encre-douce); }

    @media (min-width: 720px) {
      .mur { columns: 2; }
      .papier { padding: 2rem 2rem 1.5rem; }
    }
    @media (min-width: 1100px) { .mur { columns: 3; } }
  `]
})
export class PublicLivreOrComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private mariagePublicService = inject(MariagePublicService);
  private livreOrPublicService = inject(LivreOrPublicService);
  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);

  slug = '';
  readonly longueurMax = LONGUEUR_MAX;
  readonly longueurApercu = LONGUEUR_APERCU;

  readonly mariage = signal<MariageAvecOptions | null>(null);
  readonly messages = signal<MessageLivreOr[]>([]);
  readonly chargement = signal(true);

  readonly auteur = signal('');
  readonly message = signal('');
  readonly etat = signal<'saisie' | 'envoi' | 'envoye'>('saisie');
  readonly erreur = signal('');
  readonly dernierAuteur = signal('');
  private readonly ouverts = signal<Set<unknown>>(new Set());

  readonly couleurs = computed(() => couleursMariage(this.mariage()));
  readonly monogramme = computed(() => monogrammeDe(this.mariage()?.nomsCouple));
  /** Affiché par défaut ; masqué seulement si les mariés ont explicitement désactivé l'option. */
  readonly messagesPublics = computed(() => this.mariage()?.livreOrPublic !== false);

  ngOnInit(): void {
    this.slug = this.route.snapshot.paramMap.get('slug') ?? '';
    if (isPlatformBrowser(this.platformId)) chargerPolicesInvitation(this.document);
    this.mariagePublicService.consulter(this.slug).subscribe({ next: m => this.mariage.set(m), error: () => {} });
    this.charger();
  }

  charger(): void {
    this.livreOrPublicService.lister(this.slug).subscribe({
      next: m => { this.messages.set(m); this.chargement.set(false); },
      error: () => this.chargement.set(false),
    });
  }

  deposer(): void {
    const auteur = this.auteur().trim();
    const message = this.message().trim();
    if (!auteur || !message) return;
    this.erreur.set('');
    this.etat.set('envoi');
    this.livreOrPublicService.deposer(this.slug, auteur, message).subscribe({
      next: () => {
        this.dernierAuteur.set(auteur.split(/\s+/)[0]);
        this.message.set('');
        this.etat.set('envoye');
      },
      error: () => {
        this.etat.set('saisie');
        this.erreur.set("Votre message n'a pas pu être envoyé. Vérifiez votre connexion et réessayez.");
      }
    });
  }

  ecrireAutre(): void {
    this.etat.set('saisie');
  }

  inclinaison(i: number): number {
    return INCLINAISONS[i % INCLINAISONS.length];
  }

  apercu(texte: string): string {
    const coupe = texte.slice(0, LONGUEUR_APERCU);
    return coupe.slice(0, Math.max(coupe.lastIndexOf(' '), LONGUEUR_APERCU - 40)).trimEnd() + '…';
  }

  estOuvert(id: unknown): boolean {
    return this.ouverts().has(id);
  }

  basculer(id: unknown): void {
    const s = new Set(this.ouverts());
    if (s.has(id)) s.delete(id); else s.add(id);
    this.ouverts.set(s);
  }
}
