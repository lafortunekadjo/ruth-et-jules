import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent) },

  {
    path: 'm/:slug',
    loadComponent: () => import('./features/save-the-date/save-the-date.component').then(m => m.SaveTheDateComponent)
  },
  {
    path: 'm/:slug/rsvp',
    loadComponent: () => import('./features/rsvp/rsvp.component').then(m => m.RsvpComponent)
  },
  {
    path: 'm/:slug/wishlist',
    loadComponent: () => import('./features/public-wishlist/public-wishlist.component').then(m => m.PublicWishlistComponent)
  },
  {
    path: 'm/:slug/livre-or',
    loadComponent: () => import('./features/public-livre-or/public-livre-or.component').then(m => m.PublicLivreOrComponent)
  },
  {
    path: 'm/:slug/photos',
    loadComponent: () => import('./features/public-galerie/public-galerie.component').then(m => m.PublicGalerieComponent)
  },

  {
    path: 'scan',
    canActivate: [authGuard],
    loadComponent: () => import('./features/scan/scan.component').then(m => m.ScanComponent)
  },

  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () => import('./features/admin/admin-shell.component').then(m => m.AdminShellComponent),
    children: [
      { path: '', redirectTo: 'invites', pathMatch: 'full' },
      {
        path: 'invites',
        loadComponent: () => import('./features/admin/invites/invites-list.component').then(m => m.InvitesListComponent)
      },
      {
        path: 'tables',
        loadComponent: () => import('./features/admin/tables/table-plan.component').then(m => m.TablePlanComponent)
      },
      {
        path: 'wishlist',
        loadComponent: () => import('./features/admin/wishlist/wishlist-admin.component').then(m => m.WishlistAdminComponent)
      },
      {
        path: 'livre-or',
        loadComponent: () => import('./features/admin/moderation/livre-or-admin.component').then(m => m.LivreOrAdminComponent)
      },
      {
        path: 'photos',
        loadComponent: () => import('./features/admin/moderation/photos-admin.component').then(m => m.PhotosAdminComponent)
      }
    ]
  }
];
