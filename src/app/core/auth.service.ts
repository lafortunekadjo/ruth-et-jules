import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';

export interface LoginRequest {
  email: string;
  motDePasse: string;
}

export interface LoginResponse {
  accessToken: string;
  role: string;
}

const STORAGE_KEY = 'access_token';

@Injectable({ providedIn: 'root' })
export class AuthService {

  /** Signal exposant l'état de connexion pour piloter l'UI (guards, menu, etc.). */
  readonly connecte = signal<boolean>(!!localStorage.getItem(STORAGE_KEY));

  constructor(private http: HttpClient, private router: Router) {}

  login(req: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/auth/login', req).pipe(
      tap(res => {
        // Le token n'est jamais loggué ni exposé ailleurs qu'ici. localStorage est un
        // compromis pragmatique pour une SPA : à faire évoluer vers un cookie httpOnly
        // si le backend est un jour servi sur le même domaine que le front.
        localStorage.setItem(STORAGE_KEY, res.accessToken);
        this.connecte.set(true);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.connecte.set(false);
    this.router.navigateByUrl('/login');
  }

  token(): string | null {
    return localStorage.getItem(STORAGE_KEY);
  }
}
