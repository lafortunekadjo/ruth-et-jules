import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { WishlistItem } from './models/admin.models';

/** Corps envoyé au backend pour réserver un cadeau ou participer. */
export interface ReservationCadeauRequest {
  prenom: string;
  nom: string;
  montant?: number | null;   // seulement pour une participation libre
}

@Injectable({ providedIn: 'root' })
export class WishlistPublicService {
  private http = inject(HttpClient);
  /** Chemin relatif : Vercel relaie /api vers le VPS en production ; proxy Angular en local. */
  private readonly base = '/api/public/mariages';

  lister(slug: string): Observable<WishlistItem[]> {
    return this.http.get<WishlistItem[]>(`${this.base}/${encodeURIComponent(slug)}/wishlist`);
  }

  reserver(slug: string, itemId: string, demande: ReservationCadeauRequest): Observable<void> {
    return this.http.post<void>(
      `${this.base}/${encodeURIComponent(slug)}/wishlist/${itemId}/reservations`,
      demande,
    );
  }
}
