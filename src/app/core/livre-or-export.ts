/**
 * Exports du livre d'or, générés dans le navigateur de l'admin (aucun serveur) :
 *  - exporterLivrePdf()   : « beau livre » A5 à imprimer (couverture, messages, page de remerciement)
 *  - exporterVideoLivre() : vidéo verticale 1080×1920 où les pages se tournent une à une
 *
 * Dépendances : npm i jspdf@4.2.1 mediabunny@1.61.2 (chargées seulement au moment de l'export).
 */

export interface MessageExport {
  auteur: string;
  message: string;
  date?: string | null;
}

export interface ThemeExport {
  primaire: string;
  secondaire: string;
  tertiaire: string;
  fond: string;
  texte: string;
  nomsCouple: string;
  monogramme: string;
  dateMariage?: string | null;
  /** Aquarelles du thème (facultatives) : celles du billet. */
  aquarelles?: { hautGauche?: string; basDroite?: string };
  /** Musique de fond de la vidéo (la même que l'invitation). Facultative : sans elle, vidéo muette. */
  musique?: string;
}

const S = "'Pinyon Script', 'Great Vibes', cursive";
const A = "'Cormorant Garamond', Georgia, serif";
const T = 'Montserrat, system-ui, sans-serif';

/* ═══════════════════════════════════════════════════════════════════
   1. LIVRE PDF (A5, ~213 dpi)
   ═══════════════════════════════════════════════════════════════════ */

const PDF_L = 1240;
const PDF_H = 1748;

export async function exporterLivrePdf(
  messages: MessageExport[], theme: ThemeExport, progression?: (p: number) => void,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  await policesPretes();
  const decor = await chargerDecor(theme);

  const canvas = creerCanvas(PDF_L, PDF_H);
  const ctx = canvas.getContext('2d')!;
  const pdf = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait', compress: true });
  const ajouterPage = (premiere = false) => {
    if (!premiere) pdf.addPage('a5', 'portrait');
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 148, 210, undefined, 'FAST');
  };

  // Couverture
  dessinerCouverture(ctx, PDF_L, PDF_H, theme, decor);
  ajouterPage(true);

  // Pages de messages : on remplit chaque page comme un vrai livre
  const pages = paginer(ctx, messages, theme);
  pages.forEach((page, i) => {
    dessinerPapier(ctx, PDF_L, PDF_H, theme);
    dessinerEnTetePage(ctx, PDF_L, theme);
    let y = MARGE_HAUT;
    for (const bloc of page) {
      dessinerMessage(ctx, bloc, MARGE_X, y, PDF_L - 2 * MARGE_X, theme, true);
      y += bloc.hauteur + ESPACE_MESSAGES;
    }
    dessinerNumero(ctx, PDF_L, PDF_H, i + 1, theme);
    ajouterPage();
    progression?.(Math.round(((i + 1) / (pages.length + 1)) * 100));
  });

  // Remerciement
  dessinerFin(ctx, PDF_L, PDF_H, theme, decor, messages.length);
  ajouterPage();
  progression?.(100);

  return pdf.output('blob');
}

const MARGE_X = 150;
const MARGE_HAUT = 210;
const MARGE_BAS = 190;
const ESPACE_MESSAGES = 70;

/** Un message mis en forme, prêt à dessiner (éventuellement découpé sur plusieurs pages). */
interface Bloc {
  lignes: string[];
  auteur: string | null;      // null : suite d'un message, la signature est sur la page suivante
  taille: number;
  hauteur: number;
  suite: boolean;
}

function paginer(ctx: CanvasRenderingContext2D, messages: MessageExport[], theme: ThemeExport): Bloc[][] {
  const largeur = PDF_L - 2 * MARGE_X;
  const hauteurUtile = PDF_H - MARGE_HAUT - MARGE_BAS;
  const pages: Bloc[][] = [];
  let page: Bloc[] = [];
  let reste = hauteurUtile;

  const nouvellePage = () => { if (page.length) pages.push(page); page = []; reste = hauteurUtile; };

  for (const m of messages) {
    const taille = 40;
    ctx.font = `italic 500 ${taille}px ${A}`;
    let lignes = envelopper(ctx, m.message, largeur - 40);
    const signature = 100;
    const lh = taille * 1.45;
    const entete = 64; // guillemet

    let hauteur = entete + lignes.length * lh + signature;
    if (hauteur > reste && page.length) nouvellePage();

    // Message plus long qu'une page entière : on le coupe proprement en plusieurs pages
    while (entete + lignes.length * lh + signature > reste) {
      const n = Math.max(1, Math.floor((reste - entete - 40) / lh));
      const morceau = lignes.slice(0, n);
      lignes = lignes.slice(n);
      page.push({ lignes: morceau, auteur: null, taille, hauteur: entete + morceau.length * lh + 40, suite: true });
      nouvellePage();
    }
    hauteur = entete + lignes.length * lh + signature;
    page.push({ lignes, auteur: m.auteur, taille, hauteur, suite: false });
    reste -= hauteur + ESPACE_MESSAGES;
  }
  nouvellePage();
  return pages;
}

function dessinerMessage(ctx: CanvasRenderingContext2D, b: Bloc, x: number, y: number, largeur: number, theme: ThemeExport, filet: boolean): void {
  const lh = b.taille * 1.45;
  // guillemet
  ctx.fillStyle = alpha(theme.tertiaire, .85);
  ctx.font = `500 110px ${A}`;
  ctx.textAlign = 'left';
  ctx.fillText('“', x - 8, y + 70);

  ctx.fillStyle = theme.texte;
  ctx.font = `italic 500 ${b.taille}px ${A}`;
  let yy = y + 64 + b.taille;
  for (const l of b.lignes) { ctx.fillText(l, x + 20, yy); yy += lh; }

  if (b.auteur !== null) {
    ctx.textAlign = 'right';
    ctx.fillStyle = theme.secondaire;
    ctx.font = `400 58px ${S}`;
    ctx.fillText(raccourcir(ctx, b.auteur, largeur * .8), x + largeur, yy + 26);
    ctx.textAlign = 'left';
    if (filet) {
      ctx.strokeStyle = alpha(theme.tertiaire, .55);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + largeur * .35, yy + 62); ctx.lineTo(x + largeur * .65, yy + 62);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = alpha(theme.texte, .55);
    ctx.font = `italic 400 30px ${A}`;
    ctx.textAlign = 'right';
    ctx.fillText('(suite page suivante)', x + largeur, yy + 4);
    ctx.textAlign = 'left';
  }
}

function dessinerEnTetePage(ctx: CanvasRenderingContext2D, W: number, theme: ThemeExport): void {
  ctx.textAlign = 'center';
  ctx.fillStyle = alpha(theme.primaire, .8);
  ctx.font = `600 22px ${T}`;
  espace(ctx, 'LIVRE D’OR  ·  ' + theme.monogramme.toUpperCase(), W / 2, 128, 6);
  ctx.textAlign = 'left';
}

function dessinerNumero(ctx: CanvasRenderingContext2D, W: number, H: number, n: number, theme: ThemeExport): void {
  ctx.textAlign = 'center';
  ctx.fillStyle = alpha(theme.texte, .6);
  ctx.font = `italic 500 30px ${A}`;
  ctx.fillText(`— ${n} —`, W / 2, H - 110);
  ctx.textAlign = 'left';
}

/* ═══════════════════════════════════════════════════════════════════
   2. VIDÉO « LIVRE QU'ON FEUILLETTE » (1080×1920, 30 i/s)
   ═══════════════════════════════════════════════════════════════════ */

const V_L = 1080;
const V_H = 1920;
const FPS = 30;
const TOURNE = 0.9;            // durée d'un tour de page (s)
const COUVERTURE = 3.2;
const FIN = 3.5;

/** Durée d'affichage d'un message : plus il est long, plus on laisse le temps de le lire. */
export function dureeLecture(m: MessageExport): number {
  return Math.min(8, 3.2 + Math.max(0, m.message.length - 100) * 0.025);
}

/** Durée totale estimée de la vidéo (s). */
export function dureeVideo(messages: MessageExport[]): number {
  return COUVERTURE + messages.reduce((t, m) => t + dureeLecture(m) + TOURNE, 0) + TOURNE + FIN;
}

export async function exporterVideoLivre(
  messages: MessageExport[], theme: ThemeExport, progression?: (p: number) => void,
): Promise<{ blob: Blob; extension: 'mp4' | 'webm' }> {
  const mb = await import('mediabunny');
  await policesPretes();
  const decor = await chargerDecor(theme);

  // Codec : H.264/MP4 si possible (lu partout, WhatsApp compris), sinon VP9/WebM
  const codec = await mb.getFirstEncodableVideoCodec(['avc', 'vp9', 'vp8'], { width: V_L, height: V_H });
  if (!codec) throw new Error('Ce navigateur ne sait pas créer de vidéo. Essayez avec Chrome sur ordinateur.');
  const mp4 = codec === 'avc';

  // Les pages, pré-dessinées une fois (le rendu image par image ne fait que les composer)
  const pages: HTMLCanvasElement[] = [];
  const couverture = creerCanvas(LIVRE.l, LIVRE.h);
  dessinerCouverture(couverture.getContext('2d')!, LIVRE.l, LIVRE.h, theme, decor);
  pages.push(couverture);
  for (const m of messages) pages.push(pageVideo(m, theme));
  const fin = creerCanvas(LIVRE.l, LIVRE.h);
  dessinerFin(fin.getContext('2d')!, LIVRE.l, LIVRE.h, theme, decor, messages.length);
  pages.push(fin);

  // Programme : [page affichée, durée] puis un tour vers la suivante
  const tenues = [COUVERTURE, ...messages.map(dureeLecture), FIN];

  const canvas = creerCanvas(V_L, V_H);
  const ctx = canvas.getContext('2d')!;
  const output = new mb.Output({
    format: mp4 ? new mb.Mp4OutputFormat({ fastStart: 'in-memory' }) : new mb.WebMOutputFormat(),
    target: new mb.BufferTarget(),
  });
  const source = new mb.CanvasSource(canvas, { codec, bitrate: 6_000_000, keyFrameInterval: 2 });
  output.addVideoTrack(source, { frameRate: FPS });

  const total = tenues.reduce((a, b) => a + b, 0) + TOURNE * (pages.length - 1);

  // ── Musique : préparée à la durée exacte de la vidéo, avec fondus ──
  const musique = theme.musique ? await preparerMusique(theme.musique, total) : null;
  let pisteSon: InstanceType<typeof mb.AudioBufferSource> | null = null;
  if (musique) {
    const codecSon = await mb.getFirstEncodableAudioCodec(mp4 ? ['aac', 'opus'] : ['opus', 'vorbis'],
      { numberOfChannels: musique.numberOfChannels, sampleRate: musique.sampleRate });
    if (codecSon) {
      pisteSon = new mb.AudioBufferSource({ codec: codecSon, bitrate: 160_000 });
      output.addAudioTrack(pisteSon);
    }
  }
  await output.start();

  // Le son est ajouté seconde par seconde, au rythme des images (multiplexage régulier)
  let sonPose = 0;
  const avancerSon = async (jusqua: number) => {
    if (!pisteSon || !musique) return;
    while (sonPose < Math.min(jusqua, total)) {
      const fin = Math.min(sonPose + 1, total);
      await pisteSon.add(extraire(musique, sonPose, fin));
      sonPose = fin;
    }
  };

  let t = 0;
  const image = async (dessin: () => void) => {
    dessin();
    await source.add(t, 1 / FPS);
    t += 1 / FPS;
    if (t - sonPose >= 1) await avancerSon(t);
    progression?.(Math.min(99, Math.round((t / total) * 100)));
  };

  for (let i = 0; i < pages.length; i++) {
    // la page reste ouverte
    const n = Math.round(tenues[i] * FPS);
    for (let f = 0; f < n; f++) {
      // léger « souffle » pour que l'image ne soit pas figée
      const zoom = 1 + 0.012 * Math.sin((f / n) * Math.PI);
      await image(() => composer(ctx, theme, pages[i], null, 0, zoom, i === 0 ? Math.min(1, f / (FPS * .8)) : 1));
    }
    // tour de page vers la suivante
    if (i < pages.length - 1) {
      const nt = Math.round(TOURNE * FPS);
      for (let f = 1; f <= nt; f++) {
        const p = adoucir(f / nt);
        await image(() => composer(ctx, theme, pages[i], pages[i + 1], p, 1, 1));
      }
    }
  }

  await avancerSon(total);
  await output.finalize();
  progression?.(100);
  const buffer = output.target.buffer!;
  return { blob: new Blob([buffer], { type: mp4 ? 'video/mp4' : 'video/webm' }), extension: mp4 ? 'mp4' : 'webm' };
}

/** Le livre dans l'image vidéo : une page portrait posée sur un fond doux. */
const LIVRE = { l: 900, h: 1380 };
const LIVRE_X = (V_L - LIVRE.l) / 2 + 20;   // décalé à droite : la reliure est à gauche
const LIVRE_Y = (V_H - LIVRE.h) / 2;

function composer(
  ctx: CanvasRenderingContext2D, theme: ThemeExport,
  courante: HTMLCanvasElement, suivante: HTMLCanvasElement | null,
  progres: number, zoom: number, opacite: number,
): void {
  // Fond : dégradé chaud, comme une table éclairée
  const g = ctx.createRadialGradient(V_L / 2, V_H * .42, 100, V_L / 2, V_H / 2, V_H * .75);
  g.addColorStop(0, melanger(theme.fond, theme.tertiaire, .25));
  g.addColorStop(1, melanger(theme.texte, theme.primaire, .25));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, V_L, V_H);

  ctx.save();
  ctx.translate(V_L / 2, V_H / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-V_L / 2, -V_H / 2);
  ctx.globalAlpha = opacite;

  // Épaisseur du livre (pages empilées) + ombre portée
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.35)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = melanger(theme.fond, theme.tertiaire, .35);
  arrondi(ctx, LIVRE_X - 6, LIVRE_Y + 6, LIVRE.l + 14, LIVRE.h + 8, 10);
  ctx.fill();
  ctx.restore();
  for (let k = 3; k >= 1; k--) {
    ctx.fillStyle = melanger(theme.fond, theme.tertiaire, .12 * k);
    ctx.fillRect(LIVRE_X + k * 3, LIVRE_Y + k * 2, LIVRE.l, LIVRE.h);
  }

  if (!suivante || progres === 0) {
    ctx.drawImage(courante, LIVRE_X, LIVRE_Y);
  } else {
    // dessous : la page suivante, qui se découvre
    ctx.drawImage(suivante, LIVRE_X, LIVRE_Y);
    // ombre de la page qui se soulève
    const ombre = ctx.createLinearGradient(LIVRE_X, 0, LIVRE_X + LIVRE.l, 0);
    ombre.addColorStop(0, `rgba(0,0,0,${.28 * Math.sin(progres * Math.PI)})`);
    ombre.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ombre;
    ctx.fillRect(LIVRE_X, LIVRE_Y, LIVRE.l, LIVRE.h);

    // la page qui tourne autour de la reliure (à gauche) : largeur = cos(angle)
    const angle = progres * Math.PI;
    const echelle = Math.cos(angle);
    const largeur = LIVRE.l * Math.abs(echelle);
    const souleve = Math.sin(angle) * 40;  // la page se soulève un peu au milieu du geste
    ctx.save();
    if (echelle > 0) {
      ctx.drawImage(courante, LIVRE_X, LIVRE_Y - souleve * .3, largeur, LIVRE.h + souleve * .6);
      const reflet = ctx.createLinearGradient(LIVRE_X, 0, LIVRE_X + largeur, 0);
      reflet.addColorStop(0, 'rgba(255,255,255,0)');
      reflet.addColorStop(1, `rgba(0,0,0,${.22 * (1 - echelle)})`);
      ctx.fillStyle = reflet;
      ctx.fillRect(LIVRE_X, LIVRE_Y - souleve * .3, largeur, LIVRE.h + souleve * .6);
    } else {
      // dos de la page (papier), qui passe de l'autre côté de la reliure et s'efface doucement
      const x = LIVRE_X - largeur;
      ctx.globalAlpha = opacite * (1 + echelle);
      ctx.fillStyle = melanger(theme.fond, theme.tertiaire, .18);
      ctx.fillRect(x, LIVRE_Y - souleve * .3, largeur, LIVRE.h + souleve * .6);
      const reflet = ctx.createLinearGradient(x, 0, LIVRE_X, 0);
      reflet.addColorStop(0, `rgba(0,0,0,${.18 * -echelle})`);
      reflet.addColorStop(1, 'rgba(0,0,0,.05)');
      ctx.fillStyle = reflet;
      ctx.fillRect(x, LIVRE_Y - souleve * .3, largeur, LIVRE.h + souleve * .6);
    }
    ctx.restore();
  }

  // ombre de la reliure
  const reliure = ctx.createLinearGradient(LIVRE_X, 0, LIVRE_X + 60, 0);
  reliure.addColorStop(0, 'rgba(0,0,0,.18)');
  reliure.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = reliure;
  ctx.fillRect(LIVRE_X, LIVRE_Y, 60, LIVRE.h);

  ctx.restore();
}

/** Une page de la vidéo = un message, en grand, taille de police adaptée. */
function pageVideo(m: MessageExport, theme: ThemeExport): HTMLCanvasElement {
  const c = creerCanvas(LIVRE.l, LIVRE.h);
  const ctx = c.getContext('2d')!;
  dessinerPapier(ctx, LIVRE.l, LIVRE.h, theme);
  const largeur = LIVRE.l - 2 * 110;
  const hauteurMax = LIVRE.h - 2 * 230;

  let taille = 54;
  let lignes: string[] = [];
  for (; taille >= 30; taille -= 2) {
    ctx.font = `italic 500 ${taille}px ${A}`;
    lignes = envelopper(ctx, m.message, largeur);
    if (lignes.length * taille * 1.45 <= hauteurMax) break;
  }
  // encore trop long : on coupe avec « … » (la vidéo n'est pas faite pour les romans)
  const maxLignes = Math.floor(hauteurMax / (taille * 1.45));
  if (lignes.length > maxLignes) {
    lignes = lignes.slice(0, maxLignes);
    lignes[maxLignes - 1] = lignes[maxLignes - 1].replace(/\s+\S*$/, '') + ' …';
  }

  const lh = taille * 1.45;
  const hTexte = lignes.length * lh;
  let y = (LIVRE.h - hTexte) / 2 - 40;

  ctx.textAlign = 'center';
  ctx.fillStyle = alpha(theme.tertiaire, .9);
  ctx.font = `500 150px ${A}`;
  ctx.fillText('“', LIVRE.l / 2, y - 20);

  ctx.fillStyle = theme.texte;
  ctx.font = `italic 500 ${taille}px ${A}`;
  y += taille;
  for (const l of lignes) { ctx.fillText(l, LIVRE.l / 2, y); y += lh; }

  ctx.fillStyle = theme.secondaire;
  ctx.font = `400 76px ${S}`;
  ctx.fillText(raccourcir(ctx, m.auteur, largeur), LIVRE.l / 2, y + 70);
  ctx.textAlign = 'left';

  ctx.textAlign = 'center';
  ctx.fillStyle = alpha(theme.primaire, .75);
  ctx.font = `600 20px ${T}`;
  espace(ctx, theme.monogramme.toUpperCase(), LIVRE.l / 2, LIVRE.h - 90, 6);
  ctx.textAlign = 'left';
  return c;
}

/* ═══════════════════════════════════════════════════════════════════
   PAGES COMMUNES : papier, couverture, fin
   ═══════════════════════════════════════════════════════════════════ */

function dessinerPapier(ctx: CanvasRenderingContext2D, W: number, H: number, theme: ThemeExport): void {
  ctx.fillStyle = melanger(theme.fond, '#ffffff', .35);
  ctx.fillRect(0, 0, W, H);
  // grain très léger
  let s = 9;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < (W * H) / 900; i++) {
    ctx.fillStyle = rnd() > .5 ? 'rgba(255,255,255,.35)' : alpha(theme.tertiaire, .08);
    ctx.fillRect(rnd() * W, rnd() * H, 1.6, 1.6);
  }
  // double filet doré
  const m = W * .05;
  ctx.strokeStyle = alpha(theme.tertiaire, .9);
  ctx.lineWidth = 2.5;
  ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);
  ctx.lineWidth = 1;
  ctx.strokeRect(m + 12, m + 12, W - 2 * m - 24, H - 2 * m - 24);
}

function dessinerCouverture(ctx: CanvasRenderingContext2D, W: number, H: number, theme: ThemeExport, decor: Decor): void {
  dessinerPapier(ctx, W, H, theme);
  poserDecor(ctx, decor, W, H);
  const k = W / 1240;
  ctx.textAlign = 'center';

  ctx.fillStyle = theme.secondaire;
  ctx.font = `600 ${26 * k}px ${T}`;
  espace(ctx, 'LIVRE D’OR', W / 2, H * .3, 12 * k);

  ctx.fillStyle = theme.primaire;
  ctx.font = `400 ${150 * k}px ${S}`;
  ctx.fillText(theme.monogramme, W / 2, H * .44);

  ornement(ctx, W / 2, H * .5, 160 * k, theme);

  const [a, b] = theme.nomsCouple.split(/\s+(?:&|et)\s+/i);
  ctx.fillStyle = theme.texte;
  ctx.font = `italic 500 ${62 * k}px ${A}`;
  ctx.fillText(a ?? theme.nomsCouple, W / 2, H * .58);
  if (b) {
    ctx.font = `italic 400 ${44 * k}px ${A}`;
    ctx.fillText('&', W / 2, H * .58 + 70 * k);
    ctx.font = `italic 500 ${62 * k}px ${A}`;
    ctx.fillText(b, W / 2, H * .58 + 150 * k);
  }
  if (theme.dateMariage) {
    ctx.fillStyle = alpha(theme.texte, .7);
    ctx.font = `500 ${24 * k}px ${T}`;
    espace(ctx, dateLongue(theme.dateMariage).toUpperCase(), W / 2, H * .78, 6 * k);
  }
  ctx.textAlign = 'left';
}

function dessinerFin(ctx: CanvasRenderingContext2D, W: number, H: number, theme: ThemeExport, decor: Decor, n: number): void {
  dessinerPapier(ctx, W, H, theme);
  poserDecor(ctx, decor, W, H);
  const k = W / 1240;
  ctx.textAlign = 'center';
  ctx.fillStyle = theme.secondaire;
  ctx.font = `400 ${150 * k}px ${S}`;
  ctx.fillText('Merci', W / 2, H * .45);
  ornement(ctx, W / 2, H * .5, 140 * k, theme);
  ctx.fillStyle = theme.texte;
  ctx.font = `italic 500 ${44 * k}px ${A}`;
  const texte = `${n} mot${n > 1 ? 's' : ''} d'amour, d'amitié et de bénédiction, à relire toute une vie.`;
  ctx.font = `italic 500 ${44 * k}px ${A}`;
  let y = H * .58;
  for (const l of envelopper(ctx, texte, W * .62)) { ctx.fillText(l, W / 2, y); y += 62 * k; }
  ctx.fillStyle = theme.primaire;
  ctx.font = `400 ${84 * k}px ${S}`;
  ctx.fillText(theme.monogramme, W / 2, y + 90 * k);
  ctx.textAlign = 'left';
}

function ornement(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, theme: ThemeExport): void {
  ctx.strokeStyle = alpha(theme.tertiaire, .9);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - l, y); ctx.lineTo(x - 16, y);
  ctx.moveTo(x + 16, y); ctx.lineTo(x + l, y);
  ctx.stroke();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.strokeStyle = theme.secondaire;
  ctx.strokeRect(-6, -6, 12, 12);
  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════════
   OUTILS
   ═══════════════════════════════════════════════════════════════════ */

interface Decor { haut: HTMLImageElement | null; bas: HTMLImageElement | null; }

async function chargerDecor(theme: ThemeExport): Promise<Decor> {
  const charger = (src?: string) => new Promise<HTMLImageElement | null>(res => {
    if (!src) return res(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = () => { console.warn(`[livre d'or] aquarelle introuvable : ${src}`); res(null); };
    img.src = src;
  });
  const [haut, bas] = await Promise.all([charger(theme.aquarelles?.hautGauche), charger(theme.aquarelles?.basDroite)]);
  return { haut, bas };
}

function poserDecor(ctx: CanvasRenderingContext2D, d: Decor, W: number, H: number): void {
  if (d.haut) {
    const l = W * .42;
    ctx.drawImage(d.haut, 0, 0, l, l * d.haut.height / d.haut.width);
  }
  if (d.bas) {
    const l = W * .36;
    const h = l * d.bas.height / d.bas.width;
    ctx.drawImage(d.bas, W - l, H - h, l, h);
  }
}

async function policesPretes(): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts) return;
  await Promise.race([
    Promise.all([`400 60px ${S}`, `italic 500 40px ${A}`, `500 40px ${A}`, `600 20px ${T}`, `500 20px ${T}`]
      .map(f => fonts.load(f).catch(() => null))),
    new Promise(r => setTimeout(r, 4000)),
  ]);
}

function creerCanvas(l: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = l;
  c.height = h;
  return c;
}

/** Coupe un texte en lignes qui tiennent dans `largeur` (respecte les retours à la ligne). */
function envelopper(ctx: CanvasRenderingContext2D, texte: string, largeur: number): string[] {
  const lignes: string[] = [];
  for (const paragraphe of texte.replace(/\r/g, '').split('\n')) {
    const mots = paragraphe.split(/\s+/).filter(Boolean);
    if (!mots.length) { lignes.push(''); continue; }
    let ligne = '';
    for (const mot of mots) {
      const essai = ligne ? ligne + ' ' + mot : mot;
      if (ctx.measureText(essai).width <= largeur || !ligne) ligne = essai;
      else { lignes.push(ligne); ligne = mot; }
    }
    lignes.push(ligne);
  }
  while (lignes.length && lignes[lignes.length - 1] === '') lignes.pop();
  return lignes;
}

function raccourcir(ctx: CanvasRenderingContext2D, t: string, max: number): string {
  if (ctx.measureText(t).width <= max) return t;
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

/** Texte espacé (lettres écartées), centré si textAlign = center. */
function espace(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, esp: number): void {
  const lettres = [...t];
  const l = lettres.reduce((s, c) => s + ctx.measureText(c).width, 0) + esp * (lettres.length - 1);
  const align = ctx.textAlign;
  let cx = align === 'center' ? x - l / 2 : x;
  ctx.textAlign = 'left';
  for (const c of lettres) { ctx.fillText(c, cx, y); cx += ctx.measureText(c).width + esp; }
  ctx.textAlign = align;
}

function arrondi(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function adoucir(t: number): number {
  return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function dateLongue(iso: string): string {
  const [a, m, j] = iso.slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, j).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function rgb(hex: string): number[] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}

function alpha(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function melanger(a: string, b: string, t: number): string {
  const pa = rgb(a), pb = rgb(b);
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// ═══════════════ Musique de la vidéo ═══════════════

/**
 * Charge le MP3, le met à la durée de la vidéo (boucle si la chanson est plus courte),
 * avec un fondu d'entrée (2 s) et de sortie (4 s). Renvoie null si le fichier est absent ou illisible :
 * la vidéo est alors simplement exportée sans son.
 */
async function preparerMusique(url: string, duree: number): Promise<AudioBuffer | null> {
  try {
    const rep = await fetch(url);
    if (!rep.ok) return null;
    const donnees = await rep.arrayBuffer();
    const decodeur = new OfflineAudioContext(2, 44100, 44100);
    const chanson = await decodeur.decodeAudioData(donnees);

    const taux = 48000;
    const rendu = new OfflineAudioContext(2, Math.ceil(duree * taux), taux);
    const lecteur = rendu.createBufferSource();
    lecteur.buffer = chanson;
    lecteur.loop = chanson.duration < duree;
    const volume = rendu.createGain();
    const v = 0.8;
    volume.gain.setValueAtTime(0, 0);
    volume.gain.linearRampToValueAtTime(v, Math.min(2, duree / 4));
    volume.gain.setValueAtTime(v, Math.max(0, duree - 4));
    volume.gain.linearRampToValueAtTime(0, duree);
    lecteur.connect(volume).connect(rendu.destination);
    lecteur.start(0);
    return await rendu.startRendering();
  } catch {
    return null;
  }
}

/** Copie un morceau [debut, fin[ (en secondes) d'un AudioBuffer. */
function extraire(source: AudioBuffer, debut: number, fin: number): AudioBuffer {
  const taux = source.sampleRate;
  const i0 = Math.floor(debut * taux);
  const i1 = Math.min(source.length, Math.floor(fin * taux));
  const morceau = new AudioBuffer({ numberOfChannels: source.numberOfChannels, length: Math.max(1, i1 - i0), sampleRate: taux });
  for (let c = 0; c < source.numberOfChannels; c++) {
    morceau.copyToChannel(source.getChannelData(c).subarray(i0, i1), c);
  }
  return morceau;
}
