import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MessageLivreOr } from './models/admin.models';

@Injectable({ providedIn: 'root' })
export class LivreOrPublicService {
  constructor(private http: HttpClient) {}

  lister(slug: string): Observable<MessageLivreOr[]> {
    return this.http.get<MessageLivreOr[]>(`/api/public/mariages/${slug}/livre-or`);
  }

  deposer(slug: string, auteur: string, message: string): Observable<MessageLivreOr> {
    return this.http.post<MessageLivreOr>(`/api/public/mariages/${slug}/livre-or`, { auteur, message });
  }
}
