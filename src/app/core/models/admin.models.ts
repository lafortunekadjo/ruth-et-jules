export type RoleUtilisateur = 'ADMIN' | 'CO_ORGANISATEUR' | 'STAFF_SCAN';
export type TypePlace = 'SOLO' | 'COUPLE';
export type StatutRsvp = 'EN_ATTENTE' | 'CONFIRME_SOLO' | 'CONFIRME_COUPLE' | 'DECLINE';
export type TypeCadeau = 'MATERIEL' | 'MONETAIRE';
export type MoyenPaiement = 'MOBILE_MONEY' | 'VIREMENT';
export type StatutMessage = 'EN_ATTENTE' | 'APPROUVE' | 'REJETE';
export type StatutPhoto = 'EN_ATTENTE' | 'APPROUVE' | 'REJETE';

export interface InviteAdmin {
  id: string;
  nom: string;
  prenom: string;
  email: string | null;
  telephone: string | null;
  typePlace: TypePlace;
  statutRsvp: StatutRsvp;
  nomConjoint: string | null;
  tableId: string | null;
  tableNom: string | null;
  cadeaux?: string[];
}

export interface CreerInviteRequest {
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  typePlace: TypePlace;
}

export interface TableItem {
  id: string;
  nom: string;
  capacite: number;
}

export interface WishlistItem {
  id: string;
  nom: string;
  description: string | null;
  prix: number | null;
  lien: string | null;
  imageUrl: string | null;
  reserve: boolean;
   type: TypeCadeau;
  quantite: number;
  nbReservations: number;
  complet: boolean;
  moyenPaiement?: MoyenPaiement | null;
  infosPaiement?: string | null;

}

export interface WishlistItemAdmin extends WishlistItem {
  reservePar: string | null;
  reservations: ReservationCadeau[];
  montantTotal: number | null;
}

export interface MessageLivreOr {
  id: string;
  auteur: string;
  message: string;
  approuve: boolean;
  dateCreation: string;
  creeLe?: string;
   statut?: StatutMessage | string; 
}
export interface PhotoItem {
  id: string;
  url: string;                       // photo : grande version · vidéo : MP4 720p à lire
  urlMiniature?: string | null;      // photo : vignette · vidéo : image d'aperçu
  urlTelechargement?: string | null; // fichier complet
  nomUploadeur?: string | null;
  statut?: StatutPhoto;
  dateUpload?: string | null;
  type?: 'IMAGE' | 'VIDEO';
  duree?: number | null;             // secondes (vidéos)
}


export interface ReservationCadeau {
  id: string;
  nom: string;
  inviteId?: string | null;
  montant?: number | null;
  creeLe: string;
}
export interface ReservationCadeauRequest {
  prenom: string;
  nom: string;
  montant?: number | null;
}

const LIBELLES_TYPE_CADEAU: Record<TypeCadeau, string> = {
  MATERIEL: 'Objet',
  MONETAIRE: 'Participation',
};

/** 'MATERIEL' → 'Objet', 'MONETAIRE' → 'Participation' */
export function libelleTypeCadeau(type: TypeCadeau | null | undefined): string {
  console.log(type
  )
  return type ? LIBELLES_TYPE_CADEAU[type] ?? type : '';
}