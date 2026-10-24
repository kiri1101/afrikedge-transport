# Analyse du sujet

> Rédigée pendant la phase de conception, avant toute implémentation. Les pistes ci-dessous sont des propositions ; les décisions définitives seront consignées dans des ADR.

## Le besoin

Un répartiteur regroupe des commandes de vente « À planifier » dans un ordre de transport : un véhicule, une date, sans dépasser la capacité du véhicule. L'ordre suit ensuite le cycle **Brouillon → Validé → Parti**, et le statut des commandes suit : **À planifier → Planifiée → En livraison**.

## Périmètre

| Couche | Attendu |
|---|---|
| API | 9 routes ; les 10 règles métier vérifiées côté API, quel que soit le front |
| Front | 3 écrans (commandes à planifier, liste des ordres, détail d'un ordre) et un sélecteur d'utilisateur ; états chargement, liste vide et erreur sur chaque écran |
| Tests | Obligatoire : tests unitaires sur la capacité, l'affectation des commandes et les changements de statut. Bonus : API, composants Vue |
| Bonus | Interface FR/EN, documentation Swagger |

## Rôles

| Utilisateur (`X-User-Id`) | Rôle | Peut faire |
|---|---|---|
| `diane` | DISPATCHER | Créer un ordre, ajouter ou retirer des commandes, marquer un ordre Parti |
| `eric` | LOGISTICS_MANAGER | Tout ce que fait DISPATCHER, et valider un ordre |

## Points d'attention repérés

| # | Constat | Risque | Piste |
|---|---|---|---|
| 1 | Colonne `timestamp` (rowversion) sur `[Transport Order]` | Deux utilisateurs modifient le même ordre depuis des écrans périmés | Exposer la version (ETag) ; les mutations envoient `If-Match` ; version périmée → 412 |
| 2 | Règles 3 et 5 en accès concurrent | Vérifier puis écrire crée une course : deux ajouts simultanés peuvent chacun passer le contrôle de capacité | Une transaction par mutation : verrou sur la ligne d'en-tête de l'ordre, puis réservation des commandes par `UPDATE … WHERE [Status] = 0` avec contrôle du nombre de lignes modifiées |
| 3 | Aucune contrainte d'unicité sur (véhicule, date), ni sur la commande dans `[Transport Order Line]` | La base ne protège pas les règles 2 et 3 | Contrôle transactionnel dans l'API ; documenter les index uniques qu'on ajouterait si le schéma ERP pouvait évoluer |
| 4 | Ni identity ni séquence pour `[No_]` (`TO-0005`) | Deux créations simultanées produisent le même numéro | Numéro calculé sous verrou dans la transaction de création |
| 5 | `decimal(10,2)` est renvoyé en `number` JS (flottant) | Sommes flottantes imprécises à la limite de la capacité | Sommes calculées en SQL, en décimal exact |
| 6 | `date` est renvoyée en `Date` JS à minuit UTC | Décalage d'un jour à l'affichage et dans le contrôle « date non passée » | Dates échangées au format `YYYY-MM-DD` ; « aujourd'hui » fourni par une horloge injectable, fuseau `Africa/Douala` |
| 7 | Noms de colonnes ERP (`[Total Weight (kg)]`, `[No_]`…) | Interdiction de les renommer, mais l'API répond en camelCase | Une seule couche de mapping : alias explicites (`AS totalWeightKg`) dans les requêtes |

## Questions ouvertes

- Aucune route ne liste les villes pour le filtre des commandes : liste déduite des commandes à planifier, ou saisie libre ?
- « Modifier un ordre » est lu comme ajouter ou retirer des commandes ; le changement de véhicule ou de date n'est pas prévu par les routes.
- Correspondance entre type de refus et code HTTP (400, 401, 403, 404, 409, 412, 422) : à fixer dans un ADR.
