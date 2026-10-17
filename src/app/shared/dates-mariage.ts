/** Les dates arrivent en "AAAA-MM-JJ" : on les lit en heure locale pour éviter le décalage d'un jour. */
export function dateLocale(iso: string, heure?: string | null): Date {
  const [a, m, j] = iso.slice(0, 10).split('-').map(Number);
  const [h, mi] = (heure ?? '00:00').split(':').map(v => Number(v) || 0);
  return new Date(a, m - 1, j, h ?? 0, mi ?? 0);
}

export function formaterDateLongue(iso: string): string {
  return dateLocale(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function jourDuMois(iso: string): string {
  return dateLocale(iso).getDate().toString().padStart(2, '0');
}

export function moisAnnee(iso: string): string {
  return dateLocale(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/** "15:00:00" → "15h00" */
export function formaterHeure(heure: string | null | undefined): string {
  if (!heure) return '';
  const [h, m] = heure.split(':');
  return `${h}h${m ?? '00'}`;
}
