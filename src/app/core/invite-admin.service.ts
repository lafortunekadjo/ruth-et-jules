import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreerInviteRequest, InviteAdmin } from './models/admin.models';

@Injectable({ providedIn: 'root' })
export class InviteAdminService {
  constructor(private http: HttpClient) {}

  lister(): Observable<InviteAdmin[]> {
    return this.http.get<InviteAdmin[]>('/api/admin/invites');
  }

  creer(req: CreerInviteRequest): Observable<InviteAdmin> {
    return this.http.post<InviteAdmin>('/api/admin/invites', req);
  }

  supprimer(id: string): Observable<void> {
  return this.http.delete<void>(`/admin/invites/${id}`);
}
}
