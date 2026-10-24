# Spécification : planification des transports

> Statut : en revue · 2026-10-24 · Rédigée pendant la phase de conception (voir [`time-log.md`](time-log.md)).
> Sources : sujet SEFS1026, [`00-analyse-du-sujet.md`](00-analyse-du-sujet.md), maquettes [`wireframes/`](wireframes/).

## 1. Intention

Un répartiteur doit pouvoir constituer, en quelques clics et sans erreur, des ordres de transport à partir des commandes de vente à livrer : choisir des commandes, les charger dans un véhicule pour une date sans dépasser sa capacité, faire valider l'ordre par un responsable, puis le marquer parti.

Le jury évalue la justesse des règles côté API, la lisibilité du code, la qualité des tests, l'UX (clarté, gestion d'erreurs) et l'honnêteté du README, pas la quantité. Ce module doit donc être **petit, correct sous accès concurrent, et explicable ligne par ligne**.

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs**
- Les 10 règles métier vérifiées par l'API, y compris quand deux utilisateurs agissent en même temps.
- Les 9 routes du sujet, réponses en camelCase, refus avec un code HTTP adapté et un message clair.
- Les 3 écrans + sélecteur d'utilisateur, avec états chargement / vide / erreur, utilisables sur bureau, tablette et mobile.
- Tests unitaires du domaine (capacité, affectation, changements de statut), tests API par règle, un test de concurrence.
- README clair : lancement, choix, manques, temps réel (conception et implémentation séparées).

**Non-objectifs**
- Authentification réelle (l'en-tête `X-User-Id` suffit, imposé par le sujet).
- Changer le véhicule ou la date d'un ordre existant, supprimer un ordre (aucune route prévue).
- Modifier le schéma ERP (pas d'index ni de contrainte ajoutés ; voir §8.4).

**Anti-objectifs** (ce qui rendrait le rendu mauvais même s'il « marche »)
- Une règle vérifiée seulement dans le front.
- Une capacité dépassable par deux ajouts simultanés.
- Un ORM ou de la concaténation SQL (requêtes paramétrées `mssql` uniquement).
- Des noms de colonnes ERP qui fuient dans le JSON.
- Du code que l'auteur ne saurait pas expliquer.

## 3. Contraintes

| Domaine | Contrainte |
|---|---|
| API | NestJS, TypeScript, SQL Server via `mssql`, requêtes paramétrées, sans ORM |
| Front | Vue 3, TypeScript, Pinia ; librairie de composants libre → **PrimeVue 4 (Aura) + PrimeIcons + Tailwind CSS v4**, SPA Vite (pas de Nuxt) |
| Base | SQL Server 2022 du `docker-compose.yml` fourni ; schéma et noms de colonnes inchangés |
| Temps | ~4 h d'implémentation, historique Git normal, jamais réécrit (pas d'amend ni de rebase) |
| Langue | Interface FR par défaut + EN ; documentation en français ; messages de commit en anglais |

## 4. Rôles

| `X-User-Id` | Rôle | Droits |
|---|---|---|
| `diane` | `DISPATCHER` | Créer un ordre, ajouter / retirer des commandes, marquer parti |
| `eric` | `LOGISTICS_MANAGER` | Tout ce que fait `DISPATCHER` + valider |

Les deux utilisateurs sont codés en dur dans l'API (`auth/users.ts`). Le front garde sa propre liste d'affichage (nom, libellé du rôle) pour le sélecteur ; **l'API reste la seule source des permissions** via `allowedActions` (§7.3).

## 5. Modèle de données et correspondance JSON

Le repository est le **seul** endroit qui connaît les noms ERP. Chaque requête aliase explicitement ses colonnes.

| Table.colonne | JSON | Notes |
|---|---|---|
| `[Sales Order].[No_]` | `no` | |
| `[Customer No_]` / `[Customer Name]` | `customerNo` / `customerName` | |
| `[Delivery City]` | `deliveryCity` | |
| `[Total Weight (kg)]` | `totalWeightKg` | nombre, 2 décimales |
| `[Status]` 0/1/2 | `status` `TO_PLAN` / `PLANNED` / `IN_DELIVERY` | conversion dans le repository |
| `[Vehicle].[Code]` / `[Plate No_]` | `code` / `plateNo` | |
| `[Capacity (kg)]` / `[Active]` | `capacityKg` / `active` | |
| `[Transport Order].[No_]` | `no` | format `TO-0000` |
| `[Vehicle Code]` / `[Delivery Date]` | `vehicleCode` / `deliveryDate` | date en chaîne `YYYY-MM-DD` |
| `[Status]` 0/1/2 | `status` `DRAFT` / `VALIDATED` / `DEPARTED` | |
| `[Created By]` / `[Validated By]` | `createdBy` / `validatedBy` | `validatedBy` nullable |
| `[timestamp]` (rowversion) | `version` + en-tête `ETag` | hexadécimal, 16 caractères |
| `[Transport Order Line]` | `lines[]` | jointure vers `[Sales Order]` |

**Pièges de type traités dans le repository**
- `date` : sélectionnée avec `CONVERT(char(10), [Delivery Date], 23)` pour obtenir `YYYY-MM-DD` sans passer par un `Date` JS. Paramètres envoyés en `sql.Date` construits depuis la chaîne.
- `decimal(10,2)` : `mssql` le renvoie en `number` flottant. **Le domaine calcule en centièmes de kg entiers** (`Math.round(kg * 100)`), donc sans erreur d'arrondi ; l'API reconvertit en kg à la sortie.
- `rowversion` : `Buffer` de 8 octets ↔ chaîne hexadécimale ; en paramètre `sql.Binary(8)`.

## 6. Règles métier : où et comment

| # | Règle | Vérifiée dans | Refus |
|---|---|---|---|
| R1 | Création au statut Brouillon, véhicule actif, date non passée | `rules.assertCanCreate` + horloge injectable | 422 `VEHICLE_INACTIVE`, 422 `VEHICLE_UNKNOWN`, 422 `DELIVERY_DATE_IN_PAST` |
| R2 | Un seul ordre par véhicule et par date | service, sous verrou de la ligne véhicule (§8.1) | 409 `VEHICLE_ALREADY_BOOKED` |
| R3 | Seules les commandes À planifier ; une commande dans un seul ordre | `rules.assertCanAddLines` + `UPDATE … WHERE [Status] = 0` vérifié par nombre de lignes | 409 `SALES_ORDER_NOT_PLANNABLE`, 422 `SALES_ORDER_UNKNOWN`, 400 doublon dans la requête |
| R4 | Ajout de plusieurs commandes en une fois | `POST …/lines` accepte 1 à 50 numéros, tout ou rien (une transaction) | |
| R5 | Poids total ≤ capacité, toujours | `rules.assertCapacity` sur charge actuelle + ajout, calculée sous verrou | 409 `CAPACITY_EXCEEDED` (avec `capacityKg`, `currentKg`, `requestedKg`, `excessKg`) |
| R6 | Ajout → Planifiée ; retrait → À planifier | service, même transaction que l'insertion / suppression de ligne | |
| R7 | Ajout / retrait seulement en Brouillon | `rules.assertDraft` | 409 `ORDER_NOT_DRAFT` |
| R8 | Validation : LOGISTICS_MANAGER, ≥ 1 commande, puis non modifiable | garde de rôle + `rules.assertCanValidate` ; R7 couvre « non modifiable » | 403 `FORBIDDEN_ROLE`, 409 `ORDER_EMPTY`, 409 `INVALID_TRANSITION` |
| R9 | Validé → Parti ; commandes → En livraison | `rules.assertCanDepart` + service | 409 `INVALID_TRANSITION` |
| R10 | Toute action interdite : code adapté + message clair | filtre d'exception global (§7.4) | |

Le README reprendra ce tableau avec, pour chaque règle, le nom du test qui la prouve.

## 7. API

### 7.1 Conventions

- En-têtes : `X-User-Id` obligatoire sur toutes les routes (401 sinon). `If-Match: "<version>"` **obligatoire** sur toute modification d'un ordre existant (lignes, validation, départ) : absent → 428, périmé → 412. La création n'en a pas besoin (rien n'existe encore). `ETag` renvoyé sur le détail et après chaque mutation.
- Pagination : `page` (≥ 1, défaut 1), `pageSize` (1 à 100, défaut 20). Réponse `{ items, page, pageSize, total }`. Deux requêtes paramétrées (page + `COUNT(*)`) partageant le même `WHERE` ; chaque `ORDER BY` se termine par la clé primaire.
- Validation des entrées : `class-validator` + `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`).
- Swagger sur `/docs` (`@nestjs/swagger`), en bonus.
- CORS ouvert pour l'origine du front en développement (`http://localhost:5173`).

### 7.2 Routes

| Méthode | Route | Entrée | Sortie |
|---|---|---|---|
| GET | `/sales-orders/to-plan` | `city?`, `page?`, `pageSize?` | page de `SalesOrder`, tri `no` croissant |
| GET | `/sales-orders/to-plan/cities` | | `string[]` triées, villes ayant au moins une commande À planifier · **ajout** |
| GET | `/vehicles` | | `Vehicle[]` actifs, tri `code` |
| GET | `/transport-orders` | `status?` (`DRAFT`…), `deliveryDate?` (`YYYY-MM-DD`), `page?`, `pageSize?` | page de `TransportOrderSummary`, tri `deliveryDate` décroissant puis `no` décroissant |
| GET | `/transport-orders/:no` | | `TransportOrderDetail` + `ETag` |
| POST | `/transport-orders` | `{ vehicleCode, deliveryDate }` | 201 `TransportOrderDetail` + `Location` + `ETag` |
| POST | `/transport-orders/:no/lines` | `{ salesOrderNos: string[] }` (1 à 50, uniques) | 200 `TransportOrderDetail` |
| DELETE | `/transport-orders/:no/lines/:salesOrderNo` | | 200 `TransportOrderDetail` |
| POST | `/transport-orders/:no/validate` | | 200 `TransportOrderDetail` |
| POST | `/transport-orders/:no/depart` | | 200 `TransportOrderDetail` |

Les mutations renvoient le détail à jour (pas de 204) : le front n'a pas à relire l'ordre.

### 7.3 Formes JSON

```ts
type SalesOrder = { no: string; customerNo: string; customerName: string; deliveryCity: string;
                    totalWeightKg: number; status: 'TO_PLAN' | 'PLANNED' | 'IN_DELIVERY' };
type Vehicle = { code: string; plateNo: string; capacityKg: number; active: boolean };
type TransportOrderSummary = {
  no: string; version: string; status: 'DRAFT' | 'VALIDATED' | 'DEPARTED'; deliveryDate: string;
  vehicleCode: string; plateNo: string; capacityKg: number;
  lineCount: number; totalWeightKg: number; createdBy: string; validatedBy: string | null };
type TransportOrderDetail = TransportOrderSummary & {
  remainingKg: number; lines: SalesOrder[];
  allowedActions: Array<'ADD_LINES' | 'REMOVE_LINES' | 'VALIDATE' | 'DEPART'> };
```

`allowedActions` est calculé pour l'utilisateur courant par la même fonction de domaine que celle qui protège les mutations (`rules.allowedActions`). C'est un **ajout** au sujet : le front affiche les boutons d'après cette liste, sans dupliquer les règles. Un `VALIDATE` absent pour un ordre vide est expliqué dans l'écran (« Ajoutez au moins une commande »).

### 7.4 Erreurs

Toutes les erreurs suivent le format *problem details* (RFC 9457), `Content-Type: application/problem+json` :

```json
{ "type": "about:blank", "status": 409, "code": "CAPACITY_EXCEEDED",
  "title": "Capacité du véhicule dépassée",
  "detail": "TO-0003 : 2 195,50 kg demandés pour 1 500,00 kg de capacité (695,50 kg de trop).",
  "params": { "capacityKg": 1500, "currentKg": 1360, "requestedKg": 835.5, "excessKg": 695.5 } }
```

- `code` est stable : le front le traduit (FR/EN) avec `params`. `title` et `detail` sont en français, lisibles directement dans Swagger.
- Les erreurs de validation (400 `VALIDATION_FAILED`) ajoutent `errors: [{ field, message }]`.
- Le domaine lève des `DomainError(code, params)` sans connaître HTTP. Seul le filtre global associe un code à un statut.

| Statut | Signification | Codes |
|---|---|---|
| 400 | Requête mal formée | `VALIDATION_FAILED`, `DUPLICATE_SALES_ORDERS` |
| 401 | Utilisateur absent ou inconnu | `UNAUTHENTICATED` |
| 403 | Rôle insuffisant | `FORBIDDEN_ROLE` |
| 404 | Ressource du chemin introuvable | `TRANSPORT_ORDER_NOT_FOUND`, `LINE_NOT_FOUND` |
| 409 | Requête valide mais en conflit avec l'état actuel | `VEHICLE_ALREADY_BOOKED`, `SALES_ORDER_NOT_PLANNABLE`, `CAPACITY_EXCEEDED`, `ORDER_NOT_DRAFT`, `ORDER_EMPTY`, `INVALID_TRANSITION`, `CONCURRENT_UPDATE` (victime d'interblocage SQL 1205 ou délai de verrou dépassé : « réessayez ») |
| 412 | Version de l'ordre périmée | `STALE_VERSION` |
| 428 | `If-Match` absent sur une modification d'ordre | `VERSION_REQUIRED` (« Relisez l'ordre et renvoyez sa version dans If-Match ») |
| 422 | Requête incorrecte en elle-même | `VEHICLE_UNKNOWN`, `VEHICLE_INACTIVE`, `DELIVERY_DATE_IN_PAST`, `SALES_ORDER_UNKNOWN` |
| 500 | Imprévu (journalisé, message générique) | `INTERNAL_ERROR` |

Règle simple à expliquer : **422 = la demande est fausse en soi ; 409 = la demande est correcte mais heurte l'état actuel**.

## 8. Concurrence et transactions

Lectures : `READ COMMITTED` par défaut. Chaque mutation s'exécute dans **une transaction** (`mssql` `Transaction`), avec rollback garanti en cas d'erreur.

### 8.1 Création

1. Valider la date (R1) avec l'horloge (`today()` en `Africa/Douala`) **avant** d'ouvrir la transaction.
2. `SELECT … FROM [Vehicle] WITH (UPDLOCK, ROWLOCK) WHERE [Code] = @code` : inconnu → 422, inactif → 422. Le verrou sérialise les créations pour ce véhicule.
3. Existe-t-il un ordre pour (véhicule, date) ? → 409 `VEHICLE_ALREADY_BOOKED`.
4. Numéro : `SELECT MAX([No_]) FROM [Transport Order] WITH (UPDLOCK, HOLDLOCK) WHERE [No_] LIKE 'TO-[0-9][0-9][0-9][0-9]'` → `rules.nextTransportOrderNo` (`TO-0004` → `TO-0005`, aucun → `TO-0001`).
5. `INSERT` (statut 0, `Created By` = utilisateur), commit, relecture du détail.

Les verrous sont toujours pris dans le même ordre (véhicule puis numéro), ce qui évite les interblocages entre créations.

### 8.2 Mutations d'un ordre existant (ajout, retrait, validation, départ)

Première instruction de la transaction, qui sert à la fois de **verrou** et de **contrôle de version** :

```sql
UPDATE [Transport Order] SET [Status] = [Status]
WHERE [No_] = @no AND [timestamp] = @version;
```

(`@version` vient de `If-Match`, contrôlé avant la transaction : absent → 428.)

- 0 ligne → relire : l'ordre n'existe pas (404) ou la version est périmée (412).
- 1 ligne → verrou exclusif sur l'en-tête jusqu'au commit, et `rowversion` incrémentée : tout écran qui affichait l'ancienne version recevra 412 à sa prochaine action.

Puis, selon l'action :
- **Ajout** : contrôle de statut (R7) ; charge actuelle = `SUM` des lignes ; commandes demandées lues `WITH (UPDLOCK)` → inconnues 422, pas À planifier 409 ; `rules.assertCapacity` (R5) ; `UPDATE [Sales Order] SET [Status] = 1 WHERE [No_] IN (…) AND [Status] = 0` et nombre de lignes modifiées = nombre demandé, sinon 409 (R3, défense en profondeur) ; `INSERT` des lignes.
- **Retrait** : contrôle de statut ; ligne absente → 404 `LINE_NOT_FOUND` ; `DELETE` de la ligne ; commande remise à 0.
- **Validation** : garde de rôle avant la transaction (403) ; Brouillon et ≥ 1 ligne (R8) ; `Status = 1`, `Validated By` = utilisateur.
- **Départ** : statut Validé (R9) ; `Status = 2` ; commandes de l'ordre passées à 2.

Les listes de numéros sont passées en paramètres individuels (`@so0, @so1…`) : jamais de concaténation de valeurs.

### 8.3 Pourquoi pas seulement des contrôles dans le code

Vérifier puis écrire sans verrou laisse passer deux ajouts simultanés qui tiennent chacun dans la capacité mais pas ensemble. Le verrou d'en-tête met les mutations d'un même ordre en file ; la mise à jour conditionnelle des commandes (`WHERE [Status] = 0`) empêche qu'une commande entre dans deux ordres différents en même temps. Un test e2e le démontre (§10).

### 8.4 Ce qu'on ferait avec le droit de modifier le schéma

Index uniques sur `[Transport Order]([Vehicle Code], [Delivery Date])` et `[Transport Order Line]([Sales Order No_])`, une séquence pour les numéros (équivalent d'une « souche de numéros » ERP), des clés étrangères. Ce sera noté dans le README et dans un ADR.

## 9. Front

### 9.1 Stack et organisation

Vite + Vue 3 + TypeScript (`create-vue`), Vue Router, Pinia, PrimeVue 4 (preset Aura avec primaire teal via `definePreset`), PrimeIcons, Tailwind v4 (`@tailwindcss/vite`) + `tailwindcss-primeui`, ordre des couches CSS déclaré (`cssLayer`) pour que Tailwind puisse surcharger PrimeVue, `vue-i18n` (FR défaut, EN), polices IBM Plex Sans / Mono auto-hébergées via `@fontsource` (pas de CDN), Vitest + Vue Test Utils.

```
web/src/
  api/          http.ts (fetch + X-User-Id + If-Match + erreurs problem+json), salesOrders.ts, transportOrders.ts, vehicles.ts, types.ts
  stores/       user.ts (utilisateur courant, persistant), salesOrders.ts, transportOrders.ts
  composables/  useBreakpoint.ts
  components/   layout/ (AppHeader, UserSwitcher, LangSwitch, BottomNav)
                ui/ (PlateChip, StatusTag, LoadBar, LifecycleStepper, AsyncState)
                planning/ (AddToTransportDialog, DraftOrderOption, VehiclePicker, SalesOrderCards)
  views/        SalesOrdersView, TransportOrdersView, TransportOrderDetailView
  i18n/         fr.ts, en.ts (dont un message par code d'erreur API)
  utils/        dates.ts (toIsoDate local, format jj/mm/aaaa), weights.ts (format kg FR/EN)
```

Les types de `api/types.ts` sont écrits à la main d'après §7.3 (six types). Les générer depuis Swagger irait dans « avec plus de temps ».

### 9.2 Écrans (maquettes : [`wireframes/01-ecrans-bureau.html`](wireframes/01-ecrans-bureau.html))

- **En-tête** : logo, navigation, bascule FR/EN, sélecteur d'utilisateur (avatar, nom, rôle). Le choix est conservé dans `localStorage` ; changer d'utilisateur recharge l'écran courant (les `allowedActions` changent).
- **Commandes à planifier** (`/sales-orders`) : filtre ville (liste de `/to-plan/cities`), tableau paginé côté serveur, sélection multiple **conservée entre les pages**, barre de sélection fixe (nombre, poids total, « Ajouter à un transport »). Un changement de filtre revient à la page 1 et vide la sélection.
- **Dialogue « Ajouter à un transport »** (flux A retenu) : à gauche les ordres Brouillon (`GET /transport-orders?status=DRAFT`), chacun avec sa jauge projetée ; un ordre où la sélection ne tient pas est grisé avec l'excédent affiché. À droite « Nouvel ordre » : date d'abord (aujourd'hui minimum), puis véhicules actifs, ceux déjà pris ce jour-là (`GET /transport-orders?deliveryDate=…`) ou trop petits pour la sélection grisés avec la raison ; « Créer et ajouter » enchaîne `POST /transport-orders` puis `POST …/lines`. Si la création réussit mais l'ajout échoue, on reste dans le dialogue sur l'ordre créé avec le message d'erreur (l'ordre vide existe ; c'est dit à l'utilisateur). Un refus de l'API s'affiche dans le dialogue sans perdre la sélection. Succès : toast + lien vers l'ordre, liste rechargée, sélection vidée. Le dialogue envoie `If-Match` avec la `version` reçue dans la liste. Si l'ordre a changé depuis (412), il recharge les ordres brouillon, redessine les jauges et l'explique (« TO-0004 a été modifié entre-temps ; jauges mises à jour »), sans perdre la sélection.
- **Ordres de transport** (`/transport-orders`) : filtre statut (segmenté), filtre date, tableau paginé avec mini-jauge, clic sur une ligne → détail. Bouton « + Nouvel ordre » : même sélecteur date + véhicule, crée un ordre vide et ouvre son détail.
- **Détail** (`/transport-orders/:no`) : numéro, statut, étapes Brouillon → Validé → Parti (avec auteurs), jauge segmentée (un segment par commande, ambre au-delà de 85 %), véhicule (plaque), date, créé / validé par, lignes avec « Retirer » (Brouillon). Bloc Actions d'après `allowedActions` ; quand une action attendue manque, un texte explique pourquoi (validation réservée au responsable, ordre vide). « + Ajouter des commandes » ouvre `/sales-orders?target=TO-xxxx`, et le dialogue présélectionne cet ordre. Retirer, Valider et Marquer parti demandent une confirmation (`ConfirmDialog`) qui rappelle ce qui va se passer (« SO-1006 repassera À planifier », « l'ordre ne sera plus modifiable », « les 2 commandes passeront En livraison »), pour éviter toute action involontaire.
- **États** sur chaque écran : squelettes pendant le chargement, état vide avec action (« Toutes les villes »), erreur de chargement avec « Réessayer », refus métier traduit depuis `code`, et 412 → « Ordre modifié entre-temps · Recharger ».

### 9.3 Responsive (maquettes : [`wireframes/02-responsive.html`](wireframes/02-responsive.html))

| Élément | Mobile < 640 px | Tablette 640–1023 px | Bureau ≥ 1024 px |
|---|---|---|---|
| Navigation | Barre d'onglets en bas ; avatar → menu (utilisateur, langue) | Dans l'en-tête, sélecteur réduit | Complète |
| Commandes | Cartes cochables, barre de sélection au-dessus des onglets | Tableau 3 colonnes (ville sous le client) | Tableau complet |
| Dialogue | Plein écran, bascule « Ordre existant / Nouvel ordre », action collée en bas | 90 % de largeur, colonnes empilées | Deux colonnes |
| Ordres | Cartes ; statut en puces ; date dans « Filtres » | Tableau sans « Créé par » ni « Cmd. » | Tableau complet |
| Détail | Une colonne, étapes en points, lignes en cartes, actions collées en bas | Une colonne | Deux colonnes |

Cibles tactiles ≥ 44 px sur mobile. `useBreakpoint()` (sur `matchMedia`) choisit entre tableau et cartes : un seul des deux est monté. Aucun défilement horizontal de la page à 360 px.

### 9.4 Direction visuelle

« Poste de répartition » : en-tête encre `#0f1b2d`, primaire teal `#0f766e`, projection `#14b8a6`, alerte ambre `#d97706` (> 85 %), dépassement rouge `#ef4444`, fond `#f3f5f8`. IBM Plex Sans pour le texte, IBM Plex Mono (chiffres tabulaires) pour numéros, poids et dates. Signatures : plaque d'immatriculation (bande vert-rouge-jaune), jauge segmentée, étapes du cycle de vie. Statuts : Brouillon ardoise, Validé bleu, Parti vert.

## 10. Tests

| Niveau | Outil | Contenu | Priorité |
|---|---|---|---|
| Unitaires domaine | Jest | Capacité (limite exacte acceptée, +0,01 kg refusé, centièmes exacts), affectation (statut ≠ À planifier, doublons), transitions (tableau de tous les couples statut × action), rôle pour valider, date passée avec horloge figée, numérotation, `allowedActions` | **Obligatoire** |
| API e2e | Jest + supertest, base Docker réelle | Pour chaque règle : un cas accepté et un refus avec son code et son statut HTTP ; camelCase des réponses ; 428 sans `If-Match`, 412 sur version périmée | Haute |
| Concurrence | idem | Deux ajouts simultanés qui tiennent chacun seuls mais pas ensemble → un 200 et un 409, charge finale ≤ capacité | Haute |
| Composants | Vitest + Vue Test Utils | `LoadBar` (seuils), options du dialogue (ordre qui ne tient pas désactivé), boutons d'après `allowedActions`, `toIsoDate` | Bonus |

Les tests e2e réinitialisent la base avec `init.sql` avant la suite (script npm), les dates du jeu de données étant relatives au jour d'exécution.

## 11. Documentation à produire avant l'implémentation

- **ADR** (courts, `docs/adr/`) : SQL paramétré et couche de mapping ; concurrence (verrou d'en-tête + version) ; format d'erreur et codes HTTP ; domaine pur en centièmes de kg ; dates et horloge ; PrimeVue + Tailwind ; `allowedActions`.
- **Diagrammes Mermaid** (`docs/diagrams.md`, rendus par GitHub) : états d'un ordre de transport et d'une commande ; séquence de l'ajout de commandes avec les verrous ; ERD des 4 tables ; diagramme de classes (domaine et modules). Les diagrammes de cas d'utilisation et d'activité ne sont pas retenus : deux acteurs déjà décrits par le tableau des rôles, et le cycle de vie est mieux montré par un diagramme d'états.
- **Présentation** (`docs/presentation/`) : 2 à 3 diagrammes interactifs générés avec archify depuis les sources Mermaid (cycle de vie, séquence d'ajout, architecture) pour les 5 minutes d'entretien.
- **Plan d'implémentation** (`docs/02-plan.md`).

## 12. Dépôt, commits et README

```
/                docker-compose.yml, init.sql (fournis, inchangés), README.md
/api             NestJS
/web             Vite + Vue
/docs            analyse, spécification, plan, ADR, diagrammes, maquettes, journal de temps
```

- Outillage : npm, Node 24 LTS (`engines` dans chaque `package.json`), NestJS 11, Vue 3.5, PrimeVue 4, Tailwind 4. Pas de workspaces npm : deux applications indépendantes.
- Commits conventionnels en anglais, petits, un sujet chacun ; jamais d'amend ni de rebase.
- `api/.env.example` et `web/.env.example` commités ; `.env` ignorés.
- README : lancement (base, API, front, tests), choix techniques et pourquoi, table de traçabilité des règles, ajouts au sujet (`/cities`, `allowedActions`), ce qui manque, temps réel par phase.

## 13. Priorités si le temps manque

1. **Indispensable** : domaine + tests unitaires ; 9 routes avec transactions et erreurs ; 3 écrans + sélecteur + états ; README.
2. **Important** : tests e2e par règle et test de concurrence ; responsive mobile ; i18n EN complète.
3. **Bonus** : Swagger, tests de composants, diagrammes archify.

Tout ce qui n'est pas fait est listé dans le README avec la façon dont on l'aurait fait.

## 14. Laissé à l'implémentation

Noms de fichiers internes aux modules, libellés exacts des toasts et des textes d'aide, classes Tailwind, taille de page par défaut côté front (10), formulation des messages d'erreur EN.

## 15. Arbitrages de conception à relire

Choix faits pendant la conception sans décision explicite du porteur ; chacun est réversible avant l'implémentation.

1. Deux ajouts au sujet : `GET /sales-orders/to-plan/cities` et `allowedActions` dans le détail.
2. ~~`If-Match` facultatif~~ → décidé : obligatoire sur toute modification d'un ordre existant (428 si absent). Le verrou protège les données ; la version protège la décision de l'utilisateur (on ne valide pas un contenu qu'on n'a pas vu).
3. 422 pour une demande fausse en soi, 409 pour un conflit avec l'état ; 404 réservé aux ressources du chemin.
4. Messages `title` / `detail` de l'API en français ; traduction FR/EN côté front par `code`.
5. Mutations renvoyant le détail complet (200) plutôt que 204.
6. Domaine en centièmes de kg entiers.
7. Création par l'onglet « Nouvel ordre » en deux appels (création puis ajout), sans route combinée.
8. ~~Retrait sans confirmation~~ → décidé : retrait, validation et départ avec confirmation.
9. Types du front écrits à la main.
10. Victime d'interblocage SQL (1205) ou délai de verrou dépassé → 409 `CONCURRENT_UPDATE`, l'utilisateur est invité à réessayer.
