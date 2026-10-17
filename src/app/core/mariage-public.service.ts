import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MariagePublic {
  id: string;
  nomsCouple: string;
  slug: string;
  dateMariage: string | null; // ISO (LocalDate)
  lieu: string | null;
  heureCeremonie: string | null;
  tenueSouhaitee: string | null;
  messageAccueil: string | null;
  couleurPrimaire: string | null;
  couleurSecondaire: string | null;
  couleurTertiaire: string | null;
  couleurFond: string | null;
  couleurTexte: string | null;
  police: string | null;
  imageCouvertureUrl: string | null;
  logoUrl: string | null;
  theme: string | null;
  wishlistActive: boolean;
  galeriePhotoActive: boolean;
  policeTexte : string;
}

@Injectable({ providedIn: 'root' })
export class MariagePublicService {
  constructor(private http: HttpClient) {}

  consulter(slug: string): Observable<MariagePublic> {
    return this.http.get<MariagePublic>(`/api/public/mariages/${slug}`);
  }
}
