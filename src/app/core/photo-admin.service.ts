import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PhotoItem } from './models/admin.models';
const API = '/api/admin';

@Injectable({ providedIn: 'root' })
export class PhotoAdminService {
  constructor(private http: HttpClient) {}

  listerToutes(): Observable<PhotoItem[]> {
  return this.http.get<PhotoItem[]>(`${API}/photos`);
}

approuver(id: string): Observable<PhotoItem> {
  return this.http.post<PhotoItem>(`${API}/photos/${id}/approuver`, {});
}

/** Rejeter = statut REJETE (la photo reste visible pour les organisateurs). */
rejeter(id: string): Observable<PhotoItem> {
  return this.http.post<PhotoItem>(`${API}/photos/${id}/rejeter`, {});
}

/** Suppression définitive (base + Cloudinary). */
supprimer(id: string): Observable<void> {
  return this.http.delete<void>(`${API}/photos/${id}`);
}
}
