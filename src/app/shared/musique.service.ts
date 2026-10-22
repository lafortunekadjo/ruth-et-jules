import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

const CLE = 'musique-invitation';

/**
 * Musique de fond de l'invitation, partagée par toutes les pages invités.
 * Le service vit tant que l'onglet est ouvert : la musique continue quand on passe
 * de l'invitation à la liste de mariage, à la galerie, au livre d'or ou au RSVP.
 */
@Injectable({ providedIn: 'root' })
export class MusiqueService {
  private document = inject(DOCUMENT);
  private navigateur = isPlatformBrowser(inject(PLATFORM_ID));

  /** Une musique a été configurée par l'invitation (sinon le bouton reste caché). */
  readonly disponible = signal(false);
  readonly joue = signal(false);
  /** L'invité a coupé le son : respecté pendant toute la visite. */
  readonly coupee = signal(false);

  private audio?: HTMLAudioElement;
  private src = '';
  private volume = 0.35;
  private fondu?: ReturnType<typeof setInterval>;
  private repriseApresMasquage = false;
  private ecouteurs = false;

  /** Appelé par l'invitation au chargement. Sans effet si la même musique est déjà en place. */
  configurer(src: string, volume = 0.35): void {
    if (!this.navigateur || this.src === src) return;
    this.src = src;
    this.volume = volume;
    this.disponible.set(true);
    let choix: string | null = null;
    try { choix = sessionStorage.getItem(CLE); } catch { /* indisponible */ }
    this.coupee.set(choix === 'coupee');
    this.installerEcouteurs(choix === 'joue');
  }

  /** À appeler DANS un geste de l'invité (clic) : les navigateurs bloquent le son sinon. */
  jouer(): void {
    if (!this.navigateur || !this.src || this.joue()) return;
    if (!this.audio) {
      this.audio = new Audio(this.src);
      this.audio.loop = true;
      this.audio.preload = 'auto';
      this.audio.addEventListener('playing', () => this.joue.set(true));
      this.audio.addEventListener('pause', () => { if (!this.document.hidden) this.joue.set(false); });
    }
    this.coupee.set(false);
    this.audio.volume = 0;
    this.audio.play()
      .then(() => { this.memoriser('joue'); this.fondre(this.volume, 2500); })
      .catch(() => this.joue.set(false));      // fichier absent ou son bloqué : le bouton reste là
  }

  /** Démarre seulement si l'invité n'a pas coupé le son. */
  jouerSiAutorise(): void {
    if (!this.coupee()) this.jouer();
  }

  couper(): void {
    this.coupee.set(true);
    this.memoriser('coupee');
    this.fondre(0, 500, () => this.audio?.pause());
  }

  basculer(): void {
    if (this.joue()) this.couper(); else this.jouer();
  }

  private installerEcouteurs(relancerAuToucher: boolean): void {
    if (this.ecouteurs) return;
    this.ecouteurs = true;

    // Page rechargée alors que la musique tournait : reprise au premier toucher.
    if (relancerAuToucher) {
      this.document.addEventListener('pointerdown', () => {
        if (!this.coupee() && !this.joue()) this.jouer();
      }, { once: true, capture: true });
    }

    // Écran verrouillé / autre onglet : pause, puis reprise.
    this.document.addEventListener('visibilitychange', () => {
      if (!this.audio) return;
      if (this.document.hidden) {
        this.repriseApresMasquage = this.joue();
        if (this.joue()) this.audio.pause();
      } else if (this.repriseApresMasquage) {
        this.audio.play().catch(() => this.joue.set(false));
      }
    });
  }

  /** Fondu de volume (iOS ignore `volume` : le son y démarre/s'arrête sans fondu). */
  private fondre(cible: number, duree: number, fin?: () => void): void {
    const a = this.audio;
    if (!a) return;
    clearInterval(this.fondu);
    const depart = a.volume;
    const t0 = performance.now();
    this.fondu = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / duree);
      a.volume = Math.max(0, Math.min(1, depart + (cible - depart) * p));
      if (p >= 1) { clearInterval(this.fondu); fin?.(); }
    }, 50);
  }

  private memoriser(choix: 'joue' | 'coupee'): void {
    try { sessionStorage.setItem(CLE, choix); } catch { /* indisponible */ }
  }
}
