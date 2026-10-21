import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { WishlistItem, WishlistItemAdmin } from './models/admin.models';

@Injectable({ providedIn: 'root' })
export class WishlistAdminService {
  constructor(private http: HttpClient) {}

  lister(): Observable<WishlistItemAdmin[]> {
    return this.http.get<WishlistItemAdmin[]>('/api/admin/wishlist');
  }

  creer(item: Partial<WishlistItem>): Observable<WishlistItem> {
    return this.http.post<WishlistItem>('/api/admin/wishlist', item);
  }

  supprimer(id: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/wishlist/${id}`);
  }

  supprimerReservation(reservationId: string): Observable<void> {
  return this.http.delete<void>(`/admin/wishlist/reservations/${reservationId}`);
}

modifier(id: string, item: Partial<WishlistItemAdmin>): Observable<void> {
  return this.http.put<void>(`/admin/wishlist/${id}`, item);
}

}
