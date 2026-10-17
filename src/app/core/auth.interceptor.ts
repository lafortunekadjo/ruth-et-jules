import { HttpInterceptorFn } from '@angular/common/http';

/**
 * N'ajoute le JWT que sur les routes /api/admin et /api/scan : les routes
 * /api/public ne doivent jamais recevoir le token d'un compte admin
 * (par exemple si un organisateur teste le lien RSVP public depuis son propre navigateur).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('access_token');

  const cibleProtegee = req.url.includes('/api/admin') || req.url.includes('/api/scan');

  if (token && cibleProtegee) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(req);
};
