import { inject, Injectable } from '@angular/core';
import { HttpBackend, HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { map, Observable, of, switchMap } from 'rxjs';
import { PhotoItem } from './models/admin.models';


const API_BASE = '/api/public/mariages';

interface SignatureEnvoi {
  cloudName: string;
  apiKey: string;
  timestamp: string;
  signature: string;
  folder: string;
  allowedFormats: string;
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
}

@Injectable({ providedIn: 'root' })
export class PhotosPublicService {
  constructor(private http: HttpClient) {}

  private httpExterne = new HttpClient(inject(HttpBackend));

  lister(slug: string): Observable<PhotoItem[]> {
    return this.http.get<PhotoItem[]>(`/api/public/mariages/${slug}/photos`);
  }



  ajouter(slug: string, nomUploadeur: string, url: string): Observable<PhotoItem> {
    return this.http.post<PhotoItem>(`/api/public/mariages/${slug}/photos`, { nomUploadeur, url });
  }

 envoyer(slug: string, fichier: Blob, nomFichier: string, auteur: string): Observable<HttpEvent<unknown>> {
    const base = `${API_BASE}/${encodeURIComponent(slug)}/photos`;
 
    return this.http.post<SignatureEnvoi>(`${base}/signature`, {}).pipe(
      // ② envoi direct à Cloudinary
      switchMap(sig => {
        const form = new FormData();
        form.append('file', fichier, nomFichier);
        form.append('api_key', sig.apiKey);
        form.append('timestamp', sig.timestamp);
        form.append('signature', sig.signature);
        form.append('folder', sig.folder);
        form.append('allowed_formats', sig.allowedFormats);
        return this.httpExterne.post<ReponseCloudinary>(
          `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, form,
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
        }, { observe: 'response' }).pipe(map(rep => rep as HttpEvent<unknown>));
      }),
    );
  }
}
