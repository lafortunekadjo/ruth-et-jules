import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="scene">
      <div class="carte">
        <p class="marque">Mariage App</p>
        <h1>Espace organisateurs</h1>

        <form (ngSubmit)="seConnecter()">
          <label>
            Email
            <input class="champ" type="email" name="email" [(ngModel)]="email" required autocomplete="username" />
          </label>
          <label for="mdp">
            Mot de passe
          </label>
          <div class="champ-mdp">
            <input id="mdp" class="champ" name="motDePasse" [(ngModel)]="motDePasse"
                   [type]="mdpVisible() ? 'text' : 'password'"
                   autocomplete="current-password" required />
            <button type="button" class="voir-mdp" (click)="mdpVisible.set(!mdpVisible())"
                    [attr.aria-label]="mdpVisible() ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
                    [attr.aria-pressed]="mdpVisible()">
              @if (mdpVisible()) {
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.9 8.4 2 12 2 12s4 7 10 7c1.8 0 3.4-.5 4.8-1.3M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>
              } @else {
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
              }
            </button>
          </div>


          @if (erreur()) {
            <p class="erreur-texte">{{ erreur() }}</p>
          }

          <button type="submit" class="btn btn-plein" [disabled]="enCours()">
            {{ enCours() ? 'Connexion...' : 'Se connecter' }}
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
  :host {
    display: block;
    min-height: 100vh;
    --bg-page: var(--papier-creux, #f8fafc);
    --bg-card: #ffffff;
    --border-color: var(--trait, #e2e8f0);
    --text-main: var(--encre, #0f172a);
    --text-muted: var(--encre-douce, #64748b);
    --accent: var(--or, #d97706);
    --accent-focus: rgba(217, 119, 6, 0.15);
    --danger-bg: #fef2f2;
    --danger-border: #fecaca;
    --danger-text: #b91c1c;
    --shadow-card: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
  }

  .scene {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at 50% 20%, var(--bg-page), var(--papier, #f1f5f9) 70%);
    padding: 1.5rem;
    box-sizing: border-box;
  }

  .carte {
    width: 100%;
    max-width: 400px;
    padding: 2.75rem 2.25rem;
    text-align: center;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    box-shadow: var(--shadow-card);
    box-sizing: border-box;
  }

  .marque {
    font-family: var(--police-affichage, serif);
    font-style: italic;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--accent);
    margin: 0 0 0.35rem 0;
    letter-spacing: -0.01em;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-main);
    margin: 0 0 2rem 0;
    letter-spacing: -0.02em;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    text-align: left;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  .champ {
    width: 100%;
    font-size: 0.95rem;
    padding: 0.75rem 0.9rem;
    border: 1px solid var(--border-color);
    border-radius: 10px;
    background-color: #ffffff;
    color: var(--text-main);
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    box-sizing: border-box;
  }

  .champ:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-focus);
  }

  .btn {
    margin-top: 0.5rem;
    width: 100%;
    padding: 0.85rem 1rem;
    font-size: 0.95rem;
    font-weight: 600;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .btn-plein {
    background-color: var(--text-main);
    color: #ffffff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  }

  .btn-plein:hover:not(:disabled) {
    background-color: #1e293b;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
  }

  .btn-plein:active:not(:disabled) {
    transform: translateY(0);
  }

  .btn-plein:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  /* Le libellé « Mot de passe » est séparé du champ (le bouton œil doit être dans le champ) */
  label[for="mdp"] { margin-bottom: -0.85rem; }

  /* Champ mot de passe + bouton œil */
  .champ-mdp { position: relative; }
  .champ-mdp .champ { padding-right: 3rem; }
  .voir-mdp {
    position: absolute; top: 50%; right: 0.35rem; transform: translateY(-50%);
    width: 40px; height: 40px; padding: 0;
    display: grid; place-items: center;
    border: none; border-radius: 50%;
    background: transparent; color: var(--text-muted); cursor: pointer;
    transition: color 0.15s ease, background 0.15s ease;
  }
  .voir-mdp:hover, .voir-mdp:focus-visible { color: var(--text-main); background: rgba(0, 0, 0, 0.05); outline: none; }
  .voir-mdp svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }

  .erreur-texte {
    padding: 0.75rem 0.9rem;
    border-radius: 8px;
    background-color: var(--danger-bg);
    border: 1px solid var(--danger-border);
    color: var(--danger-text);
    font-size: 0.85rem;
    font-weight: 500;
    margin: 0;
    text-align: center;
    animation: apparaitre 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes apparaitre {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`]
})
export class LoginComponent {
  email = '';
  motDePasse = '';
  enCours = signal(false);
  erreur = signal<string | null>(null);
  /** Affiche le mot de passe en clair (bouton œil). */
  readonly mdpVisible = signal(false);

  constructor(private authService: AuthService, private router: Router) {}

  seConnecter(): void {
    this.erreur.set(null);
    this.enCours.set(true);

    this.authService.login({ email: this.email, motDePasse: this.motDePasse }).subscribe({
      next: () => {
        this.enCours.set(false);
        this.router.navigateByUrl('/admin/invites');
      },
      error: () => {
        this.enCours.set(false);
        this.erreur.set('Identifiants invalides.');
      }
    });
  }
}