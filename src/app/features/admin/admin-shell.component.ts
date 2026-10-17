import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="coquille">
      <aside class="nav-laterale">
        <p class="marque">Mariage App</p>
        <nav>
          <a routerLink="/admin/invites" routerLinkActive="actif">Invités</a>
          <a routerLink="/admin/tables" routerLinkActive="actif">Plan de table</a>
          <a routerLink="/admin/wishlist" routerLinkActive="actif">Liste de mariage</a>
          <a routerLink="/admin/livre-or" routerLinkActive="actif">Livre d'or</a>
          <a routerLink="/admin/photos" routerLinkActive="actif">Galerie</a>
          <a routerLink="/scan" routerLinkActive="actif">Scan (jour J)</a>
        </nav>
        <button class="btn btn-discret deconnexion" (click)="authService.logout()">Déconnexion</button>
      </aside>

      <main>
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
  :host {
    display: block;
    min-height: 100vh;
    --sidebar-width: 260px;
    --bg-main: var(--papier, #f8fafc);
    --bg-sidebar: #ffffff;
    --border-color: var(--trait, #e2e8f0);
    --text-primary: var(--encre, #0f172a);
    --text-muted: var(--encre-douce, #64748b);
    --accent: var(--or, #d97706);
    --accent-bg: var(--argile-douce, #fef3c7);
    --hover-bg: var(--papier-creux, #f1f5f9);
  }

  .coquille {
    display: flex;
    min-height: 100vh;
    background-color: var(--bg-main);
  }

  /* Navigation Latérale */
  .nav-laterale {
    width: var(--sidebar-width);
    flex-shrink: 0;
    height: 100vh;
    position: sticky;
    top: 0;
    background-color: var(--bg-sidebar);
    border-right: 1px solid var(--border-color);
    padding: 1.75rem 1.25rem;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    z-index: 10;
  }

  .marque {
    font-family: var(--police-affichage, serif);
    font-style: italic;
    font-size: 1.35rem;
    font-weight: 700;
    color: var(--accent);
    margin: 0 0 2rem 0.5rem;
    letter-spacing: -0.01em;
  }

  nav {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    flex: 1;
  }

  nav a {
    text-decoration: none;
    color: var(--text-muted);
    font-size: 0.925rem;
    font-weight: 500;
    padding: 0.7rem 0.85rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    position: relative;
    transition: all 0.15s ease-in-out;
  }

  nav a:hover {
    color: var(--text-primary);
    background-color: var(--hover-bg);
  }

  nav a.actif {
    color: var(--accent);
    background-color: var(--accent-bg);
    font-weight: 600;
  }

  nav a.actif::before {
    content: '';
    position: absolute;
    left: 0;
    top: 20%;
    bottom: 20%;
    width: 3px;
    background-color: var(--accent);
    border-radius: 0 4px 4px 0;
  }

  /* Déconnexion */
  .deconnexion {
    width: 100%;
    margin-top: auto;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 0.65rem 0.85rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-muted);
    background: transparent;
    border: 1px solid var(--border-color);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .deconnexion:hover {
    background-color: #fef2f2;
    color: #ef4444;
    border-color: #fecaca;
  }

  /* Zone de contenu principal */
  main {
    flex: 1;
    padding: 2.5rem 3rem;
    background-color: var(--bg-main);
    min-width: 0; /* Évite les débordements des tableaux/grilles */
  }

  /* Responsive Mobile / Tablette */
  @media (max-width: 768px) {
    .coquille {
      flex-direction: column;
    }

    .nav-laterale {
      width: 100%;
      height: auto;
      position: relative;
      border-right: none;
      border-bottom: 1px solid var(--border-color);
      padding: 1rem 1.25rem;
      gap: 1rem;
    }

    .marque {
      margin: 0 0 0.5rem 0;
    }

    nav {
      flex-direction: row;
      overflow-x: auto;
      padding-bottom: 0.25rem;
      margin: 0 -0.5rem;
      padding: 0 0.5rem;
      -webkit-overflow-scrolling: touch;
    }

    nav::-webkit-scrollbar {
      display: none;
    }

    nav a {
      white-space: nowrap;
      padding: 0.5rem 0.85rem;
      font-size: 0.875rem;
    }

    nav a.actif::before {
      display: none;
    }

    .deconnexion {
      margin-top: 0;
      padding-top: 0.5rem;
      border-top: none;
      width: auto;
      align-self: flex-start;
    }

    main {
      padding: 1.5rem;
    }
  }
`]
})
export class AdminShellComponent {
  constructor(public authService: AuthService) {}
}
