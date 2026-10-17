import { Injectable, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MariagePublic, MariagePublicService } from '../../core/mariage-public.service';

/**
 * Endpoint admin qui renvoie le slug du mariage de l'admin connecté.
 * ⚠ Aligne la base d'URL sur tes autres services admin (environment.apiUrl…).
 */
const URL_MARIAGE_COURANT = '/api/admin/mariage/courant';

/** Palette « Élégance Côtière » : utilisée tant que le mariage n'est pas chargé. */
const PALETTE = {
  primaire: '#5e86ae',
  secondaire: '#c65a2a',
  tertiaire: '#d2b48c',
  fond: '#fbf8f1',
  texte: '#22324a',
};
const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Thème de l'espace admin = couleurs du mariage.
 * Les variables sont posées sur <html> : toutes les pages admin en héritent,
 * y compris les éléments que le CDK sort du composant (aperçu du glisser-déposer).
 *
 * Chargement :
 *  - automatique : `chargerMariageCourant()` (demande le slug au backend, puis les infos du mariage) ;
 *    les pages admin qui en ont besoin l'appellent elles-mêmes, inutile de toucher au layout ;
 *  - ou manuel : `initialiser(slug)` / `appliquer(mariage)` si ton layout a déjà le mariage.
 */
@Injectable({ providedIn: 'root' })
export class AdminThemeService {
  private document = inject(DOCUMENT);
  private mariagePublicService = inject(MariagePublicService);
  private http = inject(HttpClient);
  private chargement: Promise<void> | null = null;

  readonly mariage = signal<MariagePublic | null>(null);

  /** "Ruth-Mireille et Jules Rodrigues" → "RM & JR" */
  readonly monogramme = computed(() => {
    const n = (this.mariage()?.nomsCouple ?? '').trim();
    if (!n) return '';
    const initiales = (s: string) => s.trim().split(/[\s-]+/).filter(Boolean).map(p => p.charAt(0).toUpperCase()).join('');
    const parties = n.split(/\s+(?:&|et)\s+/i);
    return parties.length === 2 ? `${initiales(parties[0])} & ${initiales(parties[1])}` : initiales(n);
  });

  private initialise = false;

  initialiser(slug: string): void {
    this.chargerPolices();
    this.appliquer(this.mariage());
    if (this.initialise || !slug) return;
    this.initialise = true;
    this.mariagePublicService.consulter(slug).subscribe({
      next: m => this.appliquer(m),
      error: () => this.appliquer(null),
    });
  }

  /**
   * Charge le mariage de l'admin connecté, une seule fois même si plusieurs pages le demandent.
   * Sans effet si le mariage est déjà là. En cas d'échec, un prochain appel réessaie.
   */
  chargerMariageCourant(): Promise<void> {
    if (this.mariage()) return Promise.resolve();
    this.chargement ??= (async () => {
      const { slug } = await firstValueFrom(this.http.get<{ slug: string }>(URL_MARIAGE_COURANT));
      this.chargerPolices();
      const m = await firstValueFrom(this.mariagePublicService.consulter(slug));
      this.initialise = true;
      this.appliquer(m);
    })().finally(() => { this.chargement = null; });
    return this.chargement;
  }

  /** Utilisable aussi directement si le layout a déjà le mariage (ex. endpoint admin). */
  appliquer(m: MariagePublic | null): void {
    this.mariage.set(m);
    const c = (v: string | null | undefined, d: string) => (v && HEX.test(v) ? v : d);
    const s = this.document.documentElement.style;
    s.setProperty('--couleur-primaire', c(m?.couleurPrimaire, PALETTE.primaire));
    s.setProperty('--couleur-secondaire', c(m?.couleurSecondaire, PALETTE.secondaire));
    s.setProperty('--couleur-tertiaire', c(m?.couleurTertiaire, PALETTE.tertiaire));
    s.setProperty('--couleur-fond', c(m?.couleurFond, PALETTE.fond));
    s.setProperty('--couleur-texte', c(m?.couleurTexte, PALETTE.texte));
  }

  private chargerPolices(): void {
    if (this.document.head.querySelector('link[data-polices-save-the-date]')) return;
    const link = this.document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Montserrat:wght@400;500;600&family=Pinyon+Script&display=swap';
    link.setAttribute('data-polices-save-the-date', '');
    this.document.head.appendChild(link);
  }
}
