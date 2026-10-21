import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { TableAdminService } from '../../../core/table-admin.service';
import { InviteAdminService } from '../../../core/invite-admin.service';
import { InviteAdmin, TableItem } from '../../../core/models/admin.models';
import { AdminThemeService } from '../../../shared/admin/admin-theme.service';
import { SignatureStudioComponent } from '../../../shared/admin/signature-studio.component';

interface TableAvecInvites extends TableItem {
  invites: InviteAdmin[];
}

@Component({
  selector: 'app-table-plan',
  standalone: true,
  imports: [FormsModule, DragDropModule, SignatureStudioComponent],
  styleUrls: ['../../../shared/admin/admin-commun.css'],
  template: `
    <header class="entete">
      <div>
        <p class="surtitre">
          @if (theme.monogramme()) { <span class="mono">{{ theme.monogramme() }}</span> }
          Réception
        </p>
        <h1>Plan de table</h1>
        <p class="sous-titre">Glissez les invités d'une table à l'autre, ou utilisez le menu « Déplacer ». La capacité est toujours vérifiée.</p>
      </div>
      @if (enregistrement()) {
        <span class="pastille-statut"><span class="spinner"></span> Enregistrement…</span>
      }
    </header>

    <section class="stats" aria-label="Résumé">
      <div class="stat stat--primaire" style="--i: 0"><p class="stat-valeur">{{ tables.length }}</p><p class="stat-libelle">Tables</p></div>
      <div class="stat stat--accent" style="--i: 1"><p class="stat-valeur">{{ placesTotal }}</p><p class="stat-libelle">Places</p></div>
      <div class="stat stat--succes" style="--i: 2"><p class="stat-valeur">{{ places }}</p><p class="stat-libelle">Invités placés</p></div>
      <div class="stat stat--attente" style="--i: 3"><p class="stat-valeur">{{ nonAffectes.length }}</p><p class="stat-libelle">À placer</p></div>
    </section>

    <form class="carte formulaire creation" (ngSubmit)="creerTable()">
      <div class="champ-nom">
        <label for="t-nom">Nouvelle table</label>
        <input id="t-nom" class="champ" name="nomTable" [(ngModel)]="nouvelleTable.nom" placeholder="Ex. Table des témoins" required />
      </div>
      <div class="champ-capacite">
        <label for="t-cap">Places</label>
        <div class="compteur">
          <button type="button" (click)="nouvelleTable.capacite = nouvelleTable.capacite > 1 ? nouvelleTable.capacite - 1 : 1" aria-label="Moins">−</button>
          <input id="t-cap" name="capacite" [(ngModel)]="nouvelleTable.capacite" type="number" min="1" inputmode="numeric" required />
          <button type="button" (click)="nouvelleTable.capacite = nouvelleTable.capacite + 1" aria-label="Plus">+</button>
        </div>
      </div>
      <button type="submit" class="btn btn-plein" [disabled]="enCours() || !nouvelleTable.nom">
        <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg> Ajouter
      </button>
    </form>

    @if (erreur()) {
      <p class="bandeau-erreur" role="alert">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
        {{ erreur() }}
      </p>
    }

    <div class="plan">
      <!-- Colonne des invités non affectés -->
      <section class="colonne non-affectes">
        <header class="col-entete">
          <span class="icone-table icone-table--attente" aria-hidden="true">
            <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.6 2.8-5.6 5.5-5.6s4.9 2 5.5 5.6"/><path d="M16 11.5c2.3 0 4 1.7 4.5 4.5"/><circle cx="16" cy="7.5" r="2.4"/></svg>
          </span>
          <div class="col-titre">
            <h2>À placer</h2>
            <p>{{ nonAffectes.length }} invité{{ nonAffectes.length > 1 ? 's' : '' }}</p>
          </div>
        </header>
        <div
          cdkDropList
          id="list-non-affectes"
          [cdkDropListData]="nonAffectes"
          [cdkDropListConnectedTo]="connectedToIds"
          class="zone-drop"
          (cdkDropListDropped)="onDrop($event, null)"
        >
          @for (invite of nonAffectes; track invite.id) {
            <div class="carte-invite" cdkDrag [cdkDragDisabled]="enregistrement()" [cdkDragStartDelay]="{ touch: 220, mouse: 0 }">
              <span class="poignee" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg></span>
              <span class="avatar" aria-hidden="true">{{ initiales(invite) }}</span>
              <span class="nom-invite">{{ invite.prenom }} {{ invite.nom }}</span>
              @if (placesDe(invite) === 2) { <span class="places-x2" title="Couple : 2 places">×2</span> }
              <select class="deplacer" title="Déplacer vers…" aria-label="Déplacer vers…"
                      (mousedown)="$event.stopPropagation()" (touchstart)="$event.stopPropagation()"
                      (change)="deplacerVers(invite, $any($event.target).value)">
                <option value="" [selected]="!invite.tableId">Sans table</option>
                @for (t of tables; track t.id) {
                  <option [value]="t.id" [selected]="invite.tableId === t.id">{{ t.nom }}</option>
                }
              </select>
            </div>
          }
          @if (nonAffectes.length === 0) {
            <p class="zone-vide">Tout le monde est placé ✓</p>
          }
        </div>
      </section>

      <!-- Une colonne par table -->
      @for (table of tables; track table.id; let n = $index) {
        <section class="colonne" [class.complete]="placesTable(table) >= table.capacite" [class.depasse]="placesTable(table) > table.capacite">
          <header class="col-entete">
            <span class="icone-table" aria-hidden="true">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><circle cx="12" cy="3.6" r="1.6"/><circle cx="12" cy="20.4" r="1.6"/><circle cx="3.6" cy="12" r="1.6"/><circle cx="20.4" cy="12" r="1.6"/><circle cx="6.1" cy="6.1" r="1.4"/><circle cx="17.9" cy="17.9" r="1.4"/><circle cx="17.9" cy="6.1" r="1.4"/><circle cx="6.1" cy="17.9" r="1.4"/></svg>
            </span>
            <div class="col-titre">
              <h2>{{ table.nom }}</h2>
              <p>
                <strong>{{ placesTable(table) }}</strong> / {{ table.capacite }} places
                @if (placesTable(table) > table.capacite) { <span class="badge badge-danger badge-sans-point">Dépassée</span> }
                @else if (placesTable(table) === table.capacite) { <span class="badge badge-accent badge-sans-point">Complète</span> }
              </p>
            </div>
            @if (aSupprimer() === table.id) {
              <button type="button" class="btn btn-danger confirmer" (click)="confirmerSuppression(table.id)">Supprimer ?</button>
            } @else {
              <button type="button" class="btn btn-icone" (click)="demanderSuppression(table.id)" title="Supprimer la table" aria-label="Supprimer la table">
                <svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/></svg>
              </button>
            }
          </header>
          <div class="jauge" aria-hidden="true"><span [style.width.%]="taux(table)"></span></div>
          <div
            cdkDropList
            [id]="'list-table-' + table.id"
            [cdkDropListData]="table.invites"
            [cdkDropListConnectedTo]="connectedToIds"
            class="zone-drop"
            (cdkDropListDropped)="onDrop($event, table.id)"
          >
            @for (invite of table.invites; track invite.id) {
              <div class="carte-invite" cdkDrag [cdkDragDisabled]="enregistrement()" [cdkDragStartDelay]="{ touch: 220, mouse: 0 }">
                <span class="poignee" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg></span>
                <span class="avatar" aria-hidden="true">{{ initiales(invite) }}</span>
                <span class="nom-invite">{{ invite.prenom }} {{ invite.nom }}</span>
                @if (placesDe(invite) === 2) { <span class="places-x2" title="Couple : 2 places">×2</span> }
                <select class="deplacer" title="Déplacer vers…" aria-label="Déplacer vers…"
                        (mousedown)="$event.stopPropagation()" (touchstart)="$event.stopPropagation()"
                        (change)="deplacerVers(invite, $any($event.target).value)">
                  <option value="" [selected]="!invite.tableId">Sans table</option>
                  @for (t of tables; track t.id) {
                    <option [value]="t.id" [selected]="invite.tableId === t.id">{{ t.nom }}</option>
                  }
                </select>
              </div>
            }
            @if (table.invites.length === 0) {
              <p class="zone-vide">Déposez des invités ici</p>
            }
          </div>
        </section>
      }
    </div>

    <app-signature-studio />
  `,
  styles: [`
    .places-x2 {
      flex: none; padding: .05rem .4rem; border-radius: 999px;
      font-size: .66rem; font-weight: 700; letter-spacing: .04em;
      color: var(--a-primaire, #5e86ae); background: color-mix(in srgb, var(--a-primaire, #5e86ae) 12%, #fff);
    }
    .colonne.depasse .jauge span { background: var(--a-danger, #b3402f); }
    /* Création de table */
    .creation { display: grid; grid-template-columns: 1fr auto; gap: .75rem; align-items: end; }
    .champ-nom { grid-column: 1 / -1; }
    .compteur { display: flex; align-items: center; height: 46px; border: 1px solid color-mix(in srgb, var(--a-encre) 16%, transparent); border-radius: 10px; background: #fff; overflow: hidden; }
    .compteur button { width: 42px; height: 100%; border: none; background: transparent; font-size: 1.2rem; color: var(--a-doux); cursor: pointer; }
    .compteur button:hover { background: var(--a-voile); color: var(--a-encre); }
    .compteur input { width: 48px; height: 100%; border: none; text-align: center; font-family: var(--a-affichage); font-size: 1.25rem; font-weight: 600; color: var(--a-encre); -moz-appearance: textfield; outline: none; }
    .compteur input::-webkit-outer-spin-button, .compteur input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .creation .btn { height: 46px; }

    /* Plan : colonnes défilantes (une par écran sur mobile) */
    .plan {
      display: flex; gap: .9rem;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      padding: .25rem .1rem 1rem;
      margin: 0 -.1rem;
      align-items: flex-start;
      scrollbar-width: thin;
      scrollbar-color: color-mix(in srgb, var(--a-sable) 70%, transparent) transparent;
    }
    .colonne {
      flex: 0 0 min(84%, 300px);
      scroll-snap-align: start;
      display: flex; flex-direction: column;
      max-height: calc(100dvh - 220px);
      background: #fff;
      border: 1px solid var(--a-bordure);
      border-radius: 18px;
      box-shadow: 0 14px 30px -26px color-mix(in srgb, var(--a-encre) 50%, transparent);
      overflow: hidden;
    }
    .colonne.non-affectes { background: var(--a-voile); border: 1px dashed var(--a-bordure-sable); }
    .colonne.complete { border-color: color-mix(in srgb, var(--a-accent) 35%, transparent); }

    .col-entete { display: flex; align-items: center; gap: .7rem; padding: .9rem .9rem .75rem; }
    .icone-table {
      flex: none; width: 42px; height: 42px; border-radius: 50%;
      display: grid; place-items: center;
      background: color-mix(in srgb, var(--a-primaire) 12%, #fff);
      color: var(--a-primaire);
    }
    .icone-table svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.4; }
    .icone-table--attente { background: color-mix(in srgb, var(--a-attente) 14%, #fff); color: var(--a-attente); }
    .complete .icone-table { background: color-mix(in srgb, var(--a-accent) 14%, #fff); color: var(--a-accent); }
    .col-titre { flex: 1; min-width: 0; }
    .col-titre h2 { font-family: var(--a-affichage); font-weight: 600; font-size: 1.25rem; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .col-titre p { display: flex; align-items: center; gap: .4rem; font-size: .74rem; color: var(--a-doux); margin-top: .1rem; }
    .col-titre strong { color: var(--a-encre); }
    .col-titre .badge { padding: .08rem .5rem; font-size: .62rem; }
    .confirmer { min-height: 32px; padding: 0 .7rem; font-size: .7rem; animation: a-deplier 200ms ease both; }

    .jauge { height: 4px; margin: 0 .9rem .6rem; border-radius: 4px; background: color-mix(in srgb, var(--a-encre) 7%, #fff); overflow: hidden; }
    .jauge span { display: block; height: 100%; border-radius: 4px; background: var(--a-primaire); transition: width 500ms cubic-bezier(.2,.7,.2,1); }
    .complete .jauge span { background: var(--a-accent); }

    /* Zone de dépôt */
    .zone-drop {
      flex: 1;
      min-height: 120px;
      display: flex; flex-direction: column; gap: .45rem;
      overflow-y: auto;
      padding: .25rem .7rem .8rem;
      transition: background 200ms ease;
    }
    .zone-drop.cdk-drop-list-receiving { background: color-mix(in srgb, var(--a-primaire) 6%, transparent); }
    .zone-vide {
      display: grid; place-items: center;
      min-height: 84px;
      border: 1.5px dashed color-mix(in srgb, var(--a-encre) 14%, transparent);
      border-radius: 12px;
      font-family: var(--a-affichage); font-style: italic; font-size: 1rem; color: var(--a-pale);
    }
    .cdk-drop-list-dragging .zone-vide, .cdk-drop-list-receiving .zone-vide { display: none; }

    /* Cartes d'invités */
    .carte-invite {
      display: flex; align-items: center; gap: .5rem;
      padding: .45rem .5rem .45rem .35rem;
      background: #fff;
      border: 1px solid var(--a-bordure);
      border-radius: 12px;
      font-size: .86rem; font-weight: 500;
      cursor: grab;
      user-select: none;
      transition: box-shadow 150ms ease, border-color 150ms ease;
    }
    .carte-invite:hover { border-color: color-mix(in srgb, var(--a-primaire) 35%, transparent); box-shadow: 0 4px 12px -6px rgba(0,0,0,.18); }
    .carte-invite:active { cursor: grabbing; }
    .carte-invite .avatar { width: 30px; height: 30px; font-size: .8rem; }
    .poignee { display: grid; place-items: center; color: var(--a-pale); }
    .poignee svg { width: 14px; height: 18px; fill: currentColor; }
    .nom-invite { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .deplacer {
      flex: none;
      max-width: 96px;
      height: 30px;
      padding: 0 1.4rem 0 .55rem;
      border: 1px solid var(--a-bordure);
      border-radius: 999px;
      background: color-mix(in srgb, var(--a-encre) 4%, #fff) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5' fill='none' stroke='%23888' stroke-width='2'/%3E%3C/svg%3E") no-repeat right .4rem center / 12px;
      -webkit-appearance: none; appearance: none;
      font-family: var(--a-texte); font-size: .7rem; font-weight: 600; color: var(--a-doux);
      cursor: pointer;
    }

    /* CDK : l'aperçu est rendu hors du composant → couleurs avec repli */
    .cdk-drag-preview {
      box-sizing: border-box;
      display: flex; align-items: center; gap: .5rem;
      padding: .45rem .5rem .45rem .35rem;
      background: #fff;
      border: 1px solid var(--couleur-primaire, #5e86ae);
      border-radius: 12px;
      box-shadow: 0 18px 36px -10px rgba(0,0,0,.35);
      font-family: 'Montserrat', system-ui, sans-serif; font-size: .86rem; font-weight: 600;
      color: var(--couleur-texte, #22324a);
      transform: rotate(-2deg);
    }
    .cdk-drag-preview .avatar {
      width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center;
      font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 600; font-size: .8rem;
      background: color-mix(in srgb, var(--couleur-primaire, #5e86ae) 15%, #fff);
      color: var(--couleur-primaire, #5e86ae);
    }
    .cdk-drag-preview .poignee svg { width: 14px; height: 18px; fill: #aaa; }
    .cdk-drag-preview .nom-invite { flex: 1; }
    .cdk-drag-preview .deplacer { display: none; }
    .cdk-drag-placeholder {
      opacity: 1;
      background: color-mix(in srgb, var(--a-primaire) 8%, #fff);
      border: 1.5px dashed color-mix(in srgb, var(--a-primaire) 45%, transparent);
      box-shadow: none;
    }
    .cdk-drag-placeholder > * { visibility: hidden; }
    .cdk-drag-animating { transition: transform 250ms cubic-bezier(0, 0, 0.2, 1); }
    .zone-drop.cdk-drop-list-dragging .carte-invite:not(.cdk-drag-placeholder) { transition: transform 250ms cubic-bezier(0, 0, 0.2, 1); }

    @media (min-width: 720px) {
      .creation { grid-template-columns: 1fr auto auto; max-width: 640px; }
      .champ-nom { grid-column: auto; }
      .colonne { flex-basis: 300px; }
      .deplacer { max-width: 86px; }
    }
    /* Grand écran : les tables passent à la ligne au lieu de défiler */
    @media (min-width: 1000px) {
      .plan { flex-wrap: wrap; overflow: visible; scroll-snap-type: none; }
      .colonne { flex: 0 0 calc((100% - 2 * .9rem) / 3); max-height: 520px; }
    }
    @media (min-width: 1300px) {
      .colonne { flex-basis: calc((100% - 3 * .9rem) / 4); }
    }
  `]
})
export class TablePlanComponent implements OnInit {
  private tableAdminService = inject(TableAdminService);
  private inviteAdminService = inject(InviteAdminService);
  readonly theme = inject(AdminThemeService);

  tables: TableAvecInvites[] = [];
  nonAffectes: InviteAdmin[] = [];

  enCours = signal(false);
  enregistrement = signal(false);
  erreur = signal<string | null>(null);

  nouvelleTable = { nom: '', capacite: 8 };

  /** Suppression en deux temps : 1er clic → « Supprimer ? », 2e clic → suppression. */
  readonly aSupprimer = signal<string | null>(null);
  private minuteur?: ReturnType<typeof setTimeout>;

  // Getter qui centralise les identifiants de toutes les listes connectées
  get connectedToIds(): string[] {
    return ['list-non-affectes', ...this.tables.map(t => 'list-table-' + t.id)];
  }

  // ── Statistiques d'affichage ──
  get placesTotal(): number {
    return this.tables.reduce((n, t) => n + t.capacite, 0);
  }

  get places(): number {
    return this.tables.reduce((n, t) => n + this.placesTable(t), 0);
  }

  /**
   * Personnes occupées par une invitation à table :
   * couple confirmé (ou couple qui n'a pas encore répondu) = 2, solo = 1, décliné = 0.
   */
  placesDe(i: InviteAdmin): number {
    if (i.statutRsvp === 'DECLINE') return 0;
    if (i.statutRsvp === 'CONFIRME_SOLO') return 1;
    if (i.statutRsvp === 'CONFIRME_COUPLE') return 2;
    return i.typePlace === 'COUPLE' ? 2 : 1;
  }

  placesTable(t: TableAvecInvites): number {
    return t.invites.reduce((n, i) => n + this.placesDe(i), 0);
  }

  ngOnInit(): void {
    this.charger();
  }

  /** Recharge tables + invités depuis le serveur : la base est toujours la source de vérité. */
  charger(): void {
    forkJoin({
      tables: this.tableAdminService.lister(),
      invites: this.inviteAdminService.lister()
    }).subscribe({
      next: ({ tables, invites }) => {
        this.nonAffectes = invites.filter(i => !i.tableId);
        this.tables = tables.map(t => ({
          ...t,
          invites: invites.filter(i => i.tableId === t.id)
        }));
      },
      error: (err: HttpErrorResponse) => this.erreur.set(this.messageErreur(err))
    });
  }

  creerTable(): void {
    if (!this.nouvelleTable.nom || this.nouvelleTable.capacite < 1) return;
    this.enCours.set(true);
    this.tableAdminService.creer(this.nouvelleTable.nom, this.nouvelleTable.capacite).subscribe({
      next: () => {
        this.enCours.set(false);
        this.nouvelleTable = { nom: '', capacite: 8 };
        this.charger();
      },
      error: (err: HttpErrorResponse) => {
        this.enCours.set(false);
        this.erreur.set(this.messageErreur(err));
      }
    });
  }

  demanderSuppression(tableId: string): void {
    this.aSupprimer.set(tableId);
    clearTimeout(this.minuteur);
    this.minuteur = setTimeout(() => this.aSupprimer.set(null), 3500);
  }

  confirmerSuppression(tableId: string): void {
    this.aSupprimer.set(null);
    this.supprimerTable(tableId);
  }

  supprimerTable(tableId: string): void {
    this.tableAdminService.supprimer(tableId).subscribe({
      next: () => this.charger(),
      error: (err: HttpErrorResponse) => this.erreur.set(this.messageErreur(err))
    });
  }

  onDrop(event: CdkDragDrop<InviteAdmin[]>, tableIdCible: string | null): void {
    this.erreur.set(null);

    // Si on déplace dans la même colonne
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }

    const invite = event.previousContainer.data[event.previousIndex];
    if (!invite) return;

    // Transfert visuel optimiste
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );

    // Mettre à jour l'ID de table sur l'invité localement
    const ancienTableId = invite.tableId;
    invite.tableId = tableIdCible;

    // Envoi au backend
    this.enregistrement.set(true);
    this.tableAdminService.affecter(invite.id, tableIdCible).subscribe({
      next: () => {
        this.enregistrement.set(false);
        // Ne PAS appeler this.charger() ici pour ne pas écraser l'état visuel optimiste
      },
      error: (err: HttpErrorResponse) => {
        this.enregistrement.set(false);
        this.erreur.set(this.messageErreur(err));

        // En cas d'erreur (ex: table pleine), annuler le déplacement visuel (Rollback)
        invite.tableId = ancienTableId;
        transferArrayItem(
          event.container.data,
          event.previousContainer.data,
          event.currentIndex,
          event.previousIndex
        );
      }
    });
  }

  /** Alternative au glisser-déposer (clavier, mobile) : menu "Déplacer vers…" sur chaque carte. */
  deplacerVers(invite: InviteAdmin, valeur: string): void {
    const cible = valeur === '' ? null : valeur;
    if ((invite.tableId ?? null) === cible) return;
    this.erreur.set(null);
    this.enregistrer(invite, cible);
  }

  /** Enregistre le placement, puis recharge depuis le serveur (la base fait foi). */
  private enregistrer(invite: InviteAdmin, tableIdCible: string | null): void {
    this.enregistrement.set(true);
    this.tableAdminService.affecter(invite.id, tableIdCible).subscribe({
      next: () => {
        this.enregistrement.set(false);
        this.charger();
      },
      error: (err: HttpErrorResponse) => {
        this.enregistrement.set(false);
        this.erreur.set(this.messageErreur(err));
        this.charger();
      }
    });
  }

  // ── Aides d'affichage ──
  initiales(i: InviteAdmin): string {
    return `${i.prenom?.charAt(0) ?? ''}${i.nom?.charAt(0) ?? ''}`.toUpperCase();
  }

  taux(t: TableAvecInvites): number {
    return t.capacite ? Math.min(100, (this.placesTable(t) / t.capacite) * 100) : 0;
  }

  private messageErreur(err: HttpErrorResponse): string {
    switch (err?.status) {
      case 0:
        return 'Serveur injoignable — vérifiez que le backend est démarré.';
      case 401:
      case 403:
        return 'Session expirée ou droits insuffisants — reconnectez-vous (la session dure 15 minutes).';
      case 404:
        return err.error?.message ?? 'Invité ou table introuvable.';
      case 409:
        return err.error?.message ?? 'Cette table est déjà complète.';
      default:
        return `Erreur serveur (${err?.status}) — consultez les logs du backend.`;
    }
  }
}
