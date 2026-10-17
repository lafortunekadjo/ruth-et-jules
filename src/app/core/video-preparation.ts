/**
 * Préparation d'une vidéo AVANT l'envoi, directement sur le téléphone :
 *  - vérifie la durée (1 minute max) ;
 *  - ré-encode en MP4 720p (~2,5 Mb/s) → une vidéo d'1 min passe d'environ 100 Mo à environ 20 Mo ;
 *  - si le téléphone ne sait pas ré-encoder, envoie l'original s'il reste raisonnable.
 *
 * Utilise Mediabunny (npm i mediabunny@1.61.2), chargé seulement quand une vidéo est choisie.
 */

export const DUREE_MAX_VIDEO_S = 60;
/** Original accepté sans compression (téléphone trop ancien pour ré-encoder). */
export const POIDS_MAX_VIDEO_BRUTE = 60 * 1024 * 1024;
/** Une vidéo déjà légère et pas plus grande que 720p part telle quelle. */
const POIDS_DEJA_LEGER = 20 * 1024 * 1024;
const COTE_MAX = 1280;
const DEBIT_VIDEO = 2_500_000;
const DEBIT_AUDIO = 128_000;

export class VideoRefusee extends Error {}

export interface VideoPrete {
  blob: Blob;
  nom: string;
  duree: number;
}

export async function preparerVideo(fichier: File, progression: (p: number) => void): Promise<VideoPrete> {
  const mb = await import('mediabunny');
  const input = new mb.Input({ source: new mb.BlobSource(fichier), formats: mb.ALL_FORMATS });

  let duree: number;
  try {
    duree = await input.computeDuration();
  } catch {
    throw new VideoRefusee('Cette vidéo ne peut pas être lue.');
  }
  if (duree > DUREE_MAX_VIDEO_S + 1) {
    throw new VideoRefusee(`Vidéo trop longue (${Math.round(duree)} s) : 1 minute maximum.`);
  }

  const piste = await input.getPrimaryVideoTrack();
  if (!piste) throw new VideoRefusee('Aucune image dans ce fichier.');
  const largeur = piste.displayWidth;
  const hauteur = piste.displayHeight;
  const original = (): VideoPrete => {
    if (fichier.size > POIDS_MAX_VIDEO_BRUTE) {
      throw new VideoRefusee('Vidéo trop lourde pour ce téléphone : filmez en 1080p ou raccourcissez-la.');
    }
    return { blob: fichier, nom: fichier.name, duree };
  };

  // Déjà légère et pas plus grande que 720p : inutile de la ré-encoder.
  if (fichier.size <= POIDS_DEJA_LEGER && Math.max(largeur, hauteur) <= COTE_MAX) return original();

  // Le téléphone sait-il encoder en H.264 + AAC (ou Opus) ?
  const paysage = largeur >= hauteur;
  const cible = paysage
    ? { width: Math.min(COTE_MAX, largeur) }
    : { height: Math.min(COTE_MAX, hauteur) };
  const codecAudio = await mb.getFirstEncodableAudioCodec(['aac', 'opus']);
  const h264 = await mb.canEncodeVideo('avc', { width: Math.min(COTE_MAX, largeur), height: Math.min(COTE_MAX, hauteur) })
    .catch(() => false);
  if (!h264 || !codecAudio) return original();

  const output = new mb.Output({
    format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new mb.BufferTarget(),
  });
  const conversion = await mb.Conversion.init({
    input,
    output,
    video: { ...cible, codec: 'avc', bitrate: DEBIT_VIDEO, forceTranscode: true },
    audio: { codec: codecAudio, bitrate: DEBIT_AUDIO },
  });
  // Piste son impossible à convertir → on ne veut pas d'une vidéo muette : on garde l'original.
  if (!conversion.isValid || conversion.discardedTracks.length > 0) return original();

  conversion.onProgress = p => progression(Math.round(p * 100));
  try {
    await conversion.execute();
  } catch {
    return original();
  }

  const buffer = output.target.buffer;
  if (!buffer) return original();
  const blob = new Blob([buffer], { type: 'video/mp4' });
  // Rare : la « compression » a grossi le fichier → on garde le plus léger.
  if (blob.size >= fichier.size && fichier.size <= POIDS_MAX_VIDEO_BRUTE) return { blob: fichier, nom: fichier.name, duree };
  return { blob, nom: fichier.name.replace(/\.[^.]+$/, '') + '.mp4', duree };
}
