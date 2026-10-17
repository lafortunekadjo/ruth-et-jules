import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MessageLivreOr } from './models/admin.models';

@Injectable({ providedIn: 'root' })
export class LivreOrAdminService {
  constructor(private http: HttpClient) {}

  listerEnAttente(): Observable<MessageLivreOr[]> {
    return this.http.get<MessageLivreOr[]>('/api/admin/livre-or/en-attente');
  }

    listerTous(): Observable<MessageLivreOr[]> {
    return this.http.get<MessageLivreOr[]>('/api/admin/livre-or/tous');
  }

  approuver(id: string): Observable<void> {
    return this.http.post<void>(`/api/admin/livre-or/${id}/approuver`, {});
  }

  rejeter(id: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/livre-or/${id}`);
  }
}
