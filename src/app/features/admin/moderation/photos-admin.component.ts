import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PhotoAdminService } from '../../../core/photo-admin.service';
import { PhotoItem, StatutPhoto } from '../../../core/models/admin.models';
import { AdminThemeService } from '../../../shared/admin/admin-theme.service';
import { SignatureStudioComponent } from '../../../shared/admin/signature-studio.component';

type Filtre = 'tous' | 'attente' | 'publiees' | 'rejetees';

const ORDRE: Record<StatutPhoto, number> = { EN_ATTENTE: 0, APPROUVE: 1, REJETE: 2 };

@Component({
  selector: 'app-photos-admin',
  standalone: true,
  imports: [SignatureStudioComponent],
  styleUrls: ['../../../shared/admin/admin-commun.css'],
  host: { '(document:keydown.escape)': 'apercu.set(null)' },
  template: `
    <header class="entete">
      <div>
        <p class="surtitre">
          @if (theme.monogramme()) { <span class="mono">{{ theme.monogramme() }}</span> }
          Modération
        </p>
        <h1>Galerie photo</h1>
        <p class="sous-titre">Photos et vidéos partagées par vos invités. Seules celles que vous publiez sont visibles dans la galerie.</p>
      </div>
      @if (compte('attente')) {
        <span class="badge badge-attente">{{ compte('attente') }} en attente</span>
      }
    </header>

    @if (erreur()) {
      <div class="bandeau-erreur" role="alert">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/></svg>
        <p>{{ erreur() }}</p>
      </div>
    }

    @if (photos().length) {
      <div class="outils">
        <div class="filtres" role="tablist">
          @for (f of filtres; track f.cle) {
            <button type="button" class="filtre" role="tab" [class.actif]="filtre() === f.cle" [attr.aria-selected]="filtre() === f.cle" (click)="filtre.set(f.cle)">
              {{ f.libelle }} <span class="n">{{ compte(f.cle) }}</span>
            </button>
          }
        </div>
      </div>
    }

    @if (photos().length === 0) {
      <div class="vide">
        <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="10" width="36" height="28" rx="3"/><circle cx="17" cy="20" r="3.5"/><path d="M6 33l10-9 8 7 6-5 12 10"/></svg>
        <p class="vide-titre">Aucune photo pour l'instant</p>
        <p class="vide-texte">Les photos envoyées par vos invités apparaîtront ici.</p>
      </div>
    } @else if (affichees().length === 0) {
      <div class="vide">
        <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 25l8 8 16-18"/></svg>
        <p class="vide-titre">Rien dans cette catégorie</p>
      </div>
    }

    <div class="grille">
      @for (p of affichees(); track p.id; let i = $index) {
        @let s = statut(p);
        <figure class="photo apparition" [style.--i]="i < 12 ? i : 12"
                [class.photo--rejetee]="s === 'REJETE'" [class.sortie]="traitement() === p.id">
          <button type="button" class="vignette" (click)="apercu.set(p)" aria-label="Agrandir la photo">
            <img [src]="p.urlMiniature || p.url" alt="" loading="lazy" decoding="async" />
            @if (p.type === 'VIDEO') {
              <span class="lecture" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg></span>
            }
            <span class="etat">
              @switch (s) {
                @case ('APPROUVE') { <span class="badge badge-succes">Publiée</span> }
                @case ('REJETE') { <span class="badge badge-neutre">Rejetée</span> }
                @default { <span class="badge badge-attente">En attente</span> }
              }
            </span>
            @if (p.nomUploadeur) {
              <figcaption><span class="point"></span>{{ p.nomUploadeur }}</figcaption>
            }
          </button>
          <div class="actions">
            @switch (s) {
              @case ('APPROUVE') {
                <button type="button" class="action action--rejet action--seule" (click)="rejeter(p.id)" [disabled]="!!traitement()">
                  <svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7a12 12 0 0 1-2.9 3.9M6.6 6.6C4.4 8 2.8 10 2 12c1 2.5 5 7 10 7 1.7 0 3.3-.5 4.6-1.3"/></svg>
                  <span>Retirer</span>
                </button>
              }
              @case ('REJETE') {
                <button type="button" class="action action--suppr" (click)="supprimer(p.id)" [disabled]="!!traitement()" aria-label="Supprimer définitivement">
                  <svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg><span>Supprimer</span>
                </button>
                <button type="button" class="action action--ok" (click)="approuver(p.id)" [disabled]="!!traitement()">
                  <svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg><span>Publier</span>
                </button>
              }
              @default {
                <button type="button" class="action action--rejet" (click)="rejeter(p.id)" [disabled]="!!traitement()">
                  <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg><span>Rejeter</span>
                </button>
                <button type="button" class="action action--ok" (click)="approuver(p.id)" [disabled]="!!traitement()">
                  <svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg><span>Publier</span>
                </button>
              }
            }
          </div>
        </figure>
      }
    </div>

    <!-- Aperçu plein écran -->
    @if (apercu(); as p) {
      @let s = statut(p);
      <div class="visionneuse" role="dialog" aria-modal="true" (click)="apercu.set(null)">
        @if (p.type === 'VIDEO') {
          <video [src]="p.url" [poster]="p.urlMiniature || ''" controls playsinline autoplay (click)="$event.stopPropagation()"></video>
        } @else {
          <img [src]="p.url" alt="" (click)="$event.stopPropagation()" />
        }
        <div class="visionneuse-barre" (click)="$event.stopPropagation()">
          @if (p.nomUploadeur) { <p>Envoyée par <strong>{{ p.nomUploadeur }}</strong></p> }
          <div class="visionneuse-actions">
            @if (p.urlTelechargement) {
              <a class="btn btn-contour" [href]="p.urlTelechargement" download rel="noopener">Télécharger</a>
            }
            @if (s !== 'REJETE') {
              <button type="button" class="btn btn-contour" (click)="rejeter(p.id); apercu.set(null)">{{ s === 'APPROUVE' ? 'Retirer' : 'Rejeter' }}</button>
            }
            @if (s !== 'APPROUVE') {
              <button type="button" class="btn btn-succes" (click)="approuver(p.id); apercu.set(null)">Publier</button>
            }
          </div>
        </div>
      </div>
    }

    <app-signature-studio />
  `,
  styles: [`
    .grille { display: grid; grid-template-columns: repeat(2, 1fr); gap: .65rem; }
    .photo {
      display: flex; flex-direction: column;
      background: #fff;
      border: 1px solid var(--a-bordure);
      border-radius: 14px;
      overflow: hidden;
      transition: opacity 250ms ease, transform 250ms ease;
    }
    .photo.sortie { opacity: .4; transform: scale(.97); }
    .photo--rejetee .vignette img { filter: grayscale(.85); opacity: .55; }
    .vignette { position: relative; display: block; padding: 0; border: none; background: var(--a-voile); cursor: zoom-in; aspect-ratio: 1; overflow: hidden; }
    .vignette img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 400ms ease, filter 300ms ease, opacity 300ms ease; }
    .vignette:hover img { transform: scale(1.04); }
    .etat { position: absolute; top: .45rem; left: .45rem; }
    .etat .badge { font-size: .62rem; padding: .15rem .55rem; box-shadow: 0 2px 8px rgba(0,0,0,.15); }
    figcaption {
      position: absolute; left: 0; right: 0; bottom: 0;
      display: flex; align-items: center; gap: .4rem;
      padding: 1.6rem .7rem .55rem;
      background: linear-gradient(transparent, rgba(0,0,0,.6));
      color: #fff; font-size: .72rem; font-weight: 600; text-align: left;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .point { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--a-sable); }

    .actions { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--a-bordure); }
    .action {
      display: flex; align-items: center; justify-content: center; gap: .35rem;
      min-height: 46px;
      border: none; background: #fff;
      font-family: var(--a-texte); font-size: .75rem; font-weight: 600;
      cursor: pointer; transition: background 150ms ease, color 150ms ease;
    }
    .action--seule { grid-column: 1 / -1; border-right: none !important; }
    .action svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .action:disabled { opacity: .5; cursor: not-allowed; }
    .action--rejet, .action--suppr { color: var(--a-doux); border-right: 1px solid var(--a-bordure); }
    .action--rejet:hover:not(:disabled), .action--suppr:hover:not(:disabled) { background: var(--a-danger-bg); color: var(--a-danger); }
    .action--ok { color: var(--a-succes); }
    .action--ok:hover:not(:disabled) { background: var(--a-succes-bg); }

    .visionneuse {
      position: fixed; inset: 0; z-index: 100;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem;
      padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom));
      background: rgba(12, 14, 20, .94);
      animation: a-monter 200ms ease both;
    }
    .visionneuse img, .visionneuse video { max-width: 100%; max-height: 74dvh; object-fit: contain; border-radius: 8px; background: #000; }
    .lecture {
      position: absolute; left: 50%; top: 50%; translate: -50% -50%;
      width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center;
      background: rgba(10, 14, 22, .55); color: #fff; pointer-events: none;
    }
    .lecture svg { width: 20px; height: 20px; fill: currentColor; margin-left: 2px; }
    .visionneuse-barre { display: flex; flex-direction: column; align-items: center; gap: .75rem; color: rgba(255,255,255,.8); font-size: .85rem; }
    .visionneuse-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: .6rem; }
    .visionneuse .btn-contour { background: transparent; color: #fff; border-color: rgba(255,255,255,.35); text-decoration: none; }

    @media (min-width: 640px) { .grille { grid-template-columns: repeat(3, 1fr); gap: 1rem; } }
    @media (min-width: 1100px) { .grille { grid-template-columns: repeat(4, 1fr); } }
  `]
})
export class PhotosAdminComponent implements OnInit {
  private photoAdminService = inject(PhotoAdminService);
  readonly theme = inject(AdminThemeService);

  readonly photos = signal<PhotoItem[]>([]);
  readonly traitement = signal<string | null>(null);
  readonly apercu = signal<PhotoItem | null>(null);
  readonly filtre = signal<Filtre>('tous');
  readonly erreur = signal<string | null>(null);

  readonly filtres: { cle: Filtre; libelle: string }[] = [
    { cle: 'tous', libelle: 'Toutes' },
    { cle: 'attente', libelle: 'En attente' },
    { cle: 'publiees', libelle: 'Publiées' },
    { cle: 'rejetees', libelle: 'Rejetées' },
  ];

  /** En attente d'abord, puis publiées, puis rejetées. */
  readonly affichees = computed(() =>
    this.photos()
      .filter(p => this.correspond(p, this.filtre()))
      .sort((a, b) => ORDRE[this.statut(a)] - ORDRE[this.statut(b)]
        || (b.dateUpload ?? '').localeCompare(a.dateUpload ?? '')));

  ngOnInit(): void {
    this.charger();
  }

  /** Toutes les photos : rien ne disparaît après une décision. */
  charger(): void {
    this.photoAdminService.listerToutes().subscribe({
      next: p => { this.photos.set(p); this.traitement.set(null); },
      error: e => { this.traitement.set(null); this.afficherErreur('Chargement impossible', e); },
    });
  }

  approuver(id: string): void {
    this.changer(id, 'APPROUVE', this.photoAdminService.approuver(id), 'La publication a échoué');
  }

  /** Rejette une photo en attente, ou retire une photo publiée : elle reste listée comme « Rejetée ». */
  rejeter(id: string): void {
    this.changer(id, 'REJETE', this.photoAdminService.rejeter(id), 'Le rejet a échoué');
  }

  /** Seule action irréversible : supprime la photo de la base ET de Cloudinary. */
  supprimer(id: string): void {
    if (!confirm('Supprimer définitivement cette photo ? Elle ne pourra pas être récupérée.')) return;
    this.erreur.set(null);
    this.traitement.set(id);
    this.photoAdminService.supprimer(id).subscribe({
      next: () => { this.photos.update(l => l.filter(p => p.id !== id)); this.traitement.set(null); },
      error: e => { this.traitement.set(null); this.afficherErreur('La suppression a échoué', e); },
    });
  }

  statut(p: PhotoItem): StatutPhoto {
    return p.statut ?? 'EN_ATTENTE';
  }

  compte(f: Filtre): number {
    return this.photos().filter(p => this.correspond(p, f)).length;
  }

  /** Met la carte à jour tout de suite (elle ne disparaît pas), puis resynchronise. */
  private changer(id: string, cible: StatutPhoto, appel: Observable<unknown>, libelle: string): void {
    this.erreur.set(null);
    this.traitement.set(id);
    appel.subscribe({
      next: () => {
        this.photos.update(l => l.map(p => (p.id === id ? { ...p, statut: cible } : p)));
        this.charger();
      },
      error: e => { this.traitement.set(null); this.afficherErreur(libelle, e); },
    });
  }

  private afficherErreur(libelle: string, e: unknown): void {
    const code = e instanceof HttpErrorResponse ? (e.status === 0 ? 'serveur injoignable' : `HTTP ${e.status}`) : '';
    this.erreur.set(code ? `${libelle} (${code}).` : `${libelle}.`);
  }

  private correspond(p: PhotoItem, f: Filtre): boolean {
    const s = this.statut(p);
    if (f === 'attente') return s === 'EN_ATTENTE';
    if (f === 'publiees') return s === 'APPROUVE';
    if (f === 'rejetees') return s === 'REJETE';
    return true;
  }
}
