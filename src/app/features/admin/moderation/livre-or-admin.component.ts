import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LivreOrAdminService } from '../../../core/livre-or-admin.service';
import { MessageLivreOr, StatutMessage } from '../../../core/models/admin.models';
import { AdminThemeService } from '../../../shared/admin/admin-theme.service';
import { SignatureStudioComponent } from '../../../shared/admin/signature-studio.component';
import { MessageExport, ThemeExport, dureeVideo, exporterLivrePdf, exporterVideoLivre } from '../../../core/livre-or-export';

/**
 * Dossier des images et de la musique du mariage, utilisé par les exports
 * (aquarelles de la couverture et de la dernière page, musique de la vidéo).
 * ⚠ Le même dossier que dans save-the-date.
 */
const DOSSIER_MARIAGE = 'assets/mariages/mireille-rodrigue';

type Filtre = 'tous' | 'attente' | 'publies' | 'rejetes';

const ORDRE: Record<StatutMessage, number> = { EN_ATTENTE: 0, APPROUVE: 1, REJETE: 2 };

@Component({
  selector: 'app-livre-or-admin',
  standalone: true,
  imports: [SignatureStudioComponent],
  styleUrls: ['../../../shared/admin/admin-commun.css'],
  template: `
    <header class="entete">
      <div>
        <p class="surtitre">
          @if (theme.monogramme()) { <span class="mono">{{ theme.monogramme() }}</span> }
          Messages
        </p>
        <h1>Livre d'or</h1>
        <p class="sous-titre">Tous les mots de vos invités. Seuls ceux que vous publiez sont visibles sur la page publique.</p>
      </div>
      @if (publies().length) {
        <button type="button" class="btn btn-contour" (click)="exportOuvert.set(!exportOuvert())">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>
          Exporter
        </button>
      }
    </header>

    <!-- ───── Exports : livre PDF + vidéo souvenir ───── -->
    @if (exportOuvert()) {
      <section class="exports" aria-label="Exporter le livre d'or">
        <article class="export">
          <span class="export-icone" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7M9 11h5"/></svg>
          </span>
          <div class="export-corps">
            <h2>Le livre à imprimer</h2>
            <p>Un PDF au format A5 : couverture, tous les messages publiés ({{ publies().length }}), page de remerciement. Prêt à faire relier chez un imprimeur.</p>
            @if (pdfProgression() !== null) {
              <div class="progression"><span [style.width.%]="pdfProgression()"></span></div>
            }
            <button type="button" class="btn btn-plein" (click)="genererPdf()" [disabled]="pdfProgression() !== null">
              {{ pdfProgression() !== null ? 'Préparation… ' + pdfProgression() + ' %' : 'Télécharger le PDF' }}
            </button>
          </div>
        </article>

        <article class="export">
          <span class="export-icone" aria-hidden="true">
            <svg viewBox="0 0 24 24"><rect x="3" y="5" width="14" height="14" rx="2"/><path d="M17 10l4-2.5v9L17 14"/></svg>
          </span>
          <div class="export-corps">
            <h2>La vidéo souvenir</h2>
            <p>Les pages du livre se tournent une à une, au format vertical (WhatsApp, statut). Choisissez vos messages préférés pour garder une vidéo courte.</p>

            <div class="choix-entete">
              <span>{{ selection().size }} message{{ selection().size > 1 ? 's' : '' }} · environ {{ dureeEstimee() }}</span>
              <span class="choix-liens">
                <button type="button" (click)="toutSelectionner(true)">Tous</button> ·
                <button type="button" (click)="toutSelectionner(false)">Aucun</button>
              </span>
            </div>
            <ul class="choix">
              @for (m of publies(); track m.id) {
                <li>
                  <label>
                    <input type="checkbox" [checked]="selection().has(m.id)" (change)="basculer(m.id)" />
                    <span class="choix-auteur">{{ m.auteur }}</span>
                    <span class="choix-extrait">{{ m.message }}</span>
                  </label>
                </li>
              }
            </ul>

            @if (videoProgression() !== null) {
              <div class="progression"><span [style.width.%]="videoProgression()"></span></div>
              <p class="aide">Ne fermez pas la page pendant la création de la vidéo.</p>
            }
            <button type="button" class="btn btn-plein" (click)="genererVideo()" [disabled]="videoProgression() !== null || selection().size === 0">
              {{ videoProgression() !== null ? 'Création… ' + videoProgression() + ' %' : 'Créer la vidéo' }}
            </button>
          </div>
        </article>
      </section>
    }

    @if (erreur()) {
      <div class="bandeau-erreur" role="alert">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/></svg>
        <p>{{ erreur() }}</p>
        <button type="button" (click)="erreur.set(null)" aria-label="Fermer">×</button>
      </div>
    }

    <section class="stats stats--4" aria-label="Résumé">
      <div class="stat stat--primaire" style="--i: 0"><p class="stat-valeur">{{ messages().length }}</p><p class="stat-libelle">Reçus</p></div>
      <div class="stat stat--attente" style="--i: 1"><p class="stat-valeur">{{ compte('attente') }}</p><p class="stat-libelle">En attente</p></div>
      <div class="stat stat--succes" style="--i: 2"><p class="stat-valeur">{{ compte('publies') }}</p><p class="stat-libelle">Publiés</p></div>
      <div class="stat stat--rejet" style="--i: 3"><p class="stat-valeur">{{ compte('rejetes') }}</p><p class="stat-libelle">Rejetés</p></div>
    </section>

    @if (messages().length) {
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

    @if (messages().length === 0) {
      <div class="vide">
        <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 10h32v22H20l-8 7v-7H8z"/><path d="M16 18h16M16 24h10"/></svg>
        <p class="vide-titre">Aucun message pour l'instant</p>
        <p class="vide-texte">Les mots de vos invités apparaîtront ici dès qu'ils les auront écrits.</p>
      </div>
    } @else if (affiches().length === 0) {
      <div class="vide">
        <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 25l8 8 16-18"/></svg>
        @switch (filtre()) {
          @case ('attente') { <p class="vide-titre">Tout est à jour</p><p class="vide-texte">Aucun message n’attend votre validation.</p> }
          @case ('rejetes') { <p class="vide-titre">Aucun message rejeté</p><p class="vide-texte">Les messages que vous rejetez restent ici, vous pourrez toujours les publier plus tard.</p> }
          @default { <p class="vide-titre">Aucun message publié</p><p class="vide-texte">Publiez les mots que vous souhaitez partager avec vos invités.</p> }
        }
      </div>
    }

    <ul class="mur">
      @for (m of affiches(); track m.id; let i = $index) {
        @let s = statut(m);
        <li class="mot apparition" [style.--i]="i < 10 ? i : 10"
            [class.mot--publie]="s === 'APPROUVE'" [class.mot--rejete]="s === 'REJETE'"
            [class.sortie]="traitement() === m.id">
          <div class="mot-haut">
            @switch (s) {
              @case ('APPROUVE') { <span class="badge badge-succes">Publié</span> }
              @case ('REJETE') { <span class="badge badge-neutre">Rejeté</span> }
              @default { <span class="badge badge-attente">En attente</span> }
            }
            @if (date(m)) { <span class="date">{{ formaterDate(date(m)) }}</span> }
          </div>
          <span class="guillemet" aria-hidden="true">“</span>
          <p class="message">{{ m.message }}</p>
          <div class="pied">
            <p class="auteur">
              <span class="avatar" aria-hidden="true">{{ initiale(m.auteur) }}</span>
              <span>{{ m.auteur }}</span>
            </p>
            <div class="actions">
              @switch (s) {
                @case ('APPROUVE') {
                  @if (aRetirer() === m.id) {
                    <button type="button" class="btn btn-danger" (click)="rejeter(m.id)" [disabled]="!!traitement()">Retirer ?</button>
                  } @else {
                    <button type="button" class="btn btn-rejet" (click)="demanderRetrait(m.id)" [disabled]="!!traitement()">
                      <svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7a12 12 0 0 1-2.9 3.9M6.6 6.6C4.4 8 2.8 10 2 12c1 2.5 5 7 10 7 1.7 0 3.3-.5 4.6-1.3"/></svg>
                      Retirer de la page
                    </button>
                  }
                }
                @case ('REJETE') {
                  <button type="button" class="btn btn-contour" (click)="approuver(m.id)" [disabled]="!!traitement()">
                    <svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg> Publier quand même
                  </button>
                }
                @default {
                  <button type="button" class="btn btn-rejet" (click)="rejeter(m.id)" [disabled]="!!traitement()">
                    <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg> Rejeter
                  </button>
                  <button type="button" class="btn btn-succes" (click)="approuver(m.id)" [disabled]="!!traitement()">
                    <svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg> Publier
                  </button>
                }
              }
            </div>
          </div>
        </li>
      }
    </ul>

    <app-signature-studio />
  `,
  styles: [`
    .exports { display: grid; gap: 1rem; margin-bottom: 1.5rem; animation: a-monter 300ms ease both; }
    .export {
      display: flex; gap: 1rem; align-items: flex-start;
      padding: 1.1rem 1.2rem;
      background: #fff;
      border: 1px solid var(--a-bordure);
      border-radius: 14px;
    }
    .export-icone {
      flex: none; width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center;
      background: color-mix(in srgb, var(--a-accent, var(--couleur-secondaire)) 12%, #fff);
    }
    .export-icone svg { width: 22px; height: 22px; fill: none; stroke: var(--a-accent, var(--couleur-secondaire)); stroke-width: 1.6; stroke-linejoin: round; stroke-linecap: round; }
    .export-corps { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .6rem; align-items: flex-start; }
    .export-corps h2 { font-family: var(--a-affichage); font-weight: 500; font-size: 1.35rem; }
    .export-corps p { font-size: .85rem; color: var(--a-doux); }
    .progression { width: 100%; height: 6px; border-radius: 6px; background: color-mix(in srgb, var(--a-encre) 8%, #fff); overflow: hidden; }
    .progression span { display: block; height: 100%; background: var(--a-succes); transition: width 200ms ease; }
    .aide { font-size: .75rem !important; }
    .choix-entete { width: 100%; display: flex; justify-content: space-between; gap: .5rem; flex-wrap: wrap; font-size: .78rem; font-weight: 600; }
    .choix-liens button { border: none; background: none; padding: 0; color: var(--a-accent, var(--couleur-secondaire)); font: inherit; cursor: pointer; text-decoration: underline; }
    .choix { list-style: none; margin: 0; padding: 0; width: 100%; max-height: 260px; overflow-y: auto; border: 1px solid var(--a-bordure); border-radius: 10px; }
    .choix li + li { border-top: 1px solid var(--a-bordure); }
    .choix label { display: grid; grid-template-columns: auto 1fr; column-gap: .65rem; align-items: start; padding: .6rem .75rem; cursor: pointer; }
    .choix input { grid-row: span 2; margin-top: .2rem; width: 18px; height: 18px; accent-color: var(--a-succes); }
    .choix-auteur { font-size: .82rem; font-weight: 600; }
    .choix-extrait { font-size: .78rem; color: var(--a-doux); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    @media (min-width: 900px) { .exports { grid-template-columns: 1fr 1fr; align-items: start; } }

    .stats--4 { grid-template-columns: repeat(2, 1fr); }
    @media (min-width: 720px) { :host .stats--4 { grid-template-columns: repeat(4, 1fr); max-width: 900px; } }
    .stat--rejet .stat-valeur { color: var(--a-pale); }

    .bandeau-erreur {
      display: flex; align-items: flex-start; gap: .6rem;
      margin-bottom: 1rem; padding: .75rem .9rem;
      border: 1px solid color-mix(in srgb, #b3261e 35%, transparent);
      border-radius: 10px;
      background: color-mix(in srgb, #b3261e 7%, #fff);
      color: #8c1d18; font-size: .86rem; line-height: 1.4;
    }
    .bandeau-erreur svg { flex: none; width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; margin-top: .05rem; }
    .bandeau-erreur p { flex: 1; margin: 0; }
    .bandeau-erreur button { flex: none; border: 0; background: none; color: inherit; font-size: 1.3rem; line-height: 1; cursor: pointer; }

    .mur { columns: 1; column-gap: 1rem; }
    .mot {
      position: relative;
      break-inside: avoid;
      margin-bottom: 1rem;
      padding: .9rem 1.2rem 1rem;
      background: #fff;
      border: 1px solid var(--a-bordure);
      border-left: 3px solid var(--a-attente);
      border-radius: 4px 18px 4px 18px;
      box-shadow: 0 12px 30px -24px color-mix(in srgb, var(--a-encre) 50%, transparent);
      transition: opacity 250ms ease, transform 250ms ease;
    }
    .mot--publie { border-left-color: var(--a-succes); background: color-mix(in srgb, var(--a-succes) 3%, #fff); }
    .mot--rejete { border-left-color: var(--a-pale); background: color-mix(in srgb, var(--a-pale) 6%, #fff); box-shadow: none; }
    .mot--rejete .message, .mot--rejete .auteur { opacity: .6; }
    .mot--rejete .guillemet { opacity: .4; }
    .mot.sortie { opacity: .45; transform: scale(.98); }
    .mot-haut { display: flex; align-items: center; justify-content: space-between; gap: .5rem; margin-bottom: .2rem; }
    .mot-haut .badge { font-size: .64rem; padding: .15rem .55rem; }
    .date { font-size: .7rem; color: var(--a-pale); }
    .guillemet { display: block; height: 1.4rem; font-family: var(--a-affichage); font-size: 3rem; line-height: 1; color: color-mix(in srgb, var(--a-accent) 50%, transparent); }
    .message { font-family: var(--a-affichage); font-size: 1.15rem; line-height: 1.55; white-space: pre-line; word-break: break-word; }

    .pied { display: flex; flex-direction: column; gap: .8rem; margin-top: 1rem; padding-top: .9rem; border-top: 1px dashed var(--a-bordure-sable); }
    .auteur { display: flex; align-items: center; gap: .6rem; font-weight: 600; font-size: .88rem; }
    .auteur .avatar { width: 32px; height: 32px; font-size: .85rem; }
    .actions { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: .5rem; }

    @media (min-width: 900px) {
      .mur { columns: 2; }
      .pied { flex-direction: row; align-items: center; justify-content: space-between; }
      .actions { display: flex; }
    }
  `]
})
export class LivreOrAdminComponent implements OnInit {
  private livreOrAdminService = inject(LivreOrAdminService);
  readonly theme = inject(AdminThemeService);

  readonly messages = signal<MessageLivreOr[]>([]);
  /** Message en cours de traitement (désactive les boutons). */
  readonly traitement = signal<string | null>(null);
  readonly filtre = signal<Filtre>('tous');
  readonly aRetirer = signal<string | null>(null);
  readonly erreur = signal<string | null>(null);

  // ── Exports ──
  readonly exportOuvert = signal(false);
  readonly pdfProgression = signal<number | null>(null);
  readonly videoProgression = signal<number | null>(null);
  /** Messages retenus pour la vidéo (tous les publiés par défaut). */
  readonly selection = signal<Set<string>>(new Set());
  private selectionInitialisee = false;

  /** Messages publiés, du plus ancien au plus récent : l'ordre du livre. */
  readonly publies = computed(() =>
    this.messages()
      .filter(m => this.statut(m) === 'APPROUVE')
      .sort((a, b) => this.date(a).localeCompare(this.date(b))));

  readonly dureeEstimee = computed(() => {
    const s = Math.round(dureeVideo(this.versExport(this.publies().filter(m => this.selection().has(m.id)))));
    return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`;
  });
  private minuteur?: ReturnType<typeof setTimeout>;

  readonly filtres: { cle: Filtre; libelle: string }[] = [
    { cle: 'tous', libelle: 'Tous' },
    { cle: 'attente', libelle: 'En attente' },
    { cle: 'publies', libelle: 'Publiés' },
    { cle: 'rejetes', libelle: 'Rejetés' },
  ];

  /** En attente d'abord, puis publiés, puis rejetés ; les plus récents en premier. */
  readonly affiches = computed(() =>
    this.messages()
      .filter(m => this.correspond(m, this.filtre()))
      .sort((a, b) => ORDRE[this.statut(a)] - ORDRE[this.statut(b)]
        || this.date(b).localeCompare(this.date(a))));

  ngOnInit(): void {
    this.charger();
  }

  /** Tous les messages (en attente, publiés et rejetés). */
  charger(): void {
    this.livreOrAdminService.listerTous().subscribe({
      next: m => {
        this.messages.set(m ?? []);
        this.traitement.set(null);
        if (!this.selectionInitialisee) {
          this.selection.set(new Set(this.publies().map(x => x.id)));
          this.selectionInitialisee = true;
        }
      },
      error: e => { this.traitement.set(null); this.afficherErreur('Chargement des messages impossible', e); },
    });
  }

  approuver(id: string): void {
    this.changerStatut(id, 'APPROUVE', this.livreOrAdminService.approuver(id), 'La publication a échoué');
  }

  /** Rejette un message en attente, ou retire un message publié : il reste listé comme « Rejeté ». */
  rejeter(id: string): void {
    this.aRetirer.set(null);
    this.changerStatut(id, 'REJETE', this.livreOrAdminService.rejeter(id), 'Le rejet a échoué');
  }

  // ═══════════════ Exports ═══════════════

  basculer(id: string): void {
    const s = new Set(this.selection());
    s.has(id) ? s.delete(id) : s.add(id);
    this.selection.set(s);
  }

  toutSelectionner(oui: boolean): void {
    this.selection.set(new Set(oui ? this.publies().map(m => m.id) : []));
  }

  /** Charge le mariage si besoin ; sans lui, la couverture serait vide. */
  private async mariagePret(): Promise<boolean> {
    if (this.theme.mariage()?.nomsCouple) return true;
    try {
      await this.theme.chargerMariageCourant();
    } catch { /* géré juste en dessous */ }
    if (this.theme.mariage()?.nomsCouple) return true;
    this.erreur.set("Impossible de charger les informations du mariage (noms, date). Vérifiez /api/admin/mariage/courant.");
    return false;
  }

  async genererPdf(): Promise<void> {
    this.erreur.set(null);
    if (!(await this.mariagePret())) return;
    this.pdfProgression.set(0);
    try {
      const blob = await exporterLivrePdf(this.versExport(this.publies()), this.themeExport(), p => this.pdfProgression.set(p));
      this.telecharger(blob, `livre-or-${this.nomFichier()}.pdf`);
    } catch (e) {
      this.erreur.set("Le PDF n'a pas pu être créé." + (e instanceof Error ? ' ' + e.message : ''));
    } finally {
      this.pdfProgression.set(null);
    }
  }

  async genererVideo(): Promise<void> {
    this.erreur.set(null);
    if (!(await this.mariagePret())) return;
    this.videoProgression.set(0);
    try {
      const choisis = this.publies().filter(m => this.selection().has(m.id));
      const { blob, extension } = await exporterVideoLivre(this.versExport(choisis), this.themeExport(), p => this.videoProgression.set(p));
      this.telecharger(blob, `livre-or-${this.nomFichier()}.${extension}`);
    } catch (e) {
      this.erreur.set("La vidéo n'a pas pu être créée." + (e instanceof Error ? ' ' + e.message : ''));
    } finally {
      this.videoProgression.set(null);
    }
  }

  private versExport(liste: MessageLivreOr[]): MessageExport[] {
    return liste.map(m => ({ auteur: m.auteur, message: m.message, date: this.date(m) || null }));
  }

  /** Couleurs du mariage (posées sur <html> par AdminThemeService) + infos du couple. */
  private themeExport(): ThemeExport {
    const css = getComputedStyle(document.documentElement);
    const v = (nom: string, defaut: string) => css.getPropertyValue(nom).trim() || defaut;
    const m = this.theme.mariage();
    const dossier = DOSSIER_MARIAGE;
    return {
      primaire: v('--couleur-primaire', '#5e86ae'),
      secondaire: v('--couleur-secondaire', '#c65a2a'),
      tertiaire: v('--couleur-tertiaire', '#d2b48c'),
      fond: v('--couleur-fond', '#fbf8f1'),
      texte: v('--couleur-texte', '#22324a'),
      nomsCouple: m?.nomsCouple ?? '',
      monogramme: this.theme.monogramme(),
      dateMariage: m?.dateMariage ?? null,
      aquarelles: { hautGauche: `${dossier}/fleurs-haut-gauche.webp`, basDroite: `${dossier}/fleurs-bas-droite.webp` },
      musique: `${dossier}/musique.mp3`,
    };
  }

  private nomFichier(): string {
    return (this.theme.monogramme() || 'mariage').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  private telecharger(blob: Blob, nom: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  demanderRetrait(id: string): void {
    this.aRetirer.set(id);
    clearTimeout(this.minuteur);
    this.minuteur = setTimeout(() => this.aRetirer.set(null), 3500);
  }

  /**
   * Statut normalisé, quel que soit le format renvoyé par le backend
   * (statut texte en priorité, sinon le booléen « approuve »).
   */
  statut(m: MessageLivreOr): StatutMessage {
    const s = String(m.statut ?? '').toUpperCase();
    if (s.startsWith('REJET') || s === 'REFUSE') return 'REJETE';
    if (s.startsWith('APPROUV') || s.startsWith('PUBLI') || s.startsWith('VALID')) return 'APPROUVE';
    if (!s && m.approuve === true) return 'APPROUVE';
    return 'EN_ATTENTE';
  }

  compte(f: Filtre): number {
    return this.messages().filter(m => this.correspond(m, f)).length;
  }

  date(m: MessageLivreOr): string {
    return m.creeLe ?? m.dateCreation ?? '';
  }

  initiale(nom: string): string {
    return (nom ?? '').trim().charAt(0).toUpperCase();
  }

  formaterDate(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' · ' +
      d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  /** Met à jour la carte tout de suite, puis resynchronise avec le serveur. */
  private changerStatut(id: string, cible: StatutMessage, appel: Observable<unknown>, libelleErreur: string): void {
    this.erreur.set(null);
    this.traitement.set(id);
    appel.subscribe({
      next: () => {
        this.messages.update(liste => liste.map(m => (m.id === id ? { ...m, statut: cible } : m)));
        this.charger();
      },
      error: e => {
        this.traitement.set(null);
        this.afficherErreur(libelleErreur, e);
      },
    });
  }

  private afficherErreur(libelle: string, e: unknown): void {
    if (e instanceof HttpErrorResponse) {
      const detail = typeof e.error === 'string' ? e.error : e.error?.message;
      const code = e.status === 0 ? 'serveur injoignable' : `HTTP ${e.status}`;
      this.erreur.set(`${libelle} (${code}${detail ? ' : ' + detail : ''}).`);
    } else {
      this.erreur.set(`${libelle}.`);
    }
    console.error(libelle, e);
  }

  private correspond(m: MessageLivreOr, f: Filtre): boolean {
    const s = this.statut(m);
    if (f === 'attente') return s === 'EN_ATTENTE';
    if (f === 'publies') return s === 'APPROUVE';
    if (f === 'rejetes') return s === 'REJETE';
    return true;
  }
}