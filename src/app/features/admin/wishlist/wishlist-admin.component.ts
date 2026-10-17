import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WishlistAdminService } from '../../../core/wishlist-admin.service';
import { libelleTypeCadeau, MoyenPaiement, WishlistItemAdmin } from '../../../core/models/admin.models';
import { AdminThemeService } from '../../../shared/admin/admin-theme.service';
import { SignatureStudioComponent } from '../../../shared/admin/signature-studio.component';

/** Même devise que la page publique. */
const DEVISE = 'FCFA';

const LIBELLE_MOYEN: Record<MoyenPaiement, string> = {
  MOBILE_MONEY: 'Mobile Money',
  VIREMENT: 'Virement bancaire',
};

const NOUVEAU = (): Partial<WishlistItemAdmin> => ({
  nom: '', description: '', lien: '', imageUrl: '',
  type: 'MATERIEL', quantite: 1, moyenPaiement: 'MOBILE_MONEY', infosPaiement: '',
});

@Component({
  selector: 'app-wishlist-admin',
  standalone: true,
  imports: [FormsModule, SignatureStudioComponent],
  styleUrls: ['../../../shared/admin/admin-commun.css'],
  template: `
    <header class="entete">
      <div>
        <p class="surtitre">
          @if (theme.monogramme()) { <span class="mono">{{ theme.monogramme() }}</span> }
          Cadeaux
        </p>
        <h1>Liste de mariage</h1>
        <p class="sous-titre">Visible par vos invités sur la page publique.</p>
      </div>
      <button type="button" class="btn" [class.btn-plein]="!formOuvert()" [class.btn-contour]="formOuvert()" (click)="formOuvert.set(!formOuvert())">
        @if (formOuvert()) {
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg> Fermer
        } @else {
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg> Ajouter un cadeau
        }
      </button>
    </header>

    @if (items().length) {
      <section class="stats" aria-label="Résumé">
        <div class="stat stat--primaire" style="--i: 0"><p class="stat-valeur">{{ items().length }}</p><p class="stat-libelle">Idées cadeaux</p></div>
        <div class="stat stat--succes" style="--i: 1"><p class="stat-valeur">{{ stats().reservations }}</p><p class="stat-libelle">Réservations</p></div>
        <div class="stat stat--attente" style="--i: 2"><p class="stat-valeur">{{ stats().complets }}</p><p class="stat-libelle">Cadeaux complets</p></div>
        <div class="stat stat--accent" style="--i: 3"><p class="stat-valeur valeur-prix">{{ stats().montant }}</p><p class="stat-libelle">Participations déclarées ({{ devise }})</p></div>
      </section>
    }

    @if (formOuvert()) {
      <form class="carte formulaire" (ngSubmit)="creer()">
        <h2 class="carte-titre">Nouveau cadeau</h2>

        <span class="label">Type de cadeau</span>
        <div class="segmente type" role="radiogroup">
          <label><input type="radio" name="type" value="MATERIEL" [(ngModel)]="nouveau.type" /><span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7"/></svg> Un objet</span></label>
          <label><input type="radio" name="type" value="MONETAIRE" [(ngModel)]="nouveau.type" /><span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/></svg> Une participation</span></label>
        </div>
        <p class="aide-type">
          {{ estMonetaireForm()
              ? 'Vos invités peuvent participer autant de fois qu’ils le souhaitent, par Mobile Money ou virement.'
              : 'Chaque exemplaire ne peut être réservé qu’une fois. Indiquez combien vous en souhaitez.' }}
        </p>

        <div class="avec-apercu">
          <div class="apercu-image" aria-hidden="true">
            @if (nouveau.imageUrl) {
              <img [src]="nouveau.imageUrl" alt="" (error)="$any($event.target).style.opacity = 0" (load)="$any($event.target).style.opacity = 1" />
            } @else if (estMonetaireForm()) {
              <svg viewBox="0 0 48 48"><rect x="5" y="13" width="38" height="24" rx="3"/><circle cx="24" cy="25" r="5.5"/></svg>
            } @else {
              <svg viewBox="0 0 48 48"><rect x="7" y="18" width="34" height="24" rx="2"/><path d="M4 12h40v6H4zM24 12v30M24 12c-3-7-12-8-12-2 0 3 6 2 12 2zM24 12c3-7 12-8 12-2 0 3-6 2-12 2z"/></svg>
            }
          </div>
          <div class="grille-champs">
            <div class="pleine">
              <label for="w-nom">{{ estMonetaireForm() ? 'Intitulé' : 'Nom du cadeau' }}</label>
              <input id="w-nom" class="champ" name="nom" [(ngModel)]="nouveau.nom" required
                     [placeholder]="estMonetaireForm() ? 'Ex. Notre lune de miel à Kribi' : 'Ex. Service de table'" />
            </div>
            <div>
              <label for="w-prix">{{ estMonetaireForm() ? 'Montant suggéré' : 'Prix' }} en {{ devise }} <span class="facultatif">(facultatif)</span></label>
              <input id="w-prix" class="champ" name="prix" [(ngModel)]="nouveau.prix" type="number" min="0" step="1" inputmode="numeric" />
            </div>
            @if (!estMonetaireForm()) {
              <div>
                <label for="w-qte">Quantité souhaitée</label>
                <div class="compteur">
                  <button type="button" (click)="nouveau.quantite = (nouveau.quantite ?? 1) > 1 ? (nouveau.quantite ?? 1) - 1 : 1" aria-label="Moins">−</button>
                  <input id="w-qte" name="quantite" [(ngModel)]="nouveau.quantite" type="number" min="1" inputmode="numeric" />
                  <button type="button" (click)="nouveau.quantite = (nouveau.quantite ?? 1) + 1" aria-label="Plus">+</button>
                </div>
              </div>
            } @else {
              <div>
                <span class="label">Moyen de paiement</span>
                <div class="segmente" role="radiogroup">
                  <label><input type="radio" name="moyen" value="MOBILE_MONEY" [(ngModel)]="nouveau.moyenPaiement" /><span>Mobile Money</span></label>
                  <label><input type="radio" name="moyen" value="VIREMENT" [(ngModel)]="nouveau.moyenPaiement" /><span>Virement</span></label>
                </div>
              </div>
              <div class="pleine">
                <label for="w-paiement">Coordonnées affichées aux invités</label>
                <textarea id="w-paiement" class="champ" name="infosPaiement" [(ngModel)]="nouveau.infosPaiement" required
                          [placeholder]="nouveau.moyenPaiement === 'VIREMENT'
                            ? 'Banque, titulaire, IBAN / RIB…'
                            : 'Ex. MTN MoMo : 6 XX XX XX XX — Ruth-Mireille N.\nOrange Money : 6 XX XX XX XX'"></textarea>
              </div>
            }
            <div [class.pleine]="estMonetaireForm()">
              <label for="w-lien">Lien <span class="facultatif">(facultatif)</span></label>
              <input id="w-lien" class="champ" name="lien" [(ngModel)]="nouveau.lien" type="url" inputmode="url" placeholder="https://…" />
            </div>
            <div class="pleine">
              <label for="w-image">Image <span class="facultatif">(URL, facultatif)</span></label>
              <input id="w-image" class="champ" name="imageUrl" [(ngModel)]="nouveau.imageUrl" type="url" inputmode="url" placeholder="https://…/photo.jpg" />
            </div>
            <div class="pleine">
              <label for="w-desc">Description <span class="facultatif">(facultatif)</span></label>
              <textarea id="w-desc" class="champ" name="description" [(ngModel)]="nouveau.description" placeholder="Un petit mot pour vos invités…"></textarea>
            </div>
          </div>
        </div>
        <div class="actions-form">
          <button type="submit" class="btn btn-plein" [disabled]="enCours() || !formulaireValide()">
            @if (enCours()) { <span class="spinner"></span> Ajout… } @else { Ajouter à la liste }
          </button>
        </div>
      </form>
    }

    @if (items().length === 0) {
      <div class="vide">
        <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="18" width="34" height="24" rx="2"/><path d="M4 12h40v6H4zM24 12v30M24 12c-3-7-12-8-12-2 0 3 6 2 12 2zM24 12c3-7 12-8 12-2 0 3-6 2-12 2z"/></svg>
        <p class="vide-titre">Votre liste est vide</p>
        <p class="vide-texte">Ajoutez des objets ou une participation (lune de miel, projet…) : vos invités choisiront en un geste.</p>
      </div>
    } @else {
      <div class="grille">
        @for (item of items(); track item.id; let i = $index) {
          <article class="cadeau apparition" [style.--i]="i < 12 ? i : 12" [class.complet]="estComplet(item)">
            <div class="haut">
              <div class="visuel">
                @if (item.imageUrl) {
                  <img [src]="item.imageUrl" alt="" loading="lazy" />
                } @else if (estMonetaire(item)) {
                  <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="13" width="38" height="24" rx="3"/><circle cx="24" cy="25" r="5.5"/></svg>
                } @else {
                  <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="18" width="34" height="24" rx="2"/><path d="M4 12h40v6H4zM24 12v30M24 12c-3-7-12-8-12-2 0 3 6 2 12 2zM24 12c3-7 12-8 12-2 0 3-6 2-12 2z"/></svg>
                }
              </div>
              <div class="infos">
                <div class="ligne-type">
                  @if (estMonetaire(item)) {
                    <span class="badge badge-accent badge-sans-point">Participation · {{ item.moyenPaiement ? libelleMoyen(item.moyenPaiement) : '' }}</span>
                  } @else {
                    <span class="badge badge-primaire badge-sans-point">{{ libelleTypeCadeau(item.type) }}</span>
                  }
                  @if (item.prix) { <span class="prix">{{ formaterPrix(item.prix) }}</span> }
                </div>
                <h3>{{ item.nom }}</h3>
                @if (item.description) { <p class="description">{{ item.description }}</p> }
              </div>
            </div>

            <!-- Progression -->
            <div class="progression">
              @if (estMonetaire(item)) {
                <p class="progression-texte">
                  <strong>{{ nb(item) }}</strong> participation{{ nb(item) > 1 ? 's' : '' }}
                  @if (item.montantTotal) { · <strong>{{ formaterPrix(item.montantTotal) }}</strong> déclarés }
                </p>
              } @else {
                <div class="jauge" aria-hidden="true"><span [style.width.%]="taux(item)"></span></div>
                <p class="progression-texte">
                  <strong>{{ nb(item) }}</strong> / {{ quantite(item) }} réservé{{ nb(item) > 1 ? 's' : '' }}
                  @if (estComplet(item)) { <span class="badge badge-succes">Complet</span> }
                </p>
              }
            </div>

            <!-- Qui a réservé -->
            @if (reservations(item).length) {
              <details class="qui" [open]="reservations(item).length <= 3">
                <summary>{{ estMonetaire(item) ? 'Participants' : 'Réservé par' }} ({{ reservations(item).length }})</summary>
                <ul>
                  @for (r of reservations(item); track r.id) {
                    <li>
                      <span class="avatar" aria-hidden="true">{{ initiales(r.nom) }}</span>
                      <span class="qui-nom">
                        {{ r.nom }}
                        @if (!r.inviteId) { <span class="hors-liste" title="Ce nom ne correspond à aucun invité de votre liste">hors liste</span> }
                      </span>
                      @if (r.montant) { <span class="qui-montant">{{ formaterPrix(r.montant) }}</span> }
                      <span class="qui-date">{{ formaterDate(r.creeLe) }}</span>
                    </li>
                  }
                </ul>
              </details>
            } @else if (item.reservePar) {
              <p class="qui-ancien">Réservé par {{ item.reservePar }}</p>
            }

            <div class="bas">
              @if (estMonetaire(item) && item.infosPaiement) {
                <p class="coordonnees" [title]="item.infosPaiement">{{ item.infosPaiement }}</p>
              } @else {
                <span></span>
              }
              <span class="outils-carte">
                @if (item.lien) {
                  <a class="btn btn-icone lien" [href]="item.lien" target="_blank" rel="noopener" aria-label="Ouvrir le lien">
                    <svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>
                  </a>
                }
                @if (aSupprimer() === item.id) {
                  <button type="button" class="btn btn-danger confirmer" (click)="supprimer(item.id)">Supprimer ?</button>
                } @else {
                  <button type="button" class="btn btn-icone" (click)="demanderSuppression(item.id)" aria-label="Supprimer">
                    <svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/></svg>
                  </button>
                }
              </span>
            </div>
          </article>
        }
      </div>
    }

    <app-signature-studio />
  `,
  styles: [`
    .valeur-prix { font-size: 1.55rem; padding-top: .25rem; }

    .type { margin-bottom: .45rem; }
    .type span svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; }
    .aide-type { font-size: .78rem; color: var(--a-doux); margin-bottom: 1rem; }

    .avec-apercu { display: grid; gap: 1rem; }
    .apercu-image {
      width: 100%; aspect-ratio: 16 / 9;
      border-radius: 12px; overflow: hidden;
      display: grid; place-items: center;
      background: #fff; border: 1px dashed var(--a-bordure-sable);
    }
    .apercu-image img { width: 100%; height: 100%; object-fit: cover; transition: opacity 200ms ease; }
    .apercu-image svg, .visuel svg { width: 44px; height: 44px; fill: none; stroke: var(--a-sable); stroke-width: 1.2; }

    .compteur { display: flex; align-items: center; height: 46px; border: 1px solid color-mix(in srgb, var(--a-encre) 16%, transparent); border-radius: 10px; background: #fff; overflow: hidden; }
    .compteur button { width: 44px; height: 100%; border: none; background: transparent; font-size: 1.2rem; color: var(--a-doux); cursor: pointer; }
    .compteur button:hover { background: var(--a-voile); color: var(--a-encre); }
    .compteur input { flex: 1; min-width: 0; height: 100%; border: none; text-align: center; font-family: var(--a-affichage); font-size: 1.25rem; font-weight: 600; color: var(--a-encre); -moz-appearance: textfield; outline: none; }
    .compteur input::-webkit-outer-spin-button, .compteur input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

    /* Cartes */
    .grille { display: grid; grid-template-columns: minmax(0, 1fr); gap: .9rem; }
    .cadeau {
      min-width: 0;
      display: flex; flex-direction: column; gap: .75rem;
      padding: .9rem;
      background: #fff;
      border: 1px solid var(--a-bordure);
      border-radius: 16px;
      transition: box-shadow 200ms ease;
    }
    .cadeau:hover { box-shadow: 0 16px 30px -22px color-mix(in srgb, var(--a-encre) 45%, transparent); }
    .cadeau.complet { background: color-mix(in srgb, var(--a-succes) 4%, #fff); }
    .haut { display: grid; grid-template-columns: 76px 1fr; gap: .85rem; }
    .visuel { position: relative; width: 76px; height: 76px; border-radius: 12px; overflow: hidden; display: grid; place-items: center; background: var(--a-voile); }
    .visuel img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .infos { min-width: 0; display: flex; flex-direction: column; gap: .2rem; }
    .ligne-type { display: flex; align-items: center; justify-content: space-between; gap: .4rem; flex-wrap: wrap; }
    .ligne-type .badge { font-size: .62rem; padding: .15rem .55rem; }
    .prix { font-size: .78rem; font-weight: 700; }
    .infos h3 { font-family: var(--a-affichage); font-weight: 600; font-size: 1.22rem; line-height: 1.2; }
    .description { font-size: .78rem; color: var(--a-doux); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

    .progression { display: flex; flex-direction: column; gap: .35rem; }
    .jauge { height: 6px; border-radius: 6px; background: color-mix(in srgb, var(--a-encre) 7%, #fff); overflow: hidden; }
    .jauge span { display: block; height: 100%; border-radius: 6px; background: var(--a-primaire); transition: width 600ms cubic-bezier(.2,.7,.2,1); }
    .complet .jauge span { background: var(--a-succes); }
    .progression-texte { display: flex; align-items: center; gap: .4rem; flex-wrap: wrap; font-size: .8rem; color: var(--a-doux); }
    .progression-texte strong { color: var(--a-encre); }
    .progression-texte .badge { padding: .1rem .5rem; font-size: .64rem; }

    .qui { border-top: 1px dashed var(--a-bordure-sable); padding-top: .6rem; }
    .qui summary { cursor: pointer; font-size: .7rem; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--a-doux); list-style: none; display: flex; align-items: center; gap: .35rem; }
    .qui summary::-webkit-details-marker { display: none; }
    .qui summary::before { content: '›'; font-size: 1rem; transition: transform 150ms ease; }
    .qui[open] summary::before { transform: rotate(90deg); }
    .qui ul { display: flex; flex-direction: column; gap: .4rem; margin-top: .55rem; }
    .qui li { display: grid; grid-template-columns: auto 1fr auto; align-items: center; column-gap: .55rem; font-size: .82rem; }
    .qui .avatar { width: 28px; height: 28px; font-size: .75rem; grid-row: span 2; }
    .qui-nom { font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .hors-liste { margin-left: .3rem; padding: .05rem .4rem; border-radius: 999px; font-size: .6rem; font-weight: 600; color: var(--a-attente); background: var(--a-attente-bg); }
    .qui-montant { font-weight: 700; font-size: .8rem; color: var(--a-succes); }
    .qui-date { grid-column: 2 / -1; font-size: .7rem; color: var(--a-pale); }
    .qui-ancien { font-size: .8rem; color: var(--a-doux); }

    .bas { display: flex; align-items: center; justify-content: space-between; gap: .5rem; margin-top: auto; }
    .coordonnees { min-width: 0; font-size: .72rem; color: var(--a-pale); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .outils-carte { display: flex; align-items: center; gap: .15rem; flex: none; }
    .lien:hover { background: color-mix(in srgb, var(--a-primaire) 12%, #fff) !important; color: var(--a-primaire) !important; }
    .confirmer { min-height: 34px; padding: 0 .8rem; font-size: .72rem; animation: a-deplier 200ms ease both; }

    @media (min-width: 720px) {
      .avec-apercu { grid-template-columns: 200px 1fr; align-items: start; }
      .apercu-image { aspect-ratio: 1; }
      .grille { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    }
    @media (min-width: 1100px) {
      .grille { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
  `]
})
export class WishlistAdminComponent implements OnInit {
  private wishlistAdminService = inject(WishlistAdminService);
  readonly theme = inject(AdminThemeService);

  items = signal<WishlistItemAdmin[]>([]);
  enCours = signal(false);

  nouveau: Partial<WishlistItemAdmin> = NOUVEAU();

  readonly devise = DEVISE;
  readonly formOuvert = signal(false);
  /** Suppression en deux temps : 1er clic → « Supprimer ? », 2e clic → suppression. */
  readonly aSupprimer = signal<string | null>(null);
  private minuteur?: ReturnType<typeof setTimeout>;

  readonly stats = computed(() => {
    const l = this.items();
    const montant = l.reduce((n, i) => n + (Number(i.montantTotal) || 0), 0);
    return {
      reservations: l.reduce((n, i) => n + this.nb(i), 0),
      complets: l.filter(i => this.estComplet(i)).length,
      montant: new Intl.NumberFormat('fr-FR').format(montant),
    };
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.wishlistAdminService.lister().subscribe(items => this.items.set(items));
  }

  creer(): void {
    if (!this.formulaireValide()) return;
    this.enCours.set(true);
    const n = this.nouveau;
    const demande: Partial<WishlistItemAdmin> = n.type === 'MONETAIRE'
      ? { ...n, quantite: 1 }
      : { ...n, moyenPaiement: null, infosPaiement: null };
      console.log(demande)
    this.wishlistAdminService.creer(demande).subscribe({
      next: () => {
        this.enCours.set(false);
        this.nouveau = NOUVEAU();
        this.charger();
      },
      error: () => this.enCours.set(false)
    });
  }

  demanderSuppression(id: string): void {
    this.aSupprimer.set(id);
    clearTimeout(this.minuteur);
    this.minuteur = setTimeout(() => this.aSupprimer.set(null), 3500);
  }

  supprimer(id: string): void {
    this.aSupprimer.set(null);
    this.wishlistAdminService.supprimer(id).subscribe(() => this.charger());
  }

  // ── Aides d'affichage ──
  estMonetaireForm(): boolean { return this.nouveau.type === 'MONETAIRE'; }

  formulaireValide(): boolean {
    if (!this.nouveau.nom?.trim()) return false;
    if (this.estMonetaireForm()) return !!this.nouveau.infosPaiement?.trim();
    return (this.nouveau.quantite ?? 0) >= 1;
  }

  estMonetaire(i: WishlistItemAdmin): boolean { return i.type === 'MONETAIRE'; }
  estComplet(i: WishlistItemAdmin): boolean { return !this.estMonetaire(i) && (i.complet ?? !!i.reservePar); }
  reservations(i: WishlistItemAdmin) { return i.reservations ?? []; }
  nb(i: WishlistItemAdmin): number { return i.nbReservations ?? this.reservations(i).length; }
  quantite(i: WishlistItemAdmin): number { return Math.max(1, i.quantite ?? 1); }
  taux(i: WishlistItemAdmin): number { return Math.min(100, (this.nb(i) / this.quantite(i)) * 100); }
  libelleMoyen(m: MoyenPaiement): string { return LIBELLE_MOYEN[m] ?? m; }
 readonly libelleTypeCadeau = libelleTypeCadeau;
  initiales(nom: string): string {
    return nom.trim().split(/\s+/).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('');
  }

  formaterPrix(prix: number | string): string {
    const n = Number(prix);
    return Number.isFinite(n) ? `${new Intl.NumberFormat('fr-FR').format(n)} ${DEVISE}` : String(prix);
  }

  formaterDate(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' · ' +
      d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
}
