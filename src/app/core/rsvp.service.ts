import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface IdentificationRequest {
  nom: string;
  prenom: string;
}

export interface IdentificationResponse {
  rsvpSessionToken: string;
  inviteId: string;
  prenom: string;
  nom: string;
  typePlace: 'SOLO' | 'COUPLE';
  statutActuel: string;
}

export interface RsvpResultResponse {
  statut: string;
  questionConjointRequise: boolean;
  billetUrl: string | null;
  codeBillet : string | null;
}

@Injectable({ providedIn: 'root' })
export class RsvpService {

  constructor(private http: HttpClient) {}

  private baseUrl(slug: string): string {
    return `/api/public/mariages/${slug}/rsvp`;
  }

  identifier(slug: string, demande: { nom?: string; prenom?: string; telephone?: string }): Observable<IdentificationResponse>{
    return this.http.post<IdentificationResponse>(`${this.baseUrl(slug)}/identifier`, demande);
  }

  confirmerPresence(slug: string, rsvpSessionToken: string, present: boolean): Observable<RsvpResultResponse> {
    return this.http.post<RsvpResultResponse>(`${this.baseUrl(slug)}/confirmer`, {
      rsvpSessionToken,
      present
    });
  }

  confirmerConjoint(
    slug: string,
    rsvpSessionToken: string,
    conjointPresent: boolean,
    nomConjoint?: string
  ): Observable<RsvpResultResponse> {
    return this.http.post<RsvpResultResponse>(`${this.baseUrl(slug)}/conjoint`, {
      rsvpSessionToken,
      conjointPresent,
      nomConjoint
    });
  }
}
