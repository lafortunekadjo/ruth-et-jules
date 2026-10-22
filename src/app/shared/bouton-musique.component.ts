import { Component, inject } from '@angular/core';
import { MusiqueService } from './musique.service';

/**
 * Bouton flottant (haut à droite) pour couper / remettre la musique.
 * Posé une seule fois dans le composant racine : il suit l'invité sur toutes les pages.
 */
@Component({
  selector: 'app-bouton-musique',
  standalone: true,
  template: `
    @if (musique.disponible()) {
      <button type="button" class="musique" [class.musique--joue]="musique.joue()"
              [class.musique--appel]="!musique.joue() && !musique.coupee()"
              (click)="musique.basculer()"
              [attr.aria-label]="musique.joue() ? 'Couper la musique' : 'Écouter la musique'"
              [attr.aria-pressed]="musique.joue()">
        @if (musique.joue()) {
          <span class="barres" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        } @else {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>
            @if (musique.coupee()) { <path class="barre-coupe" d="M3 3l18 18"/> }
          </svg>
        }
      </button>
    }
  `,
  styles: [`
    .musique {
      position: fixed; z-index: 70;
      top: max(14px, env(safe-area-inset-top)); right: max(14px, env(safe-area-inset-right));
      width: 46px; height: 46px; border-radius: 50%; padding: 0;
      display: grid; place-items: center; cursor: pointer;
      border: 1px solid color-mix(in srgb, var(--couleur-tertiaire, #d2b48c) 70%, transparent);
      background: color-mix(in srgb, var(--couleur-fond, #fbf8f1) 82%, transparent);
      -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
      color: var(--couleur-primaire, #5e86ae);
      box-shadow: 0 8px 22px -12px rgba(34, 50, 74, .55);
      transition: transform .2s ease, background .2s ease;
    }
    .musique:active { transform: scale(.94); }
    .musique svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
    .barre-coupe { stroke: var(--couleur-secondaire, #c65a2a); }
    .musique--joue { background: var(--couleur-primaire, #5e86ae); border-color: var(--couleur-primaire, #5e86ae); color: #fff; }
    .musique--appel::after {
      content: ''; position: absolute; inset: -1px; border-radius: 50%;
      border: 1px solid var(--couleur-tertiaire, #d2b48c);
      animation: onde 2.4s ease-out infinite;
    }
    @keyframes onde { to { transform: scale(1.7); opacity: 0; } }
    .barres { display: flex; align-items: flex-end; gap: 3px; height: 16px; }
    .barres i { display: block; width: 3px; height: 100%; border-radius: 2px; background: currentColor; transform-origin: bottom; animation: barre 1s ease-in-out infinite alternate; }
    .barres i:nth-child(2) { animation-delay: -.4s; animation-duration: .8s; }
    .barres i:nth-child(3) { animation-delay: -.7s; animation-duration: 1.15s; }
    .barres i:nth-child(4) { animation-delay: -.2s; animation-duration: .9s; }
    @keyframes barre { from { transform: scaleY(.25); } to { transform: scaleY(1); } }
    @media (prefers-reduced-motion: reduce) {
      .barres i, .musique--appel::after { animation: none; }
      .barres i { transform: scaleY(.7); }
    }
  `],
})
export class BoutonMusiqueComponent {
  readonly musique = inject(MusiqueService);
}
