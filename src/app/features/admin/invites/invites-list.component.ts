import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InviteAdminService } from '../../../core/invite-admin.service';
import { CreerInviteRequest, InviteAdmin, TypePlace } from '../../../core/models/admin.models';
import { AdminThemeService } from '../../../shared/admin/admin-theme.service';
import { SignatureStudioComponent } from '../../../shared/admin/signature-studio.component';
import { ImportInvitesComponent } from './import-invites.component';

type Filtre = 'tous' | 'confirmes' | 'attente' | 'declines';

@Component({
  selector: 'app-invites-list',
  standalone: true,
  imports: [FormsModule, SignatureStudioComponent, ImportInvitesComponent],
  styleUrls: ['../../../shared/admin/admin-commun.css'],
  template: `
    <header class="entete">
      <div>
        <p class="surtitre">
          @if (theme.monogramme()) { <span class="mono">{{ theme.monogramme() }}</span> }
          Gestion
        </p>
        <h1>Invités</h1>
        <p class="sous-titre">{{ invites().length }} invitation{{ invites().length > 1 ? 's' : '' }} enregistrée{{ invites().length > 1 ? 's' : '' }}</p>
      </div>
      <button type="button" class="btn" [class.btn-plein]="!formOuvert()" [class.btn-contour]="formOuvert()" (click)="formOuvert.set(!formOuvert())">
        @if (formOuvert()) {
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg> Fermer
        } @else {
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg> Ajouter un invité
        }
          <app-import-invites (importe)="charger()" />
      </button>
    </header>

    <!-- Statistiques -->
    <section class="stats" aria-label="Résumé des réponses">
      <div class="stat stat--succes" style="--i: 0">
        <p class="stat-valeur">{{ stats().confirmes }}</p>
        <p class="stat-libelle">Confirmés</p>
      </div>
      <div class="stat stat--attente" style="--i: 1">
        <p class="stat-valeur">{{ stats().attente }}</p>
        <p class="stat-libelle">En attente</p>
      </div>
      <div class="stat stat--danger" style="--i: 2">
        <p class="stat-valeur">{{ stats().declines }}</p>
        <p class="stat-libelle">Déclinés</p>
      </div>
      <div class="stat stat--accent" style="--i: 3">
        <p class="stat-valeur">{{ stats().personnes }}</p>
        <p class="stat-libelle">Personnes attendues</p>
      </div>
      <div class="stat stat--primaire stat--large" style="--i: 4">
        <p class="stat-valeur">{{ stats().avecCadeau }}</p>
        <p class="stat-libelle">Invités ayant choisi un cadeau</p>
      </div>
    </section>

    @if (invites().length) {
      <div class="progression" aria-label="Taux de réponse">
        <div class="progression-barre">
          <span class="seg seg--succes" [style.width.%]="pourcent(stats().confirmes)"></span>
          <span class="seg seg--danger" [style.width.%]="pourcent(stats().declines)"></span>
        </div>
        <p>{{ round(pourcent(stats().confirmes + stats().declines)) }} % ont répondu</p>
      </div>
    }

    <!-- Ajout -->
    @if (formOuvert()) {
      <form class="carte formulaire" (ngSubmit)="creer()">
        <h2 class="carte-titre">Nouvel invité</h2>
        <div class="grille-champs">
          <div>
            <label for="i-prenom">Prénom</label>
            <input id="i-prenom" class="champ" name="prenom" [(ngModel)]="nouveau.prenom" required autocapitalize="words" />
          </div>
          <div>
            <label for="i-nom">Nom</label>
            <input id="i-nom" class="champ" name="nom" [(ngModel)]="nouveau.nom" required autocapitalize="words" />
          </div>
          <div>
            <label for="i-email">Email <span class="facultatif">(facultatif)</span></label>
            <input id="i-email" class="champ" name="email" [(ngModel)]="nouveau.email" type="email" inputmode="email" />
          </div>
          <div>
            <label for="i-tel">Téléphone <span class="facultatif">(facultatif)</span></label>
            <input id="i-tel" class="champ" name="telephone" [(ngModel)]="nouveau.telephone" type="tel" inputmode="tel" />
          </div>
          <div class="pleine">
            <span class="label">Invitation pour</span>
            <div class="segmente" role="radiogroup">
              <label><input type="radio" name="typePlace" value="SOLO" [(ngModel)]="nouveau.typePlace" /><span>1 personne</span></label>
              <label><input type="radio" name="typePlace" value="COUPLE" [(ngModel)]="nouveau.typePlace" /><span>Un couple (2)</span></label>
            </div>
          </div>
        </div>
        <div class="actions-form">
          <button type="submit" class="btn btn-plein" [disabled]="enCours() || !nouveau.nom || !nouveau.prenom">
            @if (enCours()) { <span class="spinner"></span> Ajout… } @else { Ajouter l'invité }
          </button>
        </div>
      </form>
    }

    <!-- Recherche & filtres -->
    @if (invites().length) {
      <div class="outils">
        <div class="recherche">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
          <input class="champ" type="search" placeholder="Rechercher un invité…" [(ngModel)]="recherche" name="recherche" aria-label="Rechercher" />
        </div>
        <div class="filtres" role="tablist">
          @for (f of filtres; track f.cle) {
            <button type="button" class="filtre" role="tab" [class.actif]="filtre() === f.cle" [attr.aria-selected]="filtre() === f.cle" (click)="filtre.set(f.cle)">
              {{ f.libelle }} <span class="n">{{ compte(f.cle) }}</span>
            </button>
          }
        </div>
      </div>
    }

    <!-- Liste -->
    @if (invites().length === 0) {
      <div class="vide">
        <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="18" cy="17" r="7"/><path d="M5 40c1-8 6-12 13-12s12 4 13 12"/><circle cx="34" cy="19" r="5"/><path d="M33 28c6 0 9 4 10 10"/></svg>
        <p class="vide-titre">Aucun invité pour l'instant</p>
        <p class="vide-texte">Ajoutez vos premiers invités : ils pourront confirmer leur présence depuis l'invitation.</p>
      </div>
    } @else {
      <div class="carte tableau">
        <table>
          <thead>
            <tr><th>Invité</th><th>Invitation</th><th>Réponse</th><th>Conjoint·e</th><th>Table</th><th>Cadeau</th></tr>
          </thead>
          <tbody>
            @for (invite of invitesFiltres(); track invite.id; let i = $index) {
              <tr class="apparition" [style.--i]="i < 12 ? i : 12">
                <td class="col-invite">
                  <span class="avatar" aria-hidden="true">{{ initiales(invite) }}</span>
                  <span class="identite">
                    <span class="nom">{{ invite.prenom }} {{ invite.nom }}</span>
                    @if (invite.telephone || invite.email) {
                      <span class="contact">{{ invite.telephone || invite.email }}</span>
                    }
                  </span>
                </td>
                <td data-label="Invitation">
                  <span class="badge badge-neutre badge-sans-point">{{ invite.typePlace === 'COUPLE' ? 'Couple' : 'Solo' }}</span>
                </td>
                <td data-label="Réponse">
                  <span class="badge"
                        [class.badge-succes]="estConfirme(invite)"
                        [class.badge-danger]="invite.statutRsvp === 'DECLINE'"
                        [class.badge-attente]="!estConfirme(invite) && invite.statutRsvp !== 'DECLINE'">
                    {{ libelleStatut(invite.statutRsvp) }}
                  </span>
                </td>
                <td data-label="Conjoint·e" [class.vide-cell]="!invite.nomConjoint">{{ invite.nomConjoint || '—' }}</td>
                <td data-label="Table" [class.vide-cell]="!invite.tableNom">
                  @if (invite.tableNom) { <span class="table-nom">{{ invite.tableNom }}</span> } @else { — }
                </td>
                <td data-label="Cadeau" [class.vide-cell]="!invite.cadeaux?.length">
                  @if (invite.cadeaux?.length) {
                    <span class="cadeaux">
                      @for (c of invite.cadeaux; track $index) {
                        <span class="cadeau-puce" [title]="c">
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7C10 3 6 3 6 5.5S9 7 12 7zM12 7c2-4 6-4 6-1.5S15 7 12 7z"/></svg>
                          {{ c }}
                        </span>
                      }
                    </span>
                  } @else { — }
                </td>
              </tr>
            }
            @if (invitesFiltres().length === 0) {
              <tr><td colspan="6" class="aucun">Aucun invité ne correspond à cette recherche.</td></tr>
            }
          </tbody>
        </table>
      </div>
    }

    <app-signature-studio />
  `,
  styles: [`
    .stat--large { grid-column: 1 / -1; }
    @media (min-width: 720px) {
      :host .stats { grid-template-columns: repeat(5, 1fr); }
      .stat--large { grid-column: auto; }
    }
    .progression { display: flex; align-items: center; gap: .8rem; margin: -.4rem 0 1.25rem; }
    .progression p { flex: none; font-size: .75rem; font-weight: 600; color: var(--a-doux); }
    .progression-barre { flex: 1; display: flex; height: 6px; border-radius: 6px; overflow: hidden; background: color-mix(in srgb, var(--a-encre) 8%, #fff); }
    .seg { height: 100%; transition: width 800ms cubic-bezier(.2,.7,.2,1); }
    .seg--succes { background: var(--a-succes); }
    .seg--danger { background: color-mix(in srgb, var(--a-danger) 70%, #fff); }

    /* Tableau → cartes sur mobile */
    .tableau { overflow: hidden; }
    table { width: 100%; border-collapse: collapse; font-size: .88rem; }
    thead { display: none; }
    tbody tr { display: grid; grid-template-columns: 1fr auto; gap: .45rem .75rem; padding: .95rem 1rem; border-top: 1px solid var(--a-bordure); }
    tbody tr:first-child { border-top: none; }
    td { display: flex; align-items: center; gap: .5rem; min-width: 0; }
    td[data-label]::before { content: attr(data-label); font-size: .62rem; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--a-pale); min-width: 5.6rem; }
    .col-invite { grid-column: 1 / -1; gap: .75rem; margin-bottom: .2rem; }
    .vide-cell { color: var(--a-pale); }
    td[data-label] { grid-column: 1 / -1; }

    .identite { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
    .nom { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .contact { font-size: .75rem; color: var(--a-pale); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .table-nom { font-family: var(--a-affichage); font-size: 1.05rem; font-weight: 500; }
    .cadeaux { display: flex; flex-wrap: wrap; gap: .3rem; min-width: 0; }
    .cadeau-puce {
      display: inline-flex; align-items: center; gap: .3rem; max-width: 100%;
      padding: .2rem .6rem; border-radius: 999px;
      background: color-mix(in srgb, var(--a-accent) 10%, #fff); color: color-mix(in srgb, var(--a-accent) 80%, #000);
      font-size: .72rem; font-weight: 600;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .cadeau-puce svg { flex: none; width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 1.8; }
    .aucun { display: block; padding: 1.5rem 0; text-align: center; color: var(--a-doux); font-style: italic; }

    @media (min-width: 820px) {
      thead { display: table-header-group; }
      tbody tr { display: table-row; padding: 0; }
      td { display: table-cell; padding: .85rem 1.1rem; vertical-align: middle; }
      td[data-label]::before { display: none; }
      .col-invite { display: flex; padding: .75rem 1.1rem; margin: 0; }
      th {
        padding: .8rem 1.1rem;
        text-align: left;
        font-size: .64rem; font-weight: 600; letter-spacing: .14em; text-transform: uppercase;
        color: var(--a-doux);
        background: var(--a-voile);
        border-bottom: 1px solid var(--a-bordure-sable);
      }
      tbody tr { transition: background 150ms ease; }
      tbody tr:hover { background: color-mix(in srgb, var(--a-sable) 7%, #fff); }
      .aucun { display: table-cell; }
    }
  `]
})
export class InvitesListComponent implements OnInit {
  private inviteAdminService = inject(InviteAdminService);
  readonly theme = inject(AdminThemeService);

  invites = signal<InviteAdmin[]>([]);
  enCours = signal(false);

  nouveau: CreerInviteRequest = { nom: '', prenom: '', email: '', telephone: '', typePlace: 'SOLO' as TypePlace };

  // ── Présentation (recherche, filtres, statistiques) ──
  readonly formOuvert = signal(false);
  readonly recherche = signal('');
  readonly filtre = signal<Filtre>('tous');
  readonly filtres: { cle: Filtre; libelle: string }[] = [
    { cle: 'tous', libelle: 'Tous' },
    { cle: 'confirmes', libelle: 'Confirmés' },
    { cle: 'attente', libelle: 'En attente' },
    { cle: 'declines', libelle: 'Déclinés' },
  ];

  readonly stats = computed(() => {
    const l = this.invites();
    const confirmes = l.filter(i => this.estConfirme(i));
    return {
      confirmes: confirmes.length,
      declines: l.filter(i => i.statutRsvp === 'DECLINE').length,
      attente: l.filter(i => !this.estConfirme(i) && i.statutRsvp !== 'DECLINE').length,
      personnes: confirmes.reduce((n, i) => n + (i.statutRsvp === 'CONFIRME_COUPLE' ? 2 : 1), 0),
      avecCadeau: l.filter(i => (i.cadeaux?.length ?? 0) > 0).length,
    };
  });

  readonly invitesFiltres = computed(() => {
    const q = this.normaliser(this.recherche());
    return this.invites()
      .filter(i => this.correspond(i, this.filtre()))
      .filter(i => !q || this.normaliser(`${i.prenom} ${i.nom} ${i.nomConjoint ?? ''} ${i.tableNom ?? ''} ${(i.cadeaux ?? []).join(' ')}`).includes(q));
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.inviteAdminService.lister().subscribe(invites => this.invites.set(invites));
  }

  creer(): void {
    this.enCours.set(true);
    this.inviteAdminService.creer(this.nouveau).subscribe({
      next: () => {
        this.enCours.set(false);
        this.nouveau = { nom: '', prenom: '', email: '', telephone: '', typePlace: 'SOLO' as TypePlace };
        this.charger();
      },
      error: () => this.enCours.set(false)
    });
  }

  estConfirme(invite: InviteAdmin): boolean {
    return invite.statutRsvp === 'CONFIRME_SOLO' || invite.statutRsvp === 'CONFIRME_COUPLE';
  }

  libelleStatut(statut: string): string {
    switch (statut) {
      case 'CONFIRME_SOLO': return 'Confirmé';
      case 'CONFIRME_COUPLE': return 'Confirmé (couple)';
      case 'DECLINE': return 'Décliné';
      default: return 'En attente';
    }
  }

  // ── Aides d'affichage ──
  compte(f: Filtre): number {
    return this.invites().filter(i => this.correspond(i, f)).length;
  }

  pourcent(n: number): number {
    const total = this.invites().length;
    return total ? (n / total) * 100 : 0;
  }

  round(n: number): number {
    return Math.round(n);
  }

  initiales(i: InviteAdmin): string {
    return `${i.prenom?.charAt(0) ?? ''}${i.nom?.charAt(0) ?? ''}`.toUpperCase();
  }

  private correspond(i: InviteAdmin, f: Filtre): boolean {
    switch (f) {
      case 'confirmes': return this.estConfirme(i);
      case 'declines': return i.statutRsvp === 'DECLINE';
      case 'attente': return !this.estConfirme(i) && i.statutRsvp !== 'DECLINE';
      default: return true;
    }
  }

  private normaliser(t: string): string {
    return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }
}
