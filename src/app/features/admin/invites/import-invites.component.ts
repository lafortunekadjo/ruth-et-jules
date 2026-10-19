import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

export interface ImportInvitesResultat {
  crees: number;
  ignores: number;
  erreurs: { ligne: number; message: string }[];
}

/**
 * Import des invités depuis Excel, à poser dans la page Invités :
 *   <app-import-invites (importe)="charger()" />
 * Le modèle est un fichier statique : src/assets/modeles/modele-invites.xlsx
 */
@Component({
  selector: 'app-import-invites',
  standalone: true,
  styleUrls: ['../../../shared/admin/admin-commun.css'],
  template: `
    <button type="button" class="btn btn-contour" (click)="ouvert.set(!ouvert())" [attr.aria-expanded]="ouvert()">
      <svg viewBox="0 0 24 24" aria-hidden="true" class="ico"><path d="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>
      Importer depuis Excel
    </button>

    @if (ouvert()) {
      <section class="carte panneau apparition">
        <div class="etapes">
          <div class="etape">
            <span class="num">1</span>
            <div>
              <p class="etape-titre">Téléchargez le modèle</p>
              <p class="etape-texte">Une ligne par invitation : prénom, nom, SOLO ou COUPLE, et si vous voulez téléphone, email, conjoint.</p>
              <a class="btn btn-contour btn-petit" href="assets/modeles/modele-invites.xlsx" download="modele-invites.xlsx">
                <svg viewBox="0 0 24 24" aria-hidden="true" class="ico"><path d="M12 3v12M7 10l5 5 5-5M4 19h16"/></svg>
                Modèle Excel
              </a>
            </div>
          </div>

          <div class="etape">
            <span class="num">2</span>
            <div class="etape-corps">
              <p class="etape-titre">Importez le fichier rempli</p>
              <label class="depot" [class.depot--survol]="survol()"
                     (dragover)="$event.preventDefault(); survol.set(true)" (dragleave)="survol.set(false)"
                     (drop)="deposer($event)">
                <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                       (change)="choisir($event)" [disabled]="enCours()" />
                @if (fichier(); as f) {
                  <strong>{{ f.name }}</strong>
                  <span>{{ taille(f.size) }} · cliquez pour changer</span>
                } @else {
                  <strong>Glissez le fichier ici</strong>
                  <span>ou cliquez pour le choisir (.xlsx, 5 Mo max)</span>
                }
              </label>
              <button type="button" class="btn btn-plein" (click)="importer()" [disabled]="!fichier() || enCours()">
                @if (enCours()) { <span class="spinner"></span> Import en cours… } @else { Importer les invités }
              </button>
            </div>
          </div>
        </div>

        @if (erreur()) { <p class="bandeau-erreur" role="alert">{{ erreur() }}</p> }

        @if (resultat(); as r) {
          <div class="bilan" role="status">
            <p class="bilan-ligne bilan-ok"><strong>{{ r.crees }}</strong> invité{{ r.crees > 1 ? 's' : '' }} ajouté{{ r.crees > 1 ? 's' : '' }}</p>
            @if (r.ignores) {
              <p class="bilan-ligne"><strong>{{ r.ignores }}</strong> déjà présent{{ r.ignores > 1 ? 's' : '' }} (non recréé{{ r.ignores > 1 ? 's' : '' }})</p>
            }
            @if (r.erreurs.length) {
              <p class="bilan-ligne bilan-ko"><strong>{{ r.erreurs.length }}</strong> ligne{{ r.erreurs.length > 1 ? 's' : '' }} à corriger :</p>
              <ul class="bilan-erreurs">
                @for (e of r.erreurs; track e.ligne) { <li><span>Ligne {{ e.ligne }}</span> {{ e.message }}</li> }
              </ul>
              <p class="bilan-aide">Corrigez ces lignes dans Excel et réimportez le même fichier : les invités déjà ajoutés ne seront pas dupliqués.</p>
            }
          </div>
        }
      </section>
    }
  `,
  styles: [`
    :host { display: contents; }
    .ico { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .btn { display: inline-flex; align-items: center; gap: .45rem; }
    .btn-petit { margin-top: .6rem; min-height: 36px; padding: 0 .9rem; font-size: .8rem; text-decoration: none; }
    .panneau { grid-column: 1 / -1; margin-top: .9rem; padding: 1.25rem; }
    .etapes { display: grid; gap: 1.25rem; }
    @media (min-width: 760px) { .etapes { grid-template-columns: 1fr 1.3fr; } }
    .etape { display: flex; gap: .85rem; align-items: flex-start; }
    .num {
      flex: none; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center;
      background: var(--couleur-primaire, #5e86ae); color: #fff; font-weight: 700; font-size: .85rem;
    }
    .etape-titre { margin: .2rem 0 .25rem; font-weight: 600; }
    .etape-texte { margin: 0; font-size: .85rem; opacity: .75; line-height: 1.45; }
    .etape-corps { flex: 1; display: grid; gap: .7rem; }
    .depot {
      position: relative; display: grid; gap: .2rem; justify-items: center; text-align: center;
      padding: 1.1rem 1rem; border-radius: 12px; cursor: pointer;
      border: 1.5px dashed color-mix(in srgb, var(--couleur-tertiaire, #d2b48c) 80%, transparent);
      background: color-mix(in srgb, var(--couleur-tertiaire, #d2b48c) 8%, #fff);
      transition: background .15s, border-color .15s;
    }
    .depot input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    .depot strong { font-size: .92rem; overflow-wrap: anywhere; }
    .depot span { font-size: .78rem; opacity: .7; }
    .depot--survol { border-color: var(--couleur-primaire, #5e86ae); background: color-mix(in srgb, var(--couleur-primaire, #5e86ae) 8%, #fff); }
    .bilan { margin-top: 1.1rem; padding-top: 1rem; border-top: 1px solid color-mix(in srgb, var(--couleur-tertiaire, #d2b48c) 50%, transparent); }
    .bilan-ligne { margin: .25rem 0; font-size: .92rem; }
    .bilan-ok strong { color: #2f7d4f; }
    .bilan-ko strong { color: #b3402f; }
    .bilan-erreurs { margin: .4rem 0 0; padding: 0; list-style: none; max-height: 220px; overflow: auto; font-size: .84rem; }
    .bilan-erreurs li { padding: .35rem 0; border-bottom: 1px dashed rgba(0,0,0,.08); }
    .bilan-erreurs span { display: inline-block; min-width: 4.5rem; font-weight: 600; color: #b3402f; }
    .bilan-aide { margin: .7rem 0 0; font-size: .8rem; opacity: .7; }
  `],
})
export class ImportInvitesComponent {
  private http = inject(HttpClient);

  /** Émis après un import qui a ajouté au moins un invité : la page recharge sa liste. */
  @Output() importe = new EventEmitter<ImportInvitesResultat>();

  readonly ouvert = signal(false);
  readonly fichier = signal<File | null>(null);
  readonly survol = signal(false);
  readonly enCours = signal(false);
  readonly erreur = signal('');
  readonly resultat = signal<ImportInvitesResultat | null>(null);

  choisir(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.prendre(input.files?.[0] ?? null);
    input.value = '';                 // permet de re-choisir le même fichier après correction
  }

  deposer(e: DragEvent): void {
    e.preventDefault();
    this.survol.set(false);
    this.prendre(e.dataTransfer?.files?.[0] ?? null);
  }

  private prendre(f: File | null): void {
    this.erreur.set('');
    this.resultat.set(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.xlsx')) {
      this.erreur.set('Choisissez un fichier Excel .xlsx (le modèle). Un .xls ou .csv doit d’abord être enregistré en .xlsx.');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      this.erreur.set('Fichier trop lourd (5 Mo maximum).');
      return;
    }
    this.fichier.set(f);
  }

  importer(): void {
    const f = this.fichier();
    if (!f) return;
    const form = new FormData();
    form.append('fichier', f, f.name);
    this.enCours.set(true);
    this.erreur.set('');
    this.http.post<ImportInvitesResultat>('/api/admin/invites/import', form).subscribe({
      next: r => {
        this.enCours.set(false);
        this.resultat.set(r);
        this.fichier.set(null);
        if (r.crees > 0) this.importe.emit(r);
      },
      error: (e: HttpErrorResponse) => {
        this.enCours.set(false);
        this.erreur.set(e.error?.message ?? (e.status === 413
          ? 'Fichier trop lourd pour le serveur.'
          : 'L’import a échoué. Vérifiez le fichier et réessayez.'));
      },
    });
  }

  taille(octets: number): string {
    return octets < 1024 * 1024 ? `${Math.round(octets / 1024)} Ko` : `${(octets / 1024 / 1024).toFixed(1)} Mo`;
  }
}
