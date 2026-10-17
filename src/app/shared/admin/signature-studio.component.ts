import { Component, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

/**
 * ✦ Ta signature ✦
 * Elle garde TES couleurs (noir & or), quel que soit le thème du mariage.
 * Modifie seulement cette constante.
 */
export const STUDIO = {
  nom: 'Vanessa Mba Kadjo',
  initiales: 'VMK',
  baseline: 'Création digitale · Douala',
  /** Lien de contact (WhatsApp, portfolio…). null = pas de lien. Ex. 'https://wa.me/2376XXXXXXXX' */
  lien: null as string | null,
};

@Component({
  selector: 'app-signature-studio',
  standalone: true,
  template: `
    <footer class="signature" [class.compacte]="compacte()">
      @if (studio.lien) {
        <a class="carte" [href]="studio.lien" target="_blank" rel="noopener" [attr.aria-label]="'Contacter ' + studio.nom">
          <ng-container *ngTemplateOutlet="contenu" />
        </a>
      } @else {
        <div class="carte"><ng-container *ngTemplateOutlet="contenu" /></div>
      }
      <ng-template #contenu>
        <span class="sceau" aria-hidden="true"><span>{{ studio.initiales }}</span></span>
        <span class="texte">
          <span class="ligne1">Conçu &amp; réalisé par</span>
          <span class="nom">{{ studio.nom }}</span>
          @if (!compacte()) { <span class="baseline">{{ studio.baseline }}</span> }
        </span>
        @if (studio.lien) {
          <svg class="fleche" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>
        }
      </ng-template>
    </footer>
  `,
  imports: [NgTemplateOutlet],
  styles: [`
    :host { display: block; }
    .signature { display: flex; justify-content: center; margin: 3rem 0 .5rem; }
    .signature.compacte { margin: 0; }

    .carte {
      --encre: #171411;
      --or: #c9a24e;
      --or-clair: #e6cd8f;
      --creme: #f4ecdc;
      display: inline-flex;
      align-items: center;
      gap: .85rem;
      padding: .55rem 1.2rem .55rem .55rem;
      border-radius: 999px;
      background:
        radial-gradient(ellipse at 0% 50%, rgba(201,162,78,.16), transparent 60%),
        var(--encre);
      color: var(--creme);
      text-decoration: none;
      box-shadow: 0 10px 26px -14px rgba(0,0,0,.6), inset 0 0 0 1px rgba(201,162,78,.28);
      font-family: 'Montserrat', system-ui, sans-serif;
      transition: transform 200ms ease, box-shadow 200ms ease;
    }
    a.carte:hover { transform: translateY(-1px); box-shadow: 0 14px 30px -14px rgba(0,0,0,.65), inset 0 0 0 1px rgba(201,162,78,.5); }

    /* Sceau de cire noir & or */
    .sceau {
      position: relative;
      flex: none;
      width: 46px; height: 46px;
      border-radius: 50%;
      display: grid; place-items: center;
      background: radial-gradient(circle at 34% 28%, var(--or-clair), var(--or) 52%, #8c6b26 100%);
      box-shadow: inset 0 -3px 6px rgba(0,0,0,.28), inset 0 2px 3px rgba(255,255,255,.35), 0 2px 6px rgba(0,0,0,.4);
      transform: rotate(-8deg);
      transition: transform 400ms cubic-bezier(.3,1.4,.5,1);
    }
    .sceau::before {
      content: ''; position: absolute; inset: 4px;
      border-radius: 50%;
      border: 1px solid rgba(23,20,17,.35);
    }
    .sceau::after {               /* bord « coulé » irrégulier */
      content: ''; position: absolute; inset: -3px;
      border-radius: 50%;
      background: repeating-conic-gradient(from 8deg, rgba(201,162,78,.9) 0 9deg, transparent 9deg 18deg);
      -webkit-mask: radial-gradient(circle, transparent 58%, #000 60%, #000 68%, transparent 70%);
              mask: radial-gradient(circle, transparent 58%, #000 60%, #000 68%, transparent 70%);
      opacity: .55;
    }
    .sceau span {
      position: relative;
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-weight: 600;
      font-size: .82rem;
      letter-spacing: .04em;
      color: var(--encre);
    }
    .carte:hover .sceau { transform: rotate(6deg) scale(1.04); }

    .texte { display: flex; flex-direction: column; line-height: 1.25; }
    .ligne1 { font-size: .56rem; letter-spacing: .22em; text-transform: uppercase; color: rgba(244,236,220,.6); }
    .nom { font-size: .82rem; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--or-clair); }
    .baseline { font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; font-size: .85rem; color: rgba(244,236,220,.75); }
    .fleche { width: 16px; height: 16px; fill: none; stroke: var(--or); stroke-width: 1.8; margin-left: .2rem; }

    .compacte .carte { padding: .4rem .9rem .4rem .4rem; gap: .6rem; }
    .compacte .sceau { width: 36px; height: 36px; }
    .compacte .sceau span { font-size: .66rem; }
  `]
})
export class SignatureStudioComponent {
  readonly compacte = input(false);
  readonly studio = STUDIO;
}
