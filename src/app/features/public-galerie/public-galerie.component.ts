import { Component, DestroyRef, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpEventType } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MariagePublic, MariagePublicService } from '../../core/mariage-public.service';
import { PhotosPublicService } from '../../core/photos-public.service';
import { PhotosEnvoiService } from '../../core/photos-envoi.service';
import { DUREE_MAX_VIDEO_S, VideoRefusee, preparerVideo } from '../../core/video-preparation';
import { PhotoItem } from '../../core/models/admin.models';
import { chargerPolicesInvitation, couleursMariage, monogrammeDe } from '../../shared/invitation-theme';

type StatutEnvoi = 'attente' | 'compression' | 'envoi' | 'ok' | 'erreur';

interface Envoi {
  id: number;
  fichier: File;
  apercu: string;
  progression: number;
  statut: StatutEnvoi;
  video: boolean;
  /** Raison d'un refus (vidéo trop longue…) : pas de bouton « Réessayer » dans ce cas. */
  message?: string;
}

/**
 * Réduction légère avant l'envoi : 3000 px / JPEG 0,9 → aucune perte visible
 * (tirage 25 × 20 cm), mais 1 à 2 Mo au lieu de 4 à 8 Mo : l'envoi passe en 4G.
 * Le ré-encodage retire aussi les métadonnées (position GPS).
 */
const TAILLE_MAX_PX = 3000;
const QUALITE_JPEG = 0.9;
const POIDS_MAX_ORIGINAL = 25 * 1024 * 1024;
/** Taille max d'une vidéo AVANT compression (elle sera réduite sur le téléphone). */
const POIDS_MAX_VIDEO_AVANT = 500 * 1024 * 1024;

@Component({
  selector: 'app-public-galerie',
  standalone: true,
  imports: [FormsModule, RouterLink],
  styleUrls: ['../../shared/invitation-commun.css'],
  host: { '(document:keydown)': 'clavier($event)' },
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
        <p class="surtitre">Nos souvenirs</p>
        <h1>Galerie photo</h1>
        <p class="intro">Vous avez pris de belles photos ? Partagez-les avec nous : elles apparaîtront ici une fois validées.</p>
      </section>

      <!-- ───── Partage de photos ───── -->
      @if (envoiOuvert()) {
        <section class="partage">
          <input #choix type="file" accept="image/*,video/*" multiple hidden (change)="ajouterFichiers(choix)" />

          <div class="partage-entete">
            <div class="partage-icone" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>
            </div>
            <div>
              <h2>Partagez vos photos et vidéos</h2>
              <p>Plusieurs à la fois, depuis votre galerie ou votre appareil. Vidéos : {{ dureeMax }} secondes maximum.</p>
            </div>
          </div>

          <label for="auteur-photos">Votre prénom <span class="facultatif">(facultatif)</span></label>
          <input id="auteur-photos" class="champ" name="auteur" [(ngModel)]="auteur" (change)="memoriserAuteur()"
                 maxlength="100" autocomplete="given-name" autocapitalize="words" placeholder="Pour que les mariés sachent qui remercier" />

          <button type="button" class="bouton" (click)="choix.click()" [disabled]="enCours()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4"/></svg>
            Choisir photos ou vidéos
          </button>

          @if (envois().length) {
            <ul class="file-envoi" aria-live="polite">
              @for (e of envois(); track e.id) {
                <li class="envoi" [class]="'envoi envoi--' + e.statut">
                  @if (e.video) {
                    <video [src]="e.apercu" muted playsinline preload="metadata"></video>
                  } @else {
                    <img [src]="e.apercu" alt="" />
                  }
                  <div class="envoi-infos">
                    <p class="envoi-statut">
                      @switch (e.statut) {
                        @case ('attente') { En attente… }
                        @case ('compression') { {{ e.video ? 'Compression ' + e.progression + ' %' : 'Préparation…' }} }
                        @case ('envoi') { Envoi {{ e.progression }} % }
                        @case ('ok') { Envoyée ✓ }
                        @case ('erreur') { {{ e.message || "Échec de l'envoi" }} }
                      }
                    </p>
                    <div class="barre"><span [style.width.%]="e.statut === 'ok' ? 100 : e.progression"></span></div>
                  </div>
                  @if (e.statut === 'erreur' && !e.message) {
                    <button type="button" class="reessayer" (click)="reessayer(e.id)" aria-label="Réessayer">
                      <svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4"/></svg>
                    </button>
                  }
                </li>
              }
            </ul>
            @if (termines() > 0 && !enCours()) {
              <p class="merci">
                Merci ! {{ termines() }} souvenir{{ termines() > 1 ? 's' : '' }} envoyé{{ termines() > 1 ? 's' : '' }}.
                {{ termines() > 1 ? 'Ils apparaîtront' : 'Il apparaîtra' }} après validation par les mariés.
              </p>
            }
          }
          @if (erreurFichier()) { <p class="erreur" role="alert">{{ erreurFichier() }}</p> }
        </section>
      }

      <!-- ───── Mosaïque des photos validées ───── -->
      @if (chargement()) {
        <div class="mosaique">
          @for (h of [220, 160, 260, 190]; track $index) { <div class="squelette" [style.height.px]="h"></div> }
        </div>
      } @else if (photos().length === 0) {
        <div class="vide">
          <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="10" width="36" height="28" rx="3"/><circle cx="17" cy="20" r="3.5"/><path d="M6 33l10-9 8 7 6-5 12 10"/></svg>
          <p>Aucune photo pour l'instant. Revenez après le grand jour !</p>
        </div>
      } @else {
        <p class="compteur-photos">{{ photos().length }} souvenir{{ photos().length > 1 ? 's' : '' }}</p>
        <div class="mosaique">
          @for (photo of photos(); track photo.id; let i = $index) {
            <button type="button" class="vignette" (click)="ouvrirVisionneuse(i)"
                    [attr.aria-label]="(photo.type === 'VIDEO' ? 'Voir la vidéo ' : 'Voir la photo ') + (i + 1)">
              <img [src]="photo.urlMiniature || photo.url" alt="" loading="lazy" decoding="async" (load)="charge($event)" />
              @if (photo.type === 'VIDEO') {
                <span class="lecture" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>
                  @if (photo.duree) { <span>{{ formaterDuree(photo.duree) }}</span> }
                </span>
              }
            </button>
          }
        </div>
      }

      <!-- ───── Visionneuse plein écran ───── -->
      @if (indexVisionneuse() !== null) {
        <div class="visionneuse" role="dialog" aria-modal="true" aria-label="Visionneuse"
             (touchstart)="debutGlisse($event)" (touchend)="finGlisse($event)">
          <div class="visionneuse-haut">
            <span>{{ indexVisionneuse()! + 1 }} / {{ photos().length }}</span>
            <span class="visionneuse-actions">
              @if (photoCourante()?.urlTelechargement; as lien) {
                <a [href]="lien" download rel="noopener" aria-label="Télécharger en qualité d'origine">
                  <svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>
                </a>
              }
            <button type="button" (click)="fermerVisionneuse()" aria-label="Fermer">
              <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
            </span>
          </div>

          @for (p of [photoCourante()]; track p?.id) {
            @if (p) {
              @if (p.type === 'VIDEO') {
                <video class="visionneuse-image" [src]="p.url" [poster]="p.urlMiniature || ''" controls playsinline autoplay></video>
              } @else {
                <img class="visionneuse-image" [src]="p.url" alt="" />
              }
            }
          }

          @if (photos().length > 1) {
            <button type="button" class="nav nav--prec" (click)="naviguer(-1)" aria-label="Photo précédente">
              <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>
            </button>
            <button type="button" class="nav nav--suiv" (click)="naviguer(1)" aria-label="Photo suivante">
              <svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
            </button>
          }
          <p class="visionneuse-aide">Glissez pour changer de photo</p>
        </div>
      }
    </div>
  `,
  styles: [`
    /* Partage */
    .partage {
      max-width: 560px; margin: 0 auto 2rem;
      padding: 1.25rem 1.1rem 1.35rem;
      background: #fff;
      border: 1px solid color-mix(in srgb, var(--couleur-tertiaire) 50%, transparent);
      border-radius: 18px;
      box-shadow: 0 16px 40px -24px color-mix(in srgb, var(--couleur-texte) 40%, transparent);
      animation: monter 600ms 120ms cubic-bezier(.2,.7,.2,1) both;
    }
    .partage-entete { display: flex; gap: .9rem; align-items: center; margin-bottom: 1.1rem; }
    .partage-icone { flex: none; width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, var(--couleur-secondaire) 12%, #fff); }
    .partage-icone svg { width: 26px; height: 26px; fill: none; stroke: var(--couleur-secondaire); stroke-width: 1.6; stroke-linejoin: round; }
    .partage h2 { font-family: var(--affichage); font-weight: 500; font-size: 1.45rem; line-height: 1.2; }
    .partage-entete p { font-size: .82rem; color: var(--encre-douce); }
    .facultatif { font-weight: 400; opacity: .7; }
    .partage .bouton { margin-top: 1rem; }

    .file-envoi { list-style: none; margin: 1rem 0 0; padding: 0; display: grid; gap: .5rem; }
    .envoi { display: flex; align-items: center; gap: .75rem; padding: .5rem; border-radius: 12px; background: var(--voile); animation: monter 300ms ease both; }
    .envoi img, .envoi video { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; flex: none; background: #000; }
    .envoi-infos { flex: 1; min-width: 0; }
    .envoi-statut { font-size: .8rem; font-weight: 600; }
    .envoi--ok .envoi-statut { color: #3f7d4f; }
    .envoi--erreur .envoi-statut { color: #b3402f; }
    .barre { height: 4px; margin-top: .35rem; border-radius: 4px; background: color-mix(in srgb, var(--couleur-texte) 10%, transparent); overflow: hidden; }
    .barre span { display: block; height: 100%; border-radius: 4px; background: var(--couleur-secondaire); transition: width 250ms ease; }
    .envoi--ok .barre span { background: #3f7d4f; }
    .envoi--erreur .barre span { background: #b3402f; }
    .reessayer { flex: none; width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--bordure); background: #fff; cursor: pointer; display: grid; place-items: center; }
    .reessayer svg { width: 18px; height: 18px; fill: none; stroke: var(--couleur-texte); stroke-width: 1.8; stroke-linecap: round; }
    .merci { margin-top: .9rem; font-family: var(--affichage); font-style: italic; font-size: 1.05rem; color: var(--couleur-secondaire); text-align: center; }

    /* Mosaïque */
    .compteur-photos { max-width: 1100px; margin: 0 auto .75rem; font-size: .66rem; letter-spacing: .25em; text-transform: uppercase; color: var(--encre-douce); text-align: center; }
    .mosaique { columns: 2; column-gap: 6px; max-width: 1100px; margin: 0 auto; }
    .mosaique > * { break-inside: avoid; margin-bottom: 6px; }
    .vignette { display: block; width: 100%; padding: 0; border: none; background: var(--voile); border-radius: 10px; overflow: hidden; cursor: zoom-in; }
    .vignette img { width: 100%; height: auto; opacity: 0; transform: scale(1.03); transition: opacity 600ms ease, transform 800ms ease; }
    .vignette img.chargee { opacity: 1; transform: none; }
    .vignette { position: relative; }
    .lecture {
      position: absolute; left: 50%; top: 50%; translate: -50% -50%;
      display: inline-flex; align-items: center; gap: .35rem;
      padding: .45rem .75rem .45rem .6rem; border-radius: 999px;
      background: rgba(10, 14, 22, .55); backdrop-filter: blur(4px);
      color: #fff; font-size: .72rem; font-weight: 600; letter-spacing: .04em;
      pointer-events: none;
    }
    .lecture svg { width: 16px; height: 16px; fill: currentColor; }

    /* Visionneuse */
    .visionneuse {
      position: fixed; inset: 0; z-index: 60;
      display: grid; place-items: center;
      background: #0b0f17;
      animation: fondu 200ms ease both;
      touch-action: pan-y;
    }
    .visionneuse-haut {
      position: absolute; top: 0; left: 0; right: 0;
      display: flex; align-items: center; justify-content: space-between;
      padding: max(.75rem, env(safe-area-inset-top)) 1rem .75rem;
      color: rgba(255,255,255,.8); font-size: .8rem; letter-spacing: .1em;
    }
    .visionneuse-actions { display: flex; gap: .5rem; }
    .visionneuse-haut button, .visionneuse-actions a, .nav {
      width: 48px; height: 48px; border-radius: 50%; border: none;
      background: rgba(255,255,255,.12); color: #fff; cursor: pointer;
      display: grid; place-items: center;
    }
    .visionneuse svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }
    .visionneuse-image { max-width: 100%; max-height: 82dvh; object-fit: contain; animation: zoom-entree 260ms ease both; }
    @keyframes zoom-entree { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: none; } }
    .nav { position: absolute; top: 50%; translate: 0 -50%; display: none; }
    .nav--prec { left: 1rem; }
    .nav--suiv { right: 1rem; }
    .visionneuse-aide { position: absolute; bottom: calc(1rem + env(safe-area-inset-bottom)); left: 0; right: 0; text-align: center; color: rgba(255,255,255,.5); font-size: .72rem; }

    @media (min-width: 720px) {
      .mosaique { columns: 3; column-gap: 10px; }
      .mosaique > * { margin-bottom: 10px; }
      .nav { display: grid; }
      .visionneuse-aide { display: none; }
      .visionneuse-image { max-width: 88vw; }
    }
    @media (min-width: 1100px) { .mosaique { columns: 4; } }
    @media (hover: hover) { .vignette:hover img.chargee { transform: scale(1.03); } }
  `]
})
export class PublicGalerieComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private mariagePublicService = inject(MariagePublicService);
  private photosPublicService = inject(PhotosPublicService);
  private photosEnvoiService = inject(PhotosEnvoiService);
  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);
  private destroyRef = inject(DestroyRef);

  slug = '';
  readonly mariage = signal<MariagePublic | null>(null);
  readonly photos = signal<PhotoItem[]>([]);
  readonly chargement = signal(true);

  readonly auteur = signal('');
  readonly envois = signal<Envoi[]>([]);
  readonly erreurFichier = signal('');
  private compteurId = 0;
  private fileEnCours = false;

  readonly indexVisionneuse = signal<number | null>(null);
  private xDepart = 0;

  readonly couleurs = computed(() => couleursMariage(this.mariage()));
  readonly monogramme = computed(() => monogrammeDe(this.mariage()?.nomsCouple));
  /** Le partage est masqué si les mariés ont désactivé la galerie. */
  readonly envoiOuvert = computed(() => this.mariage()?.galeriePhotoActive !== false);
  readonly enCours = computed(() => this.envois().some(e => e.statut === 'attente' || e.statut === 'compression' || e.statut === 'envoi'));
  readonly termines = computed(() => this.envois().filter(e => e.statut === 'ok').length);
  readonly dureeMax = DUREE_MAX_VIDEO_S;
  readonly photoCourante = computed(() => {
    const i = this.indexVisionneuse();
    return i === null ? null : this.photos()[i] ?? null;
  });

  ngOnInit(): void {
    this.slug = this.route.snapshot.paramMap.get('slug') ?? '';
    if (isPlatformBrowser(this.platformId)) {
      chargerPolicesInvitation(this.document);
      try { this.auteur.set(localStorage.getItem('galerie-auteur') ?? ''); } catch { /* indisponible */ }
    }
    this.mariagePublicService.consulter(this.slug).subscribe({ next: m => this.mariage.set(m), error: () => {} });
    this.photosPublicService.lister(this.slug).subscribe({
      next: p => { this.photos.set(p); this.chargement.set(false); },
      error: () => this.chargement.set(false),
    });
    this.destroyRef.onDestroy(() => {
      this.envois().forEach(e => URL.revokeObjectURL(e.apercu));
      if (isPlatformBrowser(this.platformId)) this.document.body.style.overflow = '';
    });
  }

  // ═══════════════ Envoi des photos ═══════════════

  ajouterFichiers(input: HTMLInputElement): void {
    this.erreurFichier.set('');
    const fichiers = Array.from(input.files ?? []);
    input.value = ''; // permet de re-sélectionner les mêmes fichiers
    const valides = fichiers.filter(f =>
      (f.type.startsWith('image/') && f.size <= POIDS_MAX_ORIGINAL) ||
      (f.type.startsWith('video/') && f.size <= POIDS_MAX_VIDEO_AVANT));
    if (valides.length < fichiers.length) {
      this.erreurFichier.set('Certains fichiers ont été ignorés (photos de moins de 25 Mo et vidéos uniquement).');
    }
    const nouveaux: Envoi[] = valides.map(f => ({
      id: ++this.compteurId,
      fichier: f,
      apercu: URL.createObjectURL(f),
      progression: 0,
      statut: 'attente',
      video: f.type.startsWith('video/'),
    }));
    this.envois.update(liste => [...nouveaux, ...liste]);
    this.traiterFile();
  }

  reessayer(id: number): void {
    this.majEnvoi(id, { statut: 'attente', progression: 0 });
    this.traiterFile();
  }

  memoriserAuteur(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try { localStorage.setItem('galerie-auteur', this.auteur().trim()); } catch { /* indisponible */ }
  }

  /** Une photo à la fois : plus fiable sur réseau mobile qu'un envoi en parallèle. */
  private async traiterFile(): Promise<void> {
    if (this.fileEnCours) return;
    this.fileEnCours = true;
    try {
      let suivant: Envoi | undefined;
      while ((suivant = [...this.envois()].reverse().find(e => e.statut === 'attente'))) {
        await this.envoyerUn(suivant);
      }
    } finally {
      this.fileEnCours = false;
    }
  }

  private async envoyerUn(e: Envoi): Promise<void> {
    this.majEnvoi(e.id, { statut: 'compression', progression: 0, message: undefined });

    let blob: Blob, nom: string, duree: number | undefined;
    if (e.video) {
      try {
        ({ blob, nom, duree } = await preparerVideo(e.fichier, p => this.majEnvoi(e.id, { progression: p })));
      } catch (err) {
        const message = err instanceof VideoRefusee ? err.message : 'Cette vidéo ne peut pas être préparée.';
        this.majEnvoi(e.id, { statut: 'erreur', message });
        return;
      }
    } else {
      ({ blob, nom } = await this.compresser(e.fichier));
    }
    this.majEnvoi(e.id, { statut: 'envoi', progression: 0 });

    await new Promise<void>(resolve => {
      this.photosEnvoiService.envoyer(this.slug, blob, nom, this.auteur(), e.video ? 'video' : 'image', duree).subscribe({
        next: ev => {
          if (ev.type === HttpEventType.UploadProgress && ev.total) {
            this.majEnvoi(e.id, { progression: Math.min(99, Math.round((ev.loaded / ev.total) * 100)) });
          } else if (ev.type === HttpEventType.Response) {
            this.majEnvoi(e.id, { statut: 'ok', progression: 100 });
          }
        },
        error: () => { this.majEnvoi(e.id, { statut: 'erreur' }); resolve(); },
        complete: () => resolve(),
      });
    });
  }

  /** Redimensionne à 3000 px max et ré-encode en JPEG 0,9 ; en cas de souci, envoie l'original. */
  private async compresser(f: File): Promise<{ blob: Blob; nom: string }> {
    if (!isPlatformBrowser(this.platformId) || f.type === 'image/gif') return { blob: f, nom: f.name };
    try {
      const image = await createImageBitmap(f);
      const echelle = Math.min(1, TAILLE_MAX_PX / Math.max(image.width, image.height));
      const canvas = this.document.createElement('canvas');
      canvas.width = Math.round(image.width * echelle);
      canvas.height = Math.round(image.height * echelle);
      canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
      image.close();
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', QUALITE_JPEG));
      if (!blob) return { blob: f, nom: f.name };
      return { blob, nom: f.name.replace(/\.[^.]+$/, '') + '.jpg' };
    } catch {
      return { blob: f, nom: f.name };
    }
  }

  formaterDuree(s: number): string {
    const t = Math.round(s);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  }

  private majEnvoi(id: number, maj: Partial<Envoi>): void {
    this.envois.update(liste => liste.map(e => (e.id === id ? { ...e, ...maj } : e)));
  }

  // ═══════════════ Mosaïque & visionneuse ═══════════════

  charge(ev: Event): void {
    (ev.target as HTMLImageElement).classList.add('chargee');
  }

  ouvrirVisionneuse(i: number): void {
    this.indexVisionneuse.set(i);
    if (isPlatformBrowser(this.platformId)) this.document.body.style.overflow = 'hidden';
  }

  fermerVisionneuse(): void {
    this.indexVisionneuse.set(null);
    if (isPlatformBrowser(this.platformId)) this.document.body.style.overflow = '';
  }

  naviguer(sens: number): void {
    const i = this.indexVisionneuse();
    const n = this.photos().length;
    if (i === null || n === 0) return;
    this.indexVisionneuse.set((i + sens + n) % n);
  }

  debutGlisse(ev: TouchEvent): void {
    this.xDepart = ev.changedTouches[0].clientX;
  }

  finGlisse(ev: TouchEvent): void {
    const dx = ev.changedTouches[0].clientX - this.xDepart;
    if (Math.abs(dx) > 50) this.naviguer(dx < 0 ? 1 : -1);
  }

  clavier(ev: KeyboardEvent): void {
    if (this.indexVisionneuse() === null) return;
    if (ev.key === 'Escape') this.fermerVisionneuse();
    if (ev.key === 'ArrowRight') this.naviguer(1);
    if (ev.key === 'ArrowLeft') this.naviguer(-1);
  }
}
