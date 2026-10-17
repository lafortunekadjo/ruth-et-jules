import { Injectable, inject } from '@angular/core';
import { HttpBackend, HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { Observable, map, of, switchMap } from 'rxjs';

/**
 * Envoi d'une photo ou d'une vidéo par un invité, via Cloudinary :
 *   1. signature demandée à notre backend
 *   2. fichier envoyé directement à Cloudinary (avec progression)
 *   3. confirmation à notre backend, qui vérifie et enregistre le média EN_ATTENTE
 *
 * ⚠ Aligne API_BASE sur l'URL de ton PhotosPublicService (ex. `${environment.apiUrl}/api/public/mariages`).
 */
const API_BASE = '/api/public/mariages';

export type TypeEnvoi = 'image' | 'video';

interface SignatureEnvoi {
  cloudName: string;
  apiKey: string;
  typeRessource: TypeEnvoi;
  /** Champs signés à recopier tels quels (timestamp, folder, allowed_formats, signature…). */
  parametres: Record<string, string>;
}

/** Réponse de Cloudinary après l'envoi (champs utiles). */
interface ReponseCloudinary {
  public_id: string;
  version: number;
  signature: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  duration?: number;
}

@Injectable({ providedIn: 'root' })
export class PhotosEnvoiService {
  private http = inject(HttpClient);
  /** Client SANS intercepteurs : Cloudinary refuserait un en-tête Authorization ajouté par ton intercepteur. */
  private httpExterne = new HttpClient(inject(HttpBackend));

  /**
   * Le composant reçoit les événements de progression, puis un HttpResponse final
   * une fois le média enregistré chez nous.
   */
  envoyer(slug: string, fichier: Blob, nomFichier: string, auteur: string,
          type: TypeEnvoi = 'image', duree?: number): Observable<HttpEvent<unknown>> {
    const base = `${API_BASE}/${encodeURIComponent(slug)}/photos`;

    return this.http.post<SignatureEnvoi>(`${base}/signature`, {}, { params: { type } }).pipe(
      // ② envoi direct à Cloudinary
      switchMap(sig => {
        const form = new FormData();
        form.append('file', fichier, nomFichier);
        form.append('api_key', sig.apiKey);
        Object.entries(sig.parametres).forEach(([cle, valeur]) => form.append(cle, valeur));
        return this.httpExterne.post<ReponseCloudinary>(
          `https://api.cloudinary.com/v1_1/${sig.cloudName}/${sig.typeRessource}/upload`, form,
          { reportProgress: true, observe: 'events' },
        );
      }),
      // ③ une fois chez Cloudinary : on confirme à notre backend
      switchMap(ev => {
        if (ev.type !== HttpEventType.Response) return of(ev as HttpEvent<unknown>);
        const r = ev.body!;
        return this.http.post(base, {
          publicId: r.public_id,
          version: r.version,
          signature: r.signature,
          format: r.format,
          largeur: r.width,
          hauteur: r.height,
          octets: r.bytes,
          auteur: auteur.trim() || null,
          type,
          duree: type === 'video' ? (r.duration ?? duree ?? null) : null,
        }, { observe: 'response' }).pipe(map(rep => rep as HttpEvent<unknown>));
      }),
    );
  }
}
