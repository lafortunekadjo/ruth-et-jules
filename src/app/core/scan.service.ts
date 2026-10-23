import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** ⚠ Préfixe avec ton environment.apiUrl si tes autres services le font. */
const API = '/api/scan';

export interface ScanResultat {
  invite: string;
  nomConjoint: string | null;
  nbEntreesScannees: number;
  nbPlaces: number;
  /** true = entrée REFUSÉE car toutes les places étaient déjà utilisées. */
  epuise: boolean;
  /** Table attribuée (null si l'invité n'est pas encore placé). */
  table: string | null;
}

/** Billet actif trouvé par la recherche par nom. */
export interface InviteRecherche {
  billetId: string;
  invite: string;
  nomConjoint: string | null;
  nbPlaces: number;
  nbEntreesScannees: number;
  table: string | null;
  telephone: string | null;
}

@Injectable({ providedIn: 'root' })
export class ScanService {
  private http = inject(HttpClient);

  scanner(contenuQr: string): Observable<ScanResultat> {
    return this.http.post<ScanResultat>(`${API}/entree`, { contenuQr });
  }

  rechercher(q: string): Observable<InviteRecherche[]> {
    return this.http.get<InviteRecherche[]>(`${API}/recherche`, { params: { q } });
  }

  /** Une entrée sur ce billet, exactement comme un scan du QR code. */
  entrerParNom(billetId: string): Observable<ScanResultat> {
    return this.http.post<ScanResultat>(`${API}/billets/${billetId}/entree`, {});
  }
}
