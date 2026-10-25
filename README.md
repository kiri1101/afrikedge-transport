# Planification des transports

Test technique **SEFS1026** (Afrikedge) : module fullstack de planification des transports, de la sélection des commandes de vente jusqu'au départ du véhicule.

- **API** : NestJS 11, TypeScript, SQL Server via `mssql` (requêtes paramétrées, sans ORM).
- **Front** : Vue 3.5, TypeScript, Pinia, PrimeVue 4 (Aura) + PrimeIcons 7, Tailwind CSS 4, SPA Vite ; français par défaut, anglais disponible.
- **Les 10 règles métier sont vérifiées par l'API**, y compris quand deux utilisateurs agissent en même temps.

## Lancer le projet

Prérequis : Docker Desktop, Node.js 24 et npm.

### 1. Base de données

```bash
docker compose up -d
docker compose ps    # attendre le statut "healthy" (environ 30 s)
docker compose exec sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Afk_Transport2026" -C -i /scripts/init.sql
```

Le script recrée la base `TransportPlanning` à chaque exécution (`npm run db:reset` dans `api/` fait la même chose).

### 2. API (http://localhost:3000, Swagger sur http://localhost:3000/docs)

```bash
cd api
cp .env.example .env
npm install
npm run start:dev
```

### 3. Front (http://localhost:5173)

```bash
cd web
cp .env.example .env
npm install
npm run dev
```

L'utilisateur se choisit dans l'en-tête (**diane**, répartition ; **eric**, responsable logistique), la langue aussi (FR / EN).

### Tests

| Où | Commande | Contenu |
|---|---|---|
| `api/` | `npm test` | 40 tests unitaires : règles métier (domaine pur), horloge, journal d'audit |
| `api/` | `npm run test:e2e` | 63 tests sur la vraie base (Docker lancé) : chaque règle, accepté et refusé, concurrence, audit |
| `web/` | `npx vitest run` | 42 tests : client HTTP, jauge, dialogue d'ajout, actions selon le rôle, stores, pagination mobile |

Les tests e2e réinitialisent la base avec `init.sql` (une fois par fichier) : ne pas les lancer pendant une démonstration.

## Ce que fait l'application

1. **Commandes à planifier** : filtre par ville, pagination, sélection conservée d'une page à l'autre, poids total de la sélection.
2. **Ajouter à un transport** : un dialogue montre chaque ordre brouillon avec sa jauge projetée (un ordre où la sélection ne tient pas est grisé avec l'excédent), ou crée un nouvel ordre (date d'abord, puis les véhicules libres ce jour-là et assez grands).
3. **Ordres de transport** : filtres par statut et par date, jauge de chargement par ordre, création d'un ordre vide.
4. **Détail d'un ordre** : jauge segmentée (un segment par commande), cycle de vie, lignes ; les boutons viennent de l'API et, quand une action manque, l'écran dit pourquoi. Retrait, validation et départ demandent une confirmation.
5. **Partout** : états chargement / vide / erreur, refus de l'API traduits (FR / EN), mise en page bureau, tablette et mobile.

## Choix techniques

Chaque décision a son ADR dans [`docs/adr/`](docs/adr/README.md) ; les plus importantes :

- **Couches de l'API** : contrôleur (HTTP) → service (transaction) → **domaine pur** (`api/src/domain/`, sans NestJS ni SQL) → repository (seul endroit qui connaît les noms ERP). Les tests unitaires obligatoires ciblent le domaine et tournent en millisecondes ([ADR-0005](docs/adr/0005-domaine-pur-centiemes-kg.md)).
- **Noms ERP confinés** : `[Total Weight (kg)] AS totalWeightKg` dans les repositories, valeurs uniquement en paramètres typés, listes en `@so0, @so1…` ([ADR-0001](docs/adr/0001-sql-parametre-et-mapping-unique.md)).
- **Concurrence** : chaque modification d'un ordre commence par `UPDATE [Transport Order] SET [Status] = [Status] WHERE [No_] = @no AND [timestamp] = @version`. Cette instruction verrouille l'en-tête jusqu'au commit et incrémente la `rowversion` ; les commandes sont réservées par `UPDATE … WHERE [Status] = 0` avec contrôle du nombre de lignes. Deux ajouts simultanés ne peuvent donc ni dépasser la capacité, ni placer une commande dans deux ordres ([ADR-0002](docs/adr/0002-verrou-ligne-en-tete.md)).
- **`If-Match` obligatoire** sur toute modification d'un ordre existant (428 s'il manque, 412 s'il est périmé) : on ne valide pas un contenu qu'on n'a pas vu ([ADR-0003](docs/adr/0003-if-match-obligatoire.md)).
- **Erreurs** au format *problem details* (RFC 9457) avec un `code` stable que le front traduit ; 422 = demande fausse en soi, 409 = conflit avec l'état actuel ([ADR-0004](docs/adr/0004-erreurs-problem-details.md)).
- **Poids en centièmes de kg entiers** dans le domaine : `decimal(10,2)` arrive en flottant JS, la limite exacte (1 500,00 kg acceptés, 1 500,01 refusés) reste juste ([ADR-0005](docs/adr/0005-domaine-pur-centiemes-kg.md)).
- **Dates en chaînes `YYYY-MM-DD`** de bout en bout et « aujourd'hui » donné par une horloge injectable réglée sur `Africa/Douala` ([ADR-0006](docs/adr/0006-dates-chaines-horloge-douala.md)).
- **`allowedActions`** : l'API dit au front quels boutons afficher, avec la même fonction que celle qui protège les routes ([ADR-0007](docs/adr/0007-allowed-actions-api.md)).
- **Journal d'audit** : requêtes, réponses, erreurs et chaque instruction SQL, corrélées par `X-Request-Id`, en JSON lines dans `api/logs/audit.log` ([ADR-0011](docs/adr/0011-journal-audit.md)).
- **Front** : PrimeVue 4, PrimeIcons 7 et `@primeuix/themes` 2, tous sous licence MIT (vérifié paquet par paquet : PrimeIcons 8 et PrimeVue 5 passent sous licence commerciale PrimeUI, d'où les versions fixées) pour les composants lourds, Tailwind pour la mise en page, composants métier faits main (jauge, plaque, étapes) ; un composable `useBreakpoint()` monte soit un tableau, soit des cartes ([ADR-0010](docs/adr/0010-primevue-tailwind-vite.md)).

### Ajouts au contrat du sujet

| Ajout | Pourquoi |
|---|---|
| `GET /sales-orders/to-plan/cities` | Alimenter le filtre par ville, absent des routes du sujet |
| `allowedActions` dans le détail | Une seule source pour les droits (rôle × statut) |
| `version` + `ETag`, `If-Match` obligatoire | Contrôle de concurrence sur la `rowversion` fournie |
| `X-Request-Id` | Corrélation du journal d'audit |

Exemple pour valider un ordre à la main (bash, avec `jq`) :

```bash
V=$(curl -s localhost:3000/transport-orders/TO-0003 -H 'X-User-Id: eric' | jq -r .version)
curl -X POST localhost:3000/transport-orders/TO-0003/validate -H 'X-User-Id: eric' -H "If-Match: \"$V\""
```

## Règles métier : où elles sont vérifiées et quels tests le prouvent

Unitaires : `api/src/domain/*.spec.ts` ; e2e : `api/test/*.e2e-spec.ts`.

| # | Règle | Vérifiée dans | Tests |
|---|---|---|---|
| R1 | Création en Brouillon, véhicule actif, date non passée | `rules.assertDeliveryDateNotPast`, `assertVehicleUsable` ; horloge `ZonedClock` | unit : *refuses a past date and accepts today*, *refuses an unknown or inactive vehicle*, *returns the Douala date, already tomorrow at 23:30 UTC* · e2e : *R1 creates a DRAFT order TO-0005…*, *R1 refuses an inactive vehicle…*, *R1 refuses yesterday…* |
| R2 | Un ordre par véhicule et par date | `rules.assertVehicleFree`, ligne véhicule verrouillée (`UPDLOCK`) | unit : *refuses a vehicle already booked that day* · e2e : *R2 refuses a second order for VH-01 tomorrow with 409* |
| R3 | Seules les commandes À planifier ; une commande dans un seul ordre | `rules.assertCanAddLines`, `findCandidates` (`UPDLOCK`), `setStatus` (compare-and-set) | unit : *refuses an order that is not TO_PLAN*, *refuses unknown numbers*, *refuses duplicates in one request* · e2e : *R3 refuses an order already planned*, *never puts one sales order in two transport orders* (concurrence) |
| R4 | Plusieurs commandes en une fois | `AddLinesDto` (1 à 50), une transaction tout-ou-rien | e2e : *R4/R6 adds three orders at once and plans them*, *R4 adds nothing when one order of the batch is refused* |
| R5 | Poids total ≤ capacité, toujours | `rules.assertCanAddLines` en centièmes, sous verrou d'en-tête | unit : *accepts a load exactly equal to capacity*, *refuses one hundredth of a kg over capacity*, *sums several orders before comparing* · e2e : *R5 accepts a load exactly equal to capacity*, *R5 refuses going over capacity with the excess*, *adds weights with cents exactly*, *lets only one of two simultaneous adds on the same order win* (concurrence) |
| R6 | Ajout → Planifiée ; retrait → À planifier | `TransportOrdersService.addLines` / `removeLine` | e2e : *R4/R6 adds three orders at once…*, *R6 removes a line and puts the order back to plan* |
| R7 | Ajout / retrait seulement en Brouillon | `rules.assertCanAddLines` / `assertCanRemoveLine` | unit : *refuses adding to a non-draft order*, *refuses removing from a non-draft order* · e2e : *R7 refuses changes to a validated order*, *R7 refuses removing from a validated order* |
| R8 | Validation : LOGISTICS_MANAGER, ≥ 1 commande, puis figé | `ActionGuard` (`can`), `rules.assertCanValidate` | unit : *lets only a logistics manager validate*, table *DRAFT with 0 lines → validate gives ORDER_EMPTY*… · e2e : *R8 forbids a dispatcher to validate with 403*, *R8 refuses validating an empty order*, *R8 validates a draft with lines*, *R8 makes a validated order read-only* |
| R9 | Validé → Parti ; commandes En livraison | `rules.assertCanDepart`, `markDeparted` + `setStatus` | unit : table *VALIDATED with 2 lines → depart gives null*… · e2e : *R9 departs a validated order and ships its orders*, *R9 refuses departing a draft or a departed order* |
| R10 | Refus : code HTTP adapté, message clair | `ProblemDetailsFilter`, `error-catalog.ts` | chaque test de refus vérifie statut **et** `code` ; *rejects a request without X-User-Id with 401 problem+json*, *requires If-Match with 428*, *refuses a stale version with 412* |

## Ce qui manque, ou ce que je ferais avec plus de temps

- **Contraintes en base** : index uniques sur (`[Vehicle Code]`, `[Delivery Date]`) et sur `[Sales Order No_]` des lignes, séquence de numérotation, clés étrangères. Je ne les ai pas ajoutées pour ne pas modifier le schéma ERP ; l'API les garantit par verrous (ADR-0002).
- **Tests de bout en bout dans le navigateur** (Playwright) : les parcours ont été vérifiés à la main dans le navigateur contre la vraie API, pas automatisés.
- **Types du front générés depuis Swagger** (`openapi-typescript`) au lieu d'être écrits à la main.
- **Authentification réelle** (OIDC / JWT) à la place de l'en-tête `X-User-Id` imposé par le sujet.
- **Pagination par curseur** pour des volumes ERP réels (ADR-0009).
- **Modifier le véhicule ou la date d'un ordre, supprimer un brouillon** : aucune route ne le prévoit dans le sujet.
- **Rotation et collecte du journal d'audit** (logrotate, Loki / ELK).
- **Images Docker pour l'API et le front**, et une CI qui lance les trois suites de tests.
- **Bonus non fait** : diagrammes interactifs (archify) pour la présentation ; les diagrammes Mermaid de [`docs/diagrams.md`](docs/diagrams.md) couvrent le besoin.
- **Points relevés par la revue finale, non corrigés** (mineurs) : la date « aujourd'hui » du front suit le fuseau du navigateur et non celui de Douala ; si l'ajout échoue juste après la création d'un ordre, le dialogue ne se repositionne pas sur l'ordre créé ; le `SET LOCK_TIMEOUT` reste sur la connexion du pool ; le journal d'audit enregistre le corps et l'utilisateur annoncé avant authentification ; les groupes de boutons radio n'ont pas de navigation aux flèches.
- **Limite connue** : les dates du jeu d'essai sont calculées par SQL Server en UTC, l'application raisonne en heure de Douala (UTC+1) ; entre minuit et 1 h, « demain » côté données et côté application diffèrent d'un jour (ADR-0006).

## Temps passé

Détail par séance dans [`docs/time-log.md`](docs/time-log.md) ; l'historique Git le confirme (les commits `docs:` de conception précèdent le premier commit de code).

| Phase | Durée |
|---|---|
| Conception (analyse, maquettes, spécification, plan, ADR, diagrammes) | 1 h 55 |
| Environnement (installation de Docker, base) | 20 min, hors développement |
| Implémentation (API, journal d'audit, front, README, revue et corrections) | 2 h 51 |
| **Total** | **4 h 46** |

La conception a été faite avant le premier commit de code, volontairement : elle est comptée et visible, pas cachée. Le total dépasse les 4 h indicatives du sujet ; la répartition ci-dessus montre où le temps est allé.

## Méthode et outils

Développé avec Claude Code (Anthropic) comme binôme, ce que le sujet autorise : conception discutée et validée étape par étape (maquettes, spécification, plan), puis implémentation tâche par tâche, test d'abord, avec une vérification dans le navigateur pour chaque écran. Les commits portent la mention `Co-Authored-By`. Les décisions prises en cours de route sont consignées (ADR, [backlog](BACKLOG.md)) et je peux expliquer chaque partie du code.

## Structure du dépôt

```
docker-compose.yml, init.sql   fournis, inchangés
api/                           NestJS : src/domain (règles), src/transport-orders, src/sales-orders, src/vehicles,
                               src/audit (journal), src/database (SQL), src/auth, src/common ; test/ (e2e)
web/                           Vue : views/, components/{layout,ui,planning}/, stores/, api/, i18n/, composables/
docs/                          analyse, spécification, plan, ADR, diagrammes, maquettes, journal de temps
BACKLOG.md                     tâches, sous-tâches et statut
```

## Documentation

- [Analyse du sujet](docs/00-analyse-du-sujet.md)
- [Spécification](docs/01-specification.md)
- [Plan d'implémentation](docs/02-plan.md) · [Backlog](BACKLOG.md)
- [Décisions d'architecture (ADR)](docs/adr/README.md)
- [Diagrammes](docs/diagrams.md) : cycles de vie, séquence d'ajout concurrent, modèle de données, classes
- Maquettes : [bureau](docs/wireframes/01-ecrans-bureau.html) · [tablette et mobile](docs/wireframes/02-responsive.html)
- [Journal de temps](docs/time-log.md)
