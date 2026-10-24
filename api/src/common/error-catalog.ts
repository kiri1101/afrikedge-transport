import { ErrorCode } from './domain-error';

type Params = Record<string, unknown>;

type CatalogEntry = {
  status: number;
  title: string;
  detail: (p: Params) => string;
};

const kgFormat = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const kg = (value: unknown) => `${kgFormat.format(Number(value))} kg`;
const s = (value: unknown): string => String(value);
const list = (value: unknown) =>
  Array.isArray(value) ? value.join(', ') : String(value);

/** One place mapping each error code to its HTTP status and French message (spec §7.4). */
export const ERROR_CATALOG: Record<ErrorCode, CatalogEntry> = {
  VALIDATION_FAILED: {
    status: 400,
    title: 'Requête invalide',
    detail: () => 'Certains champs de la requête sont invalides.',
  },
  DUPLICATE_SALES_ORDERS: {
    status: 400,
    title: 'Commandes en double',
    detail: (p) =>
      `Commandes présentes plusieurs fois dans la requête : ${list(p.salesOrderNos)}.`,
  },
  UNAUTHENTICATED: {
    status: 401,
    title: 'Utilisateur non identifié',
    detail: () =>
      "L'en-tête X-User-Id est absent ou ne correspond à aucun utilisateur (diane, eric).",
  },
  FORBIDDEN_ROLE: {
    status: 403,
    title: 'Action non autorisée pour ce rôle',
    detail: () =>
      'Seul un responsable logistique (LOGISTICS_MANAGER) peut valider un ordre de transport.',
  },
  TRANSPORT_ORDER_NOT_FOUND: {
    status: 404,
    title: 'Ordre de transport introuvable',
    detail: (p) =>
      `L'ordre de transport ${s(p.transportOrderNo)} n'existe pas.`,
  },
  LINE_NOT_FOUND: {
    status: 404,
    title: 'Commande absente de cet ordre',
    detail: (p) =>
      `La commande ${s(p.salesOrderNo)} ne fait pas partie de l'ordre ${s(p.transportOrderNo)}.`,
  },
  VEHICLE_ALREADY_BOOKED: {
    status: 409,
    title: 'Véhicule déjà planifié ce jour-là',
    detail: (p) =>
      `Le véhicule ${s(p.vehicleCode)} a déjà l'ordre ${s(p.transportOrderNo)} le ${s(p.deliveryDate)}.`,
  },
  SALES_ORDER_NOT_PLANNABLE: {
    status: 409,
    title: 'Commande non planifiable',
    detail: (p) =>
      `Ces commandes ne sont plus « À planifier » : ${list(p.salesOrderNos)}.`,
  },
  CAPACITY_EXCEEDED: {
    status: 409,
    title: 'Capacité du véhicule dépassée',
    detail: (p) =>
      `${s(p.transportOrderNo)} : ${kg(Number(p.currentKg) + Number(p.requestedKg))} demandés pour ${kg(p.capacityKg)} de capacité (${kg(p.excessKg)} de trop).`,
  },
  ORDER_NOT_DRAFT: {
    status: 409,
    title: "L'ordre n'est plus modifiable",
    detail: (p) =>
      `L'ordre ${s(p.transportOrderNo)} n'est pas au statut Brouillon : on ne peut plus ajouter ni retirer de commandes.`,
  },
  ORDER_EMPTY: {
    status: 409,
    title: 'Ordre vide',
    detail: (p) =>
      `L'ordre ${s(p.transportOrderNo)} ne contient aucune commande : ajoutez-en au moins une avant de le valider.`,
  },
  INVALID_TRANSITION: {
    status: 409,
    title: 'Changement de statut impossible',
    detail: (p) =>
      `L'ordre ${s(p.transportOrderNo)} ne peut pas passer de ${s(p.from)} à ${s(p.to)}.`,
  },
  CONCURRENT_UPDATE: {
    status: 409,
    title: 'Modification concurrente',
    detail: () =>
      'Une autre modification est en cours sur les mêmes données. Réessayez.',
  },
  STALE_VERSION: {
    status: 412,
    title: 'Ordre modifié entre-temps',
    detail: (p) =>
      `L'ordre ${s(p.transportOrderNo)} a été modifié depuis votre lecture : rechargez-le avant de continuer.`,
  },
  VERSION_REQUIRED: {
    status: 428,
    title: 'Version requise',
    detail: () =>
      "Relisez l'ordre et renvoyez sa version dans l'en-tête If-Match.",
  },
  VEHICLE_UNKNOWN: {
    status: 422,
    title: 'Véhicule inconnu',
    detail: (p) => `Le véhicule ${s(p.vehicleCode)} n'existe pas.`,
  },
  VEHICLE_INACTIVE: {
    status: 422,
    title: 'Véhicule hors service',
    detail: (p) =>
      `Le véhicule ${s(p.vehicleCode)} est hors service et ne peut pas recevoir d'ordre.`,
  },
  DELIVERY_DATE_IN_PAST: {
    status: 422,
    title: 'Date de livraison passée',
    detail: (p) =>
      `La date de livraison ${s(p.deliveryDate)} est antérieure à aujourd'hui (${s(p.today)}).`,
  },
  SALES_ORDER_UNKNOWN: {
    status: 422,
    title: 'Commande inconnue',
    detail: (p) => `Ces commandes n'existent pas : ${list(p.salesOrderNos)}.`,
  },
  INTERNAL_ERROR: {
    status: 500,
    title: 'Erreur interne',
    detail: () => 'Une erreur inattendue est survenue.',
  },
};
