import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TableItem } from './models/admin.models';

@Injectable({ providedIn: 'root' })
export class TableAdminService {
  constructor(private http: HttpClient) {}

  lister(): Observable<TableItem[]> {
    return this.http.get<TableItem[]>('/api/admin/tables');
  }

  creer(nom: string, capacite: number): Observable<TableItem> {
    return this.http.post<TableItem>('/api/admin/tables', { nom, capacite });
  }

  supprimer(id: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/tables/${id}`);
  }

  /** tableId = null pour désaffecter l'invité de sa table actuelle. */
  affecter(inviteId: string, tableId: string | null): Observable<void> {

    return this.http.patch<void>(`/api/admin/tables/invites/${inviteId}`, { tableId });
  }
}
