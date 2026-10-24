# Backlog

Suivi des tâches du [plan d'implémentation](docs/02-plan.md), mis à jour à chaque commit de tâche.

Légende : ✅ terminé · 🔄 en cours · ⬜ à faire · ✂️ abandonné (raison dans le README)

## Conception

| | Tâche | Commit |
|---|---|---|
| ✅ | Analyse du sujet et des pièges du schéma | `af254b7` |
| ✅ | Maquettes bureau, tablette et mobile | `cda2acc` |
| ✅ | Spécification (validée) | `cda2acc`, `e4be614` |
| ✅ | Plan d'implémentation | `3671754` |
| ✅ | ADR et diagrammes | `1a0a652` |
| ✅ | Environnement : Docker Desktop, base SQL Server initialisée | `a1a3e79` |

## Implémentation : API

### ✅ 1. Socle API — `be1f257`
- ✅ Projet NestJS 11, configuration `.env`, scripts `db:reset` et `test:e2e`
- ✅ Accès SQL : pool `mssql`, requêtes paramétrées, transactions (`SET LOCK_TIMEOUT`, interblocage → 409)
- ✅ Garde `X-User-Id` (diane, eric), 401 sinon
- ✅ Erreurs *problem details* avec code stable, catalogue des statuts HTTP
- ✅ Horloge à Douala injectable, pagination, lecture de `If-Match`
- ✅ `GET /vehicles` (véhicules actifs, camelCase)
- ✅ Swagger sur `/docs`
- ✅ Tests : horloge (2), e2e véhicules et utilisateur (3)

### ✅ 2. Domaine pur et tests unitaires obligatoires — `3aad5dd`
- ✅ Statuts ERP ↔ chaînes, poids en centièmes de kg
- ✅ Permissions par rôle
- ✅ Règles : capacité (R5), affectation (R3, R7), transitions (R8, R9), création (R1, R2)
- ✅ `allowedActions`, numérotation `TO-0001`
- ✅ 33 tests unitaires (limite exacte de capacité, table statut × action)

### ✅ 3. Routes de lecture — `ad3703e`
- ✅ `GET /sales-orders/to-plan` (filtre ville, pagination)
- ✅ `GET /sales-orders/to-plan/cities`
- ✅ `GET /transport-orders` (filtres statut et date, pagination, charge par ordre)
- ✅ `GET /transport-orders/:no` (lignes, capacité restante, `allowedActions`, `ETag`)
- ✅ Tests e2e (17 : ville accentuée, page vide, filtre date, 404, actions par rôle)

### ✅ 4. Création d'un ordre (R1, R2) — `0e81268`
- ✅ Garde d'action par rôle (`@RequireAction`)
- ✅ `POST /transport-orders` sous verrou véhicule + numéro
- ✅ Tests e2e (7) : création, numérotation, véhicule inactif/inconnu, date passée, véhicule déjà pris, date impossible

### ✅ 5. Ajout et retrait de commandes (R3 à R7) — `62dd876`
- ✅ `If-Match` obligatoire (428 / 412), verrou d'en-tête
- ✅ `POST /transport-orders/:no/lines`, `DELETE /transport-orders/:no/lines/:salesOrderNo`
- ✅ Normalisation des numéros (majuscules, espaces)
- ✅ Tests e2e (15) par règle, centimes exacts, limite de capacité
- ✅ Tests de concurrence (2) : même ordre → 200 + 412 ; même commande dans deux ordres → 200 + 409

### ✅ 6. Validation et départ (R8, R9) — `5e2b0bb`
- ✅ `POST /transport-orders/:no/validate` (LOGISTICS_MANAGER)
- ✅ `POST /transport-orders/:no/depart` (commandes → En livraison)
- ✅ Tests e2e du cycle de vie (9), Swagger vérifié : 10 routes, `X-User-Id` et `If-Match` documentés

### ✅ 6b. Journal d'audit (demande ajoutée pendant l'implémentation) — `482560e`
- ✅ Identifiant de requête (`X-Request-Id`) propagé jusqu'aux requêtes SQL
- ✅ Requêtes HTTP : méthode, chemin, utilisateur, corps des modifications ; réponses : statut, durée ; erreurs : code
- ✅ Activité SQL : lecture / écriture, début / validation / annulation de transaction, lignes touchées, durée
- ✅ Fichier JSON lines + console, sans corps de réponse (données clients)
- ✅ Tests : unitaires (5) et e2e (5) du journal ; ADR-0011

## Implémentation : front

### ✅ 7. Socle front — `a0c80f0`
- ✅ Vite + Vue 3 + Pinia + Router, PrimeVue (Aura, teal), PrimeIcons, Tailwind 4, polices IBM Plex
- ✅ i18n FR / EN (messages par code d'erreur)
- ✅ Client HTTP (`X-User-Id`, `If-Match`, erreurs problem+json)
- ✅ En-tête : navigation, sélecteur d'utilisateur, langue ; barre d'onglets mobile
- ✅ Tests (12) : dates, poids, client HTTP ; vérifié dans le navigateur (couche PrimeVue, aucune bannière de licence, mobile sans défilement horizontal)

### ✅ 8. Composants d'interface — `39a130f`
- ✅ Plaque d'immatriculation, étiquette de statut, étapes du cycle de vie
- ✅ Jauge de chargement segmentée (projection, dépassement)
- ✅ États chargement / vide / erreur
- ✅ Tests de la jauge (4) : largeurs exactes, seuil 85 %, projection, dépassement

### ✅ 9. Écran Commandes à planifier
- ✅ Filtre ville, pagination serveur
- ✅ Sélection conservée entre les pages, barre de sélection
- ✅ Tableau (bureau, tablette) / cartes (mobile)
- ✅ Tests du store (5) ; vérifié dans le navigateur à 1280 et 375 px avec les données réelles

### 🔄 10. Dialogue « Ajouter à un transport »
- ⬜ Ordres brouillon avec jauge projetée (ceux où la sélection ne tient pas grisés)
- ⬜ Nouvel ordre : date puis véhicules disponibles
- ⬜ Gestion du 412, bouton désactivé pendant l'envoi
- ⬜ Plein écran sur mobile
- ⬜ Tests des composants

### ⬜ 11. Écran Ordres de transport
- ⬜ Filtres statut et date, pagination, mini-jauge
- ⬜ Création d'un ordre vide
- ⬜ Cartes sur mobile

### ⬜ 12. Écran Détail d'un ordre
- ⬜ Jauge, étapes, véhicule, lignes
- ⬜ Actions selon `allowedActions` avec explications
- ⬜ Confirmations (retrait, validation, départ), gestion du 412
- ⬜ Tests des actions

## Clôture

### ⬜ 13. README et vérification finale
- ⬜ Lancement, choix techniques, table de traçabilité R1 à R10
- ⬜ Ce qui manque, temps passé
- ⬜ Vérification complète depuis un clone propre

## Bonus (§13 de la spécification, si le temps le permet)

- ⬜ Diagrammes interactifs (archify) pour la présentation
