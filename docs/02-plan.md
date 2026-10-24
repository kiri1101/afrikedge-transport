# Planification des transports : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objectif :** livrer l'API NestJS et le front Vue 3 de planification des transports décrits par la spécification, avec les 10 règles métier garanties côté API, y compris en accès concurrent.

**Architecture :** API en couches (contrôleur → service transactionnel → domaine pur → repository SQL paramétré) ; le domaine calcule en centièmes de kg et ne connaît ni HTTP ni SQL. Chaque modification d'ordre verrouille d'abord la ligne d'en-tête en vérifiant sa `rowversion`. Le front est une SPA Vite (Pinia, PrimeVue, Tailwind) qui affiche les actions d'après `allowedActions` et traduit les erreurs par `code`.

**Stack :** Node 24 LTS, npm · NestJS 11, `mssql`, `class-validator`, `@nestjs/swagger`, Jest, supertest · Vue 3.5, Vue Router, Pinia, PrimeVue 4 (Aura), PrimeIcons, Tailwind CSS 4, `tailwindcss-primeui`, `vue-i18n`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`, Vitest, Vue Test Utils.

**Spécification :** [`docs/01-specification.md`](01-specification.md) (à lire avec ce plan ; les numéros § y renvoient).

## Contraintes globales

- SQL Server via `mssql`, requêtes paramétrées uniquement, sans ORM ; jamais de valeur concaténée dans le SQL (listes → `@so0, @so1…`).
- Noms de tables et colonnes ERP inchangés ; aucune modification du schéma ; le JSON est en camelCase (§5).
- `X-User-Id` obligatoire sur toutes les routes : `diane` = `DISPATCHER`, `eric` = `LOGISTICS_MANAGER` ; sinon 401 `UNAUTHENTICATED`.
- `If-Match: "<version>"` obligatoire sur toute modification d'un ordre existant : absent → 428 `VERSION_REQUIRED`, périmé → 412 `STALE_VERSION`. La création n'en a pas besoin.
- Erreurs au format `application/problem+json` `{ type, status, code, title, detail, params?, errors? }`, `title`/`detail` en français ; statuts selon le tableau §7.4.
- Dates échangées en `YYYY-MM-DD` ; « aujourd'hui » = date dans le fuseau `Africa/Douala`.
- Pagination : `page` ≥ 1 (défaut 1), `pageSize` 1 à 100 (défaut 20) ; réponse `{ items, page, pageSize, total }` ; front : 10 par page.
- Front : FR par défaut + EN ; points de rupture 640 px et 1024 px ; cibles tactiles ≥ 44 px sur mobile ; pas de défilement horizontal à 360 px ; jauge ambre au-delà de 85 %.
- Commits conventionnels en anglais, un par tâche au minimum, se terminant par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` ; jamais d'amend ni de rebase.
- Prérequis : Docker Desktop lancé, base initialisée (`docker compose up -d` puis `init.sql`) ; ADR et diagrammes du §11 produits pendant la conception.
- Si le temps manque : appliquer les priorités du §13 (indispensable → important → bonus) et lister le reste dans le README plutôt que de livrer une tâche à moitié faite.

## Points de vigilance

Cas que la spécification implique sans les nommer, chacun épinglé par un test dans la tâche indiquée :

1. **Ville accentuée dans le filtre** (`Yaoundé`, `Edéa`) : encodée dans l'URL, elle doit filtrer correctement → test e2e `city=Yaoundé` → 7 (tâche 3).
2. **Minuit à Douala** : à 23 h 30 UTC il est déjà le lendemain à Douala ; une date « aujourd'hui » choisie par l'utilisateur doit être acceptée → test unitaire de l'horloge (tâche 1).
3. **Numéro de commande en minuscules ou avec espaces** (`" so-1008"`) : la collation SQL est insensible à la casse, donc sans normalisation la ligne serait stockée en minuscules et le contrôle de doublons contourné → normalisation `trim` + majuscules, test e2e (tâche 5).
4. **Poids avec centimes** (`145,50` + `60,25`) : la somme doit être exacte → test e2e `205.75` (tâche 5).
5. **Double clic sur « Ajouter »** : le second envoi recevrait 412 ; le bouton doit être désactivé pendant l'envoi → test de composant (tâche 10).

---

## Tâche 1 : socle API, utilisateurs, erreurs, horloge, véhicules

**Fichiers :**
- Créer (CLI) : `api/` via `npx @nestjs/cli@11 new api --package-manager npm --skip-git --strict`
- Créer : `api/.env.example`, `api/src/app.setup.ts`, `api/src/database/{database.module.ts,sql.service.ts}`, `api/src/common/{domain-error.ts,error-catalog.ts,problem-details.filter.ts,clock.ts,pagination.ts,if-match.ts}`, `api/src/auth/{users.ts,user.guard.ts,current-user.decorator.ts}`, `api/src/vehicles/{vehicles.module.ts,vehicles.controller.ts,vehicles.repository.ts,vehicle.dto.ts}`
- Modifier : `api/src/main.ts`, `api/src/app.module.ts`, `api/nest-cli.json`, `api/package.json`, `api/test/jest-e2e.json`
- Tests : `api/src/common/clock.spec.ts`, `api/test/support/{app.ts,db.ts,dates.ts}`, `api/test/vehicles.e2e-spec.ts`

**Interfaces :**
- Produit :
  - `SqlService` (global) : `query<T>(text: string, params?: SqlParams): Promise<SqlResult<T>>`, `transaction<T>(work: (tx: SqlRunner) => Promise<T>): Promise<T>` ; `type SqlParams = Record<string, [type: sql.ISqlType | sql.ISqlTypeFactoryWithNoParams, value: unknown]>` ; `type SqlResult<T> = { rows: T[]; rowsAffected: number }` (somme du tableau `rowsAffected` de `mssql`) ; `interface SqlRunner { query<T>(…) }` ; `inList(prefix: string, values: string[], type): { placeholders: string; params: SqlParams }`.
  - `DomainError(code: ErrorCode, params?: Record<string, unknown>)` ; `ErrorCode` = union de tous les codes du §7.4 ; `ERROR_CATALOG: Record<ErrorCode, { status: number; title: string; detail(params): string }>`.
  - `Clock` (classe abstraite, jeton d'injection) `today(): string` ; `ZonedClock(timeZone: string, now: () => Date = () => new Date())`.
  - `PageQueryDto { page: number; pageSize: number }`, `type Page<T> = { items: T[]; page: number; pageSize: number; total: number }`, `offsetOf(q: PageQueryDto): number`.
  - `parseIfMatch(header: string | undefined): string | null` (retire `W/` et guillemets ; accepte `/^[0-9A-F]{16}$/i`, sinon `null`).
  - `type Role = 'DISPATCHER' | 'LOGISTICS_MANAGER'`, `type CurrentUser = { id: string; role: Role }`, `USERS: Record<string, CurrentUser>`, `UserGuard` (garde globale), `@CurrentUser()`.
  - `configureApp(app: INestApplication): void` : utilisée par `main.ts` **et** par les tests.
  - Supports de test : `createTestApp(): Promise<INestApplication>`, `as(app, user: 'diane' | 'eric')` → `{ get, post, delete }` supertest avec `X-User-Id`, `resetDb(): void`, `todayInDouala(): string`, `addDays(iso: string, n: number): string`.

- [ ] **Étape 1 : générer le projet et installer les dépendances**

```bash
npx @nestjs/cli@11 new api --package-manager npm --skip-git --strict
cd api && npm i mssql @nestjs/config @nestjs/swagger class-validator class-transformer && npm i -D @types/mssql
```

Ajouter `"engines": { "node": ">=24" }` et les scripts `"db:reset": "docker compose -f ../docker-compose.yml exec -T sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P \"Afk_Transport2026\" -C -i /scripts/init.sql"` et `"test:e2e": "jest --config ./test/jest-e2e.json --runInBand"`. Dans `nest-cli.json`, activer le plugin `@nestjs/swagger` (`classValidatorShim: true`). `.env.example` : `PORT=3000`, `DB_HOST=localhost`, `DB_PORT=1433`, `DB_USER=sa`, `DB_PASSWORD=Afk_Transport2026`, `DB_NAME=TransportPlanning`, `CORS_ORIGIN=http://localhost:5173`, `BUSINESS_TIMEZONE=Africa/Douala`. Copier en `.env`.

- [ ] **Étape 2 : écrire le test de l'horloge (point de vigilance 2)**

```ts
// api/src/common/clock.spec.ts
it('returns the Douala date, already tomorrow at 23:30 UTC', () => {
  const clock = new ZonedClock('Africa/Douala', () => new Date('2026-10-24T23:30:00Z'));
  expect(clock.today()).toBe('2026-10-25');
});
it('returns YYYY-MM-DD', () => {
  expect(new ZonedClock('Africa/Douala', () => new Date('2026-01-05T10:00:00Z')).today()).toBe('2026-01-05');
});
```

- [ ] **Étape 3 : `npx jest src/common/clock.spec.ts`** → échec (module absent).

- [ ] **Étape 4 : implémenter `ZonedClock`** avec `Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })`, puis relancer → PASS.

- [ ] **Étape 5 : écrire les tests e2e véhicules et utilisateur**

```ts
// api/test/vehicles.e2e-spec.ts  (beforeAll: resetDb(); app = await createTestApp())
it('lists the 9 active vehicles in camelCase', async () => {
  const res = await as(app, 'diane').get('/vehicles');
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(9);
  expect(res.body[0]).toEqual({ code: 'VH-01', plateNo: 'LT-482-AB', capacityKg: 1500, active: true });
  expect(res.body.map((v) => v.code)).not.toContain('VH-07');
});
it('rejects a request without X-User-Id with 401 problem+json', async () => {
  const res = await request(app.getHttpServer()).get('/vehicles');
  expect(res.status).toBe(401);
  expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
  expect(res.body).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
});
it('rejects an unknown user with 401', async () => {
  const res = await request(app.getHttpServer()).get('/vehicles').set('X-User-Id', 'bob');
  expect(res.body.code).toBe('UNAUTHENTICATED');
});
```

- [ ] **Étape 6 : `npm run test:e2e`** → échec.

- [ ] **Étape 7 : implémenter le socle**
  - `SqlService` : pool `mssql` ouvert à `onModuleInit` (`options: { encrypt: true, trustServerCertificate: true }`), fermé à `onModuleDestroy`. `transaction` exécute `SET LOCK_TIMEOUT 5000`, valide ou annule, et traduit les erreurs SQL 1205 et 1222 en `DomainError('CONCURRENT_UPDATE')`.
  - `ProblemDetailsFilter` (`@Catch()`) : `DomainError` → catalogue ; `HttpException` → `code: 'HTTP_ERROR'` avec son statut ; le reste → 500 `INTERNAL_ERROR` journalisé, message générique.
  - `configureApp` : `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, exceptionFactory })`, où `exceptionFactory` lève `DomainError('VALIDATION_FAILED', { errors: [{ field, message }] })` et le filtre recopie `errors` à la racine. Elle installe aussi le filtre, puis CORS avec `origin: CORS_ORIGIN` et **`exposedHeaders: ['ETag', 'Location']`** (sans quoi le navigateur ne lit pas l'ETag). Enfin Swagger sur `/docs`, avec `addApiKey({ type: 'apiKey', in: 'header', name: 'X-User-Id' }, 'user')` et l'en-tête `If-Match` documenté.
  - `UserGuard` en `APP_GUARD`. `Clock` fourni par `ZonedClock(BUSINESS_TIMEZONE)`.
  - `VehiclesRepository.findActive(): Promise<VehicleDto[]>` : `SELECT [Code] AS code, [Plate No_] AS plateNo, [Capacity (kg)] AS capacityKg, [Active] AS active FROM [Vehicle] WHERE [Active] = 1 ORDER BY [Code]` (`capacityKg` converti avec `Number`).
  - `GET /vehicles`.

- [ ] **Étape 8 : `npm test && npm run test:e2e && npm run lint`** → tout passe.

- [ ] **Étape 9 : commit** `feat(api): bootstrap NestJS with SQL access, user header guard, problem details and vehicles`

---

## Tâche 2 : domaine pur et tests unitaires (obligatoires)

**Fichiers :**
- Créer : `api/src/domain/{statuses.ts,weights.ts,permissions.ts,rules.ts,order-number.ts}`
- Tests : `api/src/domain/{weights.spec.ts,permissions.spec.ts,rules.spec.ts,order-number.spec.ts}`

**Interfaces :**
- Consomme : `DomainError`, `Role` (tâche 1).
- Produit :
  - `type SalesOrderStatus = 'TO_PLAN' | 'PLANNED' | 'IN_DELIVERY'` (0/1/2), `type TransportOrderStatus = 'DRAFT' | 'VALIDATED' | 'DEPARTED'` (0/1/2), `salesOrderStatusFromCode(n)`, `transportOrderStatusFromCode(n)`, `SALES_ORDER_STATUS_CODE`, `TRANSPORT_ORDER_STATUS_CODE`.
  - `type KgHundredths = number`, `toHundredths(kg: number): KgHundredths` (`Math.round(kg * 100)`), `toKg(h: KgHundredths): number`.
  - `type Action = 'CREATE' | 'ADD_LINES' | 'REMOVE_LINES' | 'VALIDATE' | 'DEPART'`, `can(role: Role, action: Action): boolean`.
  - `type OrderState = { no: string; status: TransportOrderStatus; capacity: KgHundredths; load: KgHundredths; lineCount: number }`, `type Candidate = { no: string; status: SalesOrderStatus; weight: KgHundredths }`.
  - `assertDeliveryDateNotPast(deliveryDate: string, today: string)`, `assertVehicleUsable(vehicle: { active: boolean } | null, vehicleCode: string)`, `assertVehicleFree(bookedOrderNo: string | null, vehicleCode: string, deliveryDate: string)`, `assertCanAddLines(order: OrderState, requestedNos: string[], found: Candidate[])`, `assertCanRemoveLine(order: OrderState, lineExists: boolean, salesOrderNo: string)`, `assertCanValidate(order: OrderState)`, `assertCanDepart(order: OrderState)`, `allowedActions(order: Pick<OrderState, 'status' | 'lineCount'>, role: Role): Exclude<Action, 'CREATE'>[]`.
  - `nextTransportOrderNo(lastNo: string | null): string`.

Ordre des contrôles de `assertCanAddLines` : statut Brouillon → doublons → numéros inconnus → statut des commandes → capacité. Paramètres d'erreur : `ORDER_NOT_DRAFT { transportOrderNo, status }`, `DUPLICATE_SALES_ORDERS { salesOrderNos }`, `SALES_ORDER_UNKNOWN { salesOrderNos }`, `SALES_ORDER_NOT_PLANNABLE { salesOrderNos }`, `CAPACITY_EXCEEDED { transportOrderNo, capacityKg, currentKg, requestedKg, excessKg }` (en kg), `INVALID_TRANSITION { transportOrderNo, from, to }`, `ORDER_EMPTY { transportOrderNo }`, `LINE_NOT_FOUND { transportOrderNo, salesOrderNo }`, `DELIVERY_DATE_IN_PAST { deliveryDate, today }`, `VEHICLE_UNKNOWN | VEHICLE_INACTIVE { vehicleCode }`, `VEHICLE_ALREADY_BOOKED { vehicleCode, deliveryDate, transportOrderNo }`.

`allowedActions` : Brouillon → `ADD_LINES`, puis `REMOVE_LINES` si `lineCount > 0`, puis `VALIDATE` si `can(role, 'VALIDATE')` et `lineCount > 0` ; Validé → `DEPART` ; Parti → `[]` (filtré par `can`).

- [ ] **Étape 1 : écrire les tests** (helper `draft = (over = {}) => ({ no: 'TO-0003', status: 'DRAFT', capacity: 150000, load: 136000, lineCount: 2, ...over })`, `expectCode(fn, code, params?)` qui vérifie `DomainError.code` et `params`)

```ts
// weights.spec.ts
expect(toHundredths(145.5)).toBe(14550); expect(toHundredths(0.1 + 0.2)).toBe(30); expect(toKg(14550)).toBe(145.5);

// permissions.spec.ts
expect(can('DISPATCHER', 'VALIDATE')).toBe(false); expect(can('LOGISTICS_MANAGER', 'VALIDATE')).toBe(true);
expect(can('DISPATCHER', 'CREATE')).toBe(true); expect(can('DISPATCHER', 'DEPART')).toBe(true);

// rules.spec.ts — capacité (R5)
it('accepts a load exactly equal to capacity', () =>
  expect(() => assertCanAddLines(draft(), ['SO-1031'], [{ no: 'SO-1031', status: 'TO_PLAN', weight: 14000 }])).not.toThrow());
it('refuses one hundredth of a kg over capacity', () =>
  expectCode(() => assertCanAddLines(draft(), ['SO-X'], [{ no: 'SO-X', status: 'TO_PLAN', weight: 14001 }]),
    'CAPACITY_EXCEEDED', { transportOrderNo: 'TO-0003', capacityKg: 1500, currentKg: 1360, requestedKg: 140.01, excessKg: 0.01 }));
it('sums several orders before comparing', () => /* 430 + 260 + 145.5 on load 0 / cap 500000 → ok ; on cap 80000 → CAPACITY_EXCEEDED excessKg 35.5 */);
// affectation (R3, R7)
it('refuses an order that is not TO_PLAN', () => expectCode(…[{ no: 'SO-1003', status: 'PLANNED', weight: 110000 }]…, 'SALES_ORDER_NOT_PLANNABLE', { salesOrderNos: ['SO-1003'] }));
it('refuses unknown numbers', () => expectCode(() => assertCanAddLines(draft(), ['SO-9999'], []), 'SALES_ORDER_UNKNOWN', { salesOrderNos: ['SO-9999'] }));
it('refuses duplicates in one request', () => expectCode(…['SO-1008', 'SO-1008']…, 'DUPLICATE_SALES_ORDERS'));
it('refuses adding to a non-draft order', () => expectCode(() => assertCanAddLines(draft({ status: 'VALIDATED' }), …), 'ORDER_NOT_DRAFT'));
it('refuses removing from a non-draft order / a missing line', …ORDER_NOT_DRAFT… / …LINE_NOT_FOUND…);
// changements de statut (R8, R9) — table complète
it.each([
  ['DRAFT', 2, 'validate', null], ['DRAFT', 0, 'validate', 'ORDER_EMPTY'], ['VALIDATED', 2, 'validate', 'INVALID_TRANSITION'],
  ['DEPARTED', 2, 'validate', 'INVALID_TRANSITION'], ['VALIDATED', 2, 'depart', null], ['DRAFT', 2, 'depart', 'INVALID_TRANSITION'],
  ['DEPARTED', 2, 'depart', 'INVALID_TRANSITION'],
])('%s with %i lines → %s gives %s', …);
// création (R1, R2)
it('refuses a past date and accepts today', () => { expectCode(() => assertDeliveryDateNotPast('2026-10-23', '2026-10-24'), 'DELIVERY_DATE_IN_PAST'); expect(() => assertDeliveryDateNotPast('2026-10-24', '2026-10-24')).not.toThrow(); });
it('refuses an unknown or inactive vehicle', …VEHICLE_UNKNOWN… / …VEHICLE_INACTIVE…);
it('refuses a vehicle already booked that day', () => expectCode(() => assertVehicleFree('TO-0003', 'VH-01', '2026-10-25'), 'VEHICLE_ALREADY_BOOKED', { transportOrderNo: 'TO-0003' }));
// actions autorisées
it.each([
  ['DRAFT', 2, 'DISPATCHER', ['ADD_LINES', 'REMOVE_LINES']], ['DRAFT', 2, 'LOGISTICS_MANAGER', ['ADD_LINES', 'REMOVE_LINES', 'VALIDATE']],
  ['DRAFT', 0, 'LOGISTICS_MANAGER', ['ADD_LINES']], ['VALIDATED', 3, 'DISPATCHER', ['DEPART']], ['DEPARTED', 2, 'LOGISTICS_MANAGER', []],
])('allowedActions(%s, %i lines, %s)', …);

// order-number.spec.ts
expect(nextTransportOrderNo(null)).toBe('TO-0001'); expect(nextTransportOrderNo('TO-0004')).toBe('TO-0005');
expect(nextTransportOrderNo('TO-0099')).toBe('TO-0100'); expect(nextTransportOrderNo('TO-9999')).toBe('TO-10000');
```

- [ ] **Étape 2 : `npx jest src/domain`** → échec.
- [ ] **Étape 3 : implémenter les cinq fichiers** selon les interfaces ci-dessus (comparaison de dates par chaîne `YYYY-MM-DD`).
- [ ] **Étape 4 : `npx jest src/domain`** → PASS.
- [ ] **Étape 5 : commit** `feat(api): add pure transport-order domain rules with unit tests`

---

## Tâche 3 : routes de lecture

**Fichiers :**
- Créer : `api/src/sales-orders/{sales-orders.module.ts,sales-orders.controller.ts,sales-orders.repository.ts,sales-order.dto.ts,to-plan.query.ts}`, `api/src/transport-orders/{transport-orders.module.ts,transport-orders.controller.ts,transport-orders.service.ts,transport-orders.repository.ts}`, `api/src/transport-orders/dto/{transport-order.dto.ts,list-transport-orders.query.ts}`
- Tests : `api/test/sales-orders.e2e-spec.ts`, `api/test/transport-orders.read.e2e-spec.ts`

**Interfaces :**
- Consomme : `SqlService`, `inList`, `PageQueryDto`, `Page`, statuts, `toHundredths`/`toKg`, `allowedActions`.
- Produit :
  - `SalesOrderDto { no; customerNo; customerName; deliveryCity; totalWeightKg; status }`, `TransportOrderSummaryDto` et `TransportOrderDetailDto` = types du §7.3 (classes pour Swagger).
  - `SalesOrdersRepository.findToPlan(q: ToPlanQuery): Promise<Page<SalesOrderDto>>`, `findToPlanCities(): Promise<string[]>`.
  - `TransportOrdersRepository.list(runner: SqlRunner, q: ListTransportOrdersQuery): Promise<Page<TransportOrderSummaryDto>>`, `findSummary(runner, no): Promise<TransportOrderSummaryDto | null>`, `findLines(runner, no): Promise<SalesOrderDto[]>`.
  - `TransportOrdersService.list(q)`, `getDetail(no: string, user: CurrentUser, runner?: SqlRunner): Promise<TransportOrderDetailDto>` (404 `TRANSPORT_ORDER_NOT_FOUND`). Les mutations des tâches 4 à 6 renvoient `getDetail` relu dans leur transaction.

SQL du résumé (une seule source, réutilisée par `list` et `findSummary`) : `CONVERT(char(16), CONVERT(binary(8), t.[timestamp]), 2) AS version` (hexadécimal sans `0x`), `CONVERT(char(10), t.[Delivery Date], 23) AS deliveryDate`, jointure `[Vehicle]` pour `plateNo`/`capacityKg`, `OUTER APPLY (SELECT COUNT(*) AS lineCount, ISNULL(SUM(so.[Total Weight (kg)]), 0) AS totalWeightKg FROM [Transport Order Line] l JOIN [Sales Order] so ON so.[No_] = l.[Sales Order No_] WHERE l.[Transport Order No_] = t.[No_])`. Tri `[Delivery Date] DESC, [No_] DESC`. Filtres : `status` (`@IsIn`), `deliveryDate` (`@IsISO8601({ strict: true })` + longueur 10), `city` (`@MaxLength(50)`). Comptage dans une seconde requête au même `WHERE`.

- [ ] **Étape 1 : écrire les tests e2e**

```ts
// sales-orders.e2e-spec.ts
it('lists the 33 orders to plan, 20 per page, sorted by number, camelCase only', …
  expect(res.body).toMatchObject({ page: 1, pageSize: 20, total: 33 }); expect(res.body.items[0].no).toBe('SO-1008');
  expect(Object.keys(res.body.items[0]).sort()).toEqual(['customerName', 'customerNo', 'deliveryCity', 'no', 'status', 'totalWeightKg']));
it('filters by city and paginates', … '?city=Douala' → total 11 ; '?city=Douala&page=2&pageSize=10' → items.map(no) == ['SO-1039']);
it('filters an accented city', … `?city=${encodeURIComponent('Yaoundé')}` → total 7);           // vigilance 1
it('returns an empty page past the end', … '?page=99' → items [], total 33);
it('rejects pageSize 0 with 400 VALIDATION_FAILED and field errors', … expect(res.body.errors[0].field).toBe('pageSize'));
it('lists cities having orders to plan', … toEqual(['Bafoussam', 'Douala', 'Edéa', 'Kribi', 'Limbé', 'Yaoundé']));

// transport-orders.read.e2e-spec.ts
it('lists orders by date desc then number desc', … items.map(no) == ['TO-0004', 'TO-0003', 'TO-0002', 'TO-0001'], total 4);
it('filters by status', … '?status=DRAFT' → ['TO-0004', 'TO-0003']);
it('returns load figures and a 16-hex version', … TO-0003 → lineCount 2, totalWeightKg 1360, capacityKg 1500, plateNo 'LT-482-AB', version /^[0-9A-F]{16}$/);
it('returns the detail with lines, remaining capacity and ETag', … GET /transport-orders/TO-0003 →
  lines.map(no) == ['SO-1006', 'SO-1007'], remainingKg 140, headers.etag == `"${body.version}"`);
it.each([
  ['diane', 'TO-0003', ['ADD_LINES', 'REMOVE_LINES']], ['eric', 'TO-0003', ['ADD_LINES', 'REMOVE_LINES', 'VALIDATE']],
  ['eric', 'TO-0004', ['ADD_LINES']], ['diane', 'TO-0002', ['DEPART']], ['eric', 'TO-0001', []],
])('allowedActions for %s on %s', …);
it('returns 404 TRANSPORT_ORDER_NOT_FOUND for TO-9999', …);
```

- [ ] **Étape 2 : `npm run test:e2e`** → échec des nouveaux tests.
- [ ] **Étape 3 : implémenter repositories, service et contrôleurs** (`GET /sales-orders/to-plan`, `GET /sales-orders/to-plan/cities`, `GET /transport-orders`, `GET /transport-orders/:no` qui pose `ETag: "<version>"`).
- [ ] **Étape 4 : `npm run test:e2e && npm test`** → PASS.
- [ ] **Étape 5 : commit** `feat(api): add read endpoints for sales orders to plan and transport orders`

---

## Tâche 4 : création d'un ordre (R1, R2, numérotation)

**Fichiers :**
- Créer : `api/src/auth/require-action.ts`, `api/src/transport-orders/dto/create-transport-order.dto.ts`
- Modifier : `transport-orders.{controller,service,repository}.ts`
- Tests : `api/test/transport-orders.create.e2e-spec.ts`

**Interfaces :**
- Consomme : `can`, `assertDeliveryDateNotPast`, `assertVehicleUsable`, `assertVehicleFree`, `nextTransportOrderNo`, `Clock`, `getDetail`.
- Produit :
  - `@RequireAction(action: Action)` + `ActionGuard` : 403 `FORBIDDEN_ROLE` si `!can(user.role, action)`. Utilisé par toutes les mutations.
  - Repository : `lockVehicle(tx, code): Promise<{ code: string; active: boolean } | null>` (`WITH (UPDLOCK, ROWLOCK)`), `findOrderNoFor(tx, vehicleCode, deliveryDate): Promise<string | null>`, `lastOrderNo(tx): Promise<string | null>` (`SELECT TOP 1 [No_] … WITH (UPDLOCK, HOLDLOCK) ORDER BY LEN([No_]) DESC, [No_] DESC`), `insert(tx, { no, vehicleCode, deliveryDate, createdBy }): Promise<void>`.
  - `TransportOrdersService.create(dto: CreateTransportOrderDto, user): Promise<TransportOrderDetailDto>`.
  - `POST /transport-orders` → 201, `Location: /transport-orders/<no>`, `ETag`.

DTO : `vehicleCode` (`@IsString() @MaxLength(20)`, `trim` + majuscules), `deliveryDate` (`@IsISO8601({ strict: true })` + longueur 10). Séquence transactionnelle : §8.1 de la spécification.

- [ ] **Étape 1 : écrire les tests e2e** (`today = todayInDouala()`)

```ts
it('R1 creates a DRAFT order TO-0005 for an active vehicle today', … as diane POST { vehicleCode: 'VH-05', deliveryDate: today } →
  201, body { no: 'TO-0005', status: 'DRAFT', createdBy: 'diane', validatedBy: null, lineCount: 0, allowedActions: ['ADD_LINES'] },
  headers.location '/transport-orders/TO-0005', headers.etag `"${body.version}"`);
it('numbers the next order TO-0006', …);
it('R1 refuses an inactive vehicle with 422 VEHICLE_INACTIVE', … 'VH-07');
it('refuses an unknown vehicle with 422 VEHICLE_UNKNOWN', … 'VH-99');
it('R1 refuses yesterday with 422 DELIVERY_DATE_IN_PAST', … addDays(today, -1));
it('R2 refuses a second order for VH-01 tomorrow with 409', … addDays(today, 1) → code VEHICLE_ALREADY_BOOKED, params.transportOrderNo 'TO-0003');
it('rejects an impossible date with 400', … '2026-02-30' → VALIDATION_FAILED);
```

- [ ] **Étape 2 : `npm run test:e2e`** → échec.
- [ ] **Étape 3 : implémenter** (contrôle de la date avant la transaction ; verrous dans l'ordre véhicule → numéro).
- [ ] **Étape 4 : `npm run test:e2e`** → PASS.
- [ ] **Étape 5 : commit** `feat(api): create transport orders with vehicle, date and numbering rules`

---

## Tâche 5 : ajout et retrait de commandes (R3 à R7), version et concurrence

**Fichiers :**
- Créer : `api/src/common/if-match.decorator.ts`, `api/src/transport-orders/dto/add-lines.dto.ts`
- Modifier : `transport-orders.{controller,service,repository}.ts`, `api/src/sales-orders/sales-orders.repository.ts`
- Tests : `api/test/transport-orders.lines.e2e-spec.ts`, `api/test/concurrency.e2e-spec.ts`

**Interfaces :**
- Consomme : `parseIfMatch`, `assertCanAddLines`, `assertCanRemoveLine`, `inList`, `getDetail`, `@RequireAction`.
- Produit :
  - `@IfMatchVersion()` (décorateur de paramètre) : renvoie la version ou lève 428 `VERSION_REQUIRED`.
  - Repository : `lockHeader(tx, no, version): Promise<boolean>` (instruction du §8.2 avec `[timestamp] = CONVERT(binary(8), @version, 2)`, `true` si 1 ligne), `exists(tx, no): Promise<boolean>`, `loadState(tx, no): Promise<OrderState>`, `lineExists(tx, no, salesOrderNo)`, `insertLines(tx, no, nos)`, `deleteLine(tx, no, salesOrderNo)`.
  - `SalesOrdersRepository` : `findCandidates(tx, nos): Promise<Candidate[]>` (`WITH (UPDLOCK, ROWLOCK)`), `setStatus(tx, nos: string[], to: SalesOrderStatus, from: SalesOrderStatus): Promise<number>` (lignes modifiées).
  - Service : `private lockOrFail(tx, no, version)` (404 si l'ordre n'existe pas, 412 `STALE_VERSION` sinon), `addLines(no, version, nos, user)`, `removeLine(no, version, salesOrderNo, user)`.
  - `POST /transport-orders/:no/lines` (`ADD_LINES`), `DELETE /transport-orders/:no/lines/:salesOrderNo` (`REMOVE_LINES`) → 200 détail + `ETag`.

DTO : `salesOrderNos` `@IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(20, { each: true })`, avec `@Transform` qui applique `trim` + majuscules à chaque élément (pas d'`ArrayUnique` : le doublon est un refus du domaine, 400 `DUPLICATE_SALES_ORDERS`). Même normalisation pour `:salesOrderNo`. Après `setStatus(…, 'PLANNED', 'TO_PLAN')`, un nombre de lignes différent du nombre demandé lève `SALES_ORDER_NOT_PLANNABLE`.

- [ ] **Étape 1 : écrire les tests e2e** (helper `versionOf(no)` = GET du détail)

```ts
it('R4/R6 adds three orders at once and plans them', … TO-0004 + ['SO-1008', 'SO-1011', 'SO-1013'] with If-Match →
  200, lineCount 3, totalWeightKg 835.5, every line status 'PLANNED' ; GET /sales-orders/to-plan total 30, headers.etag changed);
it('adds weights with cents exactly', … TO-0004 + ['SO-1013', 'SO-1027'] → totalWeightKg 205.75);           // vigilance 4
it('normalises lower-case and padded numbers', … [' so-1008 '] → lines[0].no 'SO-1008');                    // vigilance 3
it('R5 accepts a load exactly equal to capacity', … TO-0003 + ['SO-1031'] (140 kg) → totalWeightKg 1500, remainingKg 0);
it('R5 refuses going over capacity with the excess', … TO-0003 + ['SO-1008'] → 409 CAPACITY_EXCEEDED, params.excessKg 290);
it('R3 refuses an order already planned', … ['SO-1003'] → 409 SALES_ORDER_NOT_PLANNABLE);
it('refuses an unknown order with 422', … ['SO-9999'] → SALES_ORDER_UNKNOWN);
it('refuses duplicates with 400', … ['SO-1008', 'so-1008'] → DUPLICATE_SALES_ORDERS);
it('R7 refuses changes to a validated order', … TO-0002 → 409 ORDER_NOT_DRAFT);
it('requires If-Match with 428', … no header → VERSION_REQUIRED);
it('refuses a stale version with 412', … reuse a version read before a previous change → STALE_VERSION);
it('returns 404 for TO-9999', …);
it('R6 removes a line and puts the order back to plan', … DELETE TO-0003/lines/SO-1006 → lineCount 1 ; SO-1006 is back in /to-plan);
it('returns 404 LINE_NOT_FOUND for an order not in the transport order', … DELETE TO-0003/lines/SO-1008);
it('R7 refuses removing from a validated order', … DELETE TO-0002/lines/SO-1003 → 409 ORDER_NOT_DRAFT);

// concurrency.e2e-spec.ts  (resetDb in beforeEach)
it('lets only one of two simultaneous adds on the same order win', … v = versionOf('TO-0004');
  [a, b] = await Promise.all([add('TO-0004', v, ['SO-1018']), add('TO-0004', v, ['SO-1036'])]);   // 4600 + 3800 > 5000
  expect([a.status, b.status].sort()).toEqual([200, 412]); expect(detail('TO-0004').totalWeightKg).toBeLessThanOrEqual(5000));
it('never puts one sales order in two transport orders', … simultaneous add of 'SO-1031' to TO-0003 and TO-0004, each with its own fresh version →
  statuses sorted [200, 409], loser code SALES_ORDER_NOT_PLANNABLE, SO-1031 appears in exactly one order);
```

- [ ] **Étape 2 : `npm run test:e2e`** → échec.
- [ ] **Étape 3 : implémenter** (séquences du §8.2).
- [ ] **Étape 4 : `npm run test:e2e && npm test`** → PASS ; relancer le fichier de concurrence trois fois pour vérifier qu'il est stable.
- [ ] **Étape 5 : commit** `feat(api): add and remove order lines under header lock and rowversion`

---

## Tâche 6 : validation et départ (R8, R9)

**Fichiers :**
- Modifier : `transport-orders.{controller,service,repository}.ts`, `sales-orders.repository.ts` (réutilise `setStatus`)
- Tests : `api/test/transport-orders.lifecycle.e2e-spec.ts`

**Interfaces :**
- Consomme : `lockOrFail`, `assertCanValidate`, `assertCanDepart`, `setStatus`, `@RequireAction`, `@IfMatchVersion`.
- Produit : repository `markValidated(tx, no, userId)`, `markDeparted(tx, no)`, `lineNos(tx, no): Promise<string[]>` ; service `validate(no, version, user)`, `depart(no, version, user)` ; `POST /transport-orders/:no/validate` (`VALIDATE`) et `/depart` (`DEPART`) → 200 détail + `ETag`.

- [ ] **Étape 1 : écrire les tests e2e**

```ts
it('R8 forbids a dispatcher to validate with 403', … diane POST TO-0003/validate → FORBIDDEN_ROLE);
it('R8 refuses validating an empty order', … eric TO-0004 → 409 ORDER_EMPTY);
it('R8 validates a draft with lines', … eric TO-0003 → status 'VALIDATED', validatedBy 'eric', allowedActions ['DEPART']);
it('R8 makes a validated order read-only', … then POST TO-0003/lines ['SO-1031'] → 409 ORDER_NOT_DRAFT);
it('refuses validating twice', … eric TO-0002 → 409 INVALID_TRANSITION);
it('R9 departs a validated order and ships its orders', … diane TO-0002/depart → status 'DEPARTED', lines all 'IN_DELIVERY', allowedActions []);
it('R9 refuses departing a draft or a departed order', … TO-0004 → INVALID_TRANSITION ; TO-0001 → INVALID_TRANSITION);
it('requires If-Match on validate and depart', … → 428);
```

- [ ] **Étape 2 : `npm run test:e2e`** → échec.
- [ ] **Étape 3 : implémenter.**
- [ ] **Étape 4 : `npm test && npm run test:e2e && npm run lint && npm run build`** → tout passe ; ouvrir `http://localhost:3000/docs` et vérifier que les 10 routes et les en-têtes `X-User-Id` / `If-Match` y figurent.
- [ ] **Étape 5 : commit** `feat(api): validate and depart transport orders`

---

## Tâche 7 : socle front, thème, i18n, client HTTP, en-tête et navigation

**Fichiers :**
- Créer (CLI) : `web/` via `npm create vue@latest web -- --ts --router --pinia --vitest --eslint-with-prettier` (si une option n'est pas reconnue, vérifier ensuite que `package.json` contient `vue-router`, `pinia`, `vitest`, `eslint`)
- Créer : `web/.env.example` (`VITE_API_URL=http://localhost:3000`), `web/src/theme/preset.ts`, `web/src/assets/main.css`, `web/src/i18n/{index.ts,fr.ts,en.ts}`, `web/src/api/{http.ts,types.ts,salesOrders.ts,vehicles.ts,transportOrders.ts}`, `web/src/stores/user.ts`, `web/src/composables/{useBreakpoint.ts,useApiError.ts}`, `web/src/utils/{dates.ts,weights.ts}`, `web/src/components/layout/{AppHeader.vue,UserSwitcher.vue,LangSwitch.vue,BottomNav.vue}`, vues vides `web/src/views/{SalesOrdersView,TransportOrdersView,TransportOrderDetailView}.vue`
- Modifier : `web/src/main.ts`, `web/src/App.vue`, `web/src/router/index.ts`, `web/vite.config.ts`
- Tests : `web/src/utils/{dates.spec.ts,weights.spec.ts}`, `web/src/api/http.spec.ts`

**Interfaces :**
- Produit :
  - `api/types.ts` : types du §7.3 de la spécification, mot pour mot, plus `Page<T>`, `Role`, `SalesOrderStatus`, `TransportOrderStatus`, `TransportOrderAction`.
  - `http<T>(path: string, options?: { method?: 'GET' | 'POST' | 'DELETE'; query?: Record<string, string | number | null | undefined>; body?: unknown; ifMatch?: string }): Promise<{ data: T; etag: string | null }>` ; ajoute `X-User-Id` depuis `useUserStore()` et `If-Match: "<v>"` ; lève `ApiError { status: number; code: string; title: string; detail: string; params: Record<string, unknown> }` (réseau injoignable → `status 0`, `code 'NETWORK_ERROR'`).
  - `salesOrders.ts` : `fetchToPlan({ city, page, pageSize })`, `fetchToPlanCities()` ; `vehicles.ts` : `fetchVehicles()` ; `transportOrders.ts` : `fetchTransportOrders({ status, deliveryDate, page, pageSize })`, `fetchTransportOrder(no)`, `createTransportOrder({ vehicleCode, deliveryDate })`, `addLines(no, version, salesOrderNos)`, `removeLine(no, version, salesOrderNo)`, `validateOrder(no, version)`, `departOrder(no, version)` (toutes renvoient `data`).
  - `useUserStore()` : `userId: 'diane' | 'eric'` (persisté `localStorage` clé `tp.user`, lectures et écritures dans `try/catch`), getter `role`, action `switchTo(id)` ; `APP_USERS = [{ id: 'diane', role: 'DISPATCHER' }, { id: 'eric', role: 'LOGISTICS_MANAGER' }]`.
  - `setLocale(locale: 'fr' | 'en')` (persisté `tp.lang`), `errorMessage(e: unknown): string` dans `useApiError` (clé `errors.<CODE>` avec `params`, sinon `detail`, sinon `errors.UNKNOWN`).
  - `useBreakpoint(): { isMobile: Ref<boolean>; isTablet: Ref<boolean>; isDesktop: Ref<boolean> }` sur `matchMedia('(max-width: 639px)')` et `('(min-width: 1024px)')`.
  - `toIsoDate(d: Date): string` (date **locale**, jamais `toISOString`), `formatDate(iso: string): string` → `jj/mm/aaaa` sans passer par `Date`, `toHundredths(kg: number): number` (même règle que l'API), `formatKg(kg: number, locale: 'fr' | 'en'): string` (`Intl.NumberFormat`, 2 décimales, suffixe ` kg`), `loadLevel(usedKg: number, capacityKg: number): 'ok' | 'warn' | 'over'` (`> 85 %` → `warn`, `> 100 %` → `over`, calcul en centièmes).
  - `App.vue` : en-tête, `<RouterView :key="userStore.userId" />` (changer d'utilisateur remonte la vue, donc recharge les données et `allowedActions`), `BottomNav` si mobile, `<Toast />`, `<ConfirmDialog />`.

Thème : suivre les règles du skill `nuxt-primevue-tailwind` pour le preset, les jetons et l'ordre des couches CSS (transposées à Vite). PrimeVue configuré avec `definePreset(Aura, { semantic: { primary: { 50: '{teal.50}', …, 950: '{teal.950}' } } })`, `cssLayer: { name: 'primevue', order: 'theme, base, primevue' }` et `darkModeSelector: '.app-dark'` (jamais appliqué : pas de bascule automatique sur le thème sombre de l'OS). `main.css` déclare `@layer theme, base, primevue, components, utilities;`, importe Tailwind et `tailwindcss-primeui` ainsi que les polices `@fontsource`, et définit dans `@theme` les couleurs du §9.4 et `--font-sans`/`--font-mono`. Services `ToastService` et `ConfirmationService`. Routes : `/` → `/sales-orders`, `/sales-orders`, `/transport-orders`, `/transport-orders/:no` (`props: true`), vues chargées à la demande.

- [ ] **Étape 1 : générer le projet et installer**

```bash
npm create vue@latest web -- --ts --router --pinia --vitest --eslint-with-prettier
cd web && npm i primevue @primeuix/themes primeicons vue-i18n @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono && npm i -D tailwindcss @tailwindcss/vite tailwindcss-primeui
```

- [ ] **Étape 2 : écrire les tests**

```ts
// dates.spec.ts
expect(toIsoDate(new Date(2026, 9, 26, 0, 30))).toBe('2026-10-26'); expect(formatDate('2026-10-26')).toBe('26/10/2026');
// weights.spec.ts
expect(formatKg(1360, 'fr').replace(/\s/g, ' ')).toBe('1 360,00 kg'); expect(formatKg(1360, 'en')).toBe('1,360.00 kg');
expect(loadLevel(1275, 1500)).toBe('ok'); expect(loadLevel(1360, 1500)).toBe('warn'); expect(loadLevel(2195.5, 1500)).toBe('over');
// http.spec.ts (fetch stubbé, Pinia actif, utilisateur diane)
it('sends X-User-Id and If-Match', … http('/transport-orders/TO-0003/validate', { method: 'POST', ifMatch: '00000000000007D3' }) →
  headers 'X-User-Id' 'diane', 'If-Match' '"00000000000007D3"');
it('returns the ETag', … response header etag '"ABC"' → result.etag '"ABC"');
it('turns problem+json into ApiError', … 409 { code: 'CAPACITY_EXCEEDED', params: { excessKg: 695.5 } } → rejects ApiError status 409, code 'CAPACITY_EXCEEDED', params.excessKg 695.5);
it('maps a network failure to NETWORK_ERROR', …);
```

- [ ] **Étape 3 : `npx vitest run`** → échec.
- [ ] **Étape 4 : implémenter** les fichiers listés ; `fr.ts` et `en.ts` contiennent la navigation, les rôles, les statuts et un message par code d'erreur du §7.4 (interpolation de `params`).
- [ ] **Étape 5 : `npx vitest run && npm run type-check && npm run lint && npm run build`** → tout passe. `npm run dev` : en-tête visible, bascule diane/eric et FR/EN persistées au rechargement, barre d'onglets en bas sous 640 px.
- [ ] **Étape 6 : commit** `feat(web): bootstrap Vue app with PrimeVue theme, i18n, API client and responsive shell`

---

## Tâche 8 : composants d'interface

**Fichiers :**
- Créer : `web/src/components/ui/{PlateChip.vue,StatusTag.vue,LoadBar.vue,LifecycleStepper.vue,AsyncState.vue}`
- Tests : `web/src/components/ui/LoadBar.spec.ts`

**Interfaces :**
- Consomme : `loadLevel`, `formatKg`, `toHundredths` (tâche 7, `utils/weights.ts`).
- Produit :
  - `PlateChip { plateNo: string; size?: 'sm' | 'md' }` : plaque avec bande vert-rouge-jaune.
  - `StatusTag { status: TransportOrderStatus | SalesOrderStatus }` : libellé traduit, couleurs du §9.4.
  - `LoadBar { segments: { key: string; label: string; kg: number }[]; capacityKg: number; projectedKg?: number; size?: 'sm' | 'lg' }` : `role="meter"`, `aria-valuemin="0"`, `aria-valuemax=capacityKg`, `aria-valuenow` = chargé + projeté ; largeur d'un segment = `kg / capacityKg × 100` arrondie à 2 décimales ; segments ambre si le niveau est `warn` ; la partie projetée est hachurée teal si elle tient, rouge (`data-over`) pour la part qui dépasse ; le total affiché ne dépasse jamais 100 % de la largeur.
  - `LifecycleStepper { status: TransportOrderStatus; createdBy: string; validatedBy: string | null; compact?: boolean }`.
  - `AsyncState { loading: boolean; error: string | null; empty: boolean; emptyText: string; emptyActionLabel?: string }`, émet `retry` et `emptyAction`, slot par défaut pour le contenu, squelettes pendant le chargement.

- [ ] **Étape 1 : écrire les tests**

```ts
it('draws one segment per order with exact widths', … segments 640 / 720 on 1500 → widths '42.67%' and '48.00%');
it('turns amber above 85 %', … 1360 / 1500 → root has class or data-level 'warn');
it('shows a hatched projection that fits', … capacity 5000, projectedKg 835.5 → projection width '16.71%', no [data-over]);
it('marks the overflowing part in red', … 640 + 720 on 1500 with projectedKg 835.5 → [data-over] exists, aria-valuenow '2195.5');
```

- [ ] **Étape 2 : `npx vitest run src/components/ui`** → échec.
- [ ] **Étape 3 : implémenter les cinq composants.**
- [ ] **Étape 4 : `npx vitest run && npm run type-check`** → PASS.
- [ ] **Étape 5 : commit** `feat(web): add plate chip, status tag, load bar, lifecycle stepper and async state`

---

## Tâche 9 : écran Commandes à planifier

**Fichiers :**
- Créer : `web/src/stores/salesOrders.ts`, `web/src/components/planning/{SalesOrderCards.vue,SelectionBar.vue}`
- Modifier : `web/src/views/SalesOrdersView.vue`, `web/src/i18n/{fr,en}.ts`
- Tests : `web/src/stores/salesOrders.spec.ts`

**Interfaces :**
- Consomme : `fetchToPlan`, `fetchToPlanCities`, `AsyncState`, `useBreakpoint`, `formatKg`, `errorMessage`.
- Produit : `useSalesOrdersStore()` : état `city: string | null`, `page` (1), `pageSize` (10), `result: Page<SalesOrder> | null`, `cities: string[]`, `loading`, `error: string | null`, `selected: Record<string, SalesOrder>` ; getters `selection: SalesOrder[]`, `selectedWeightKg: number` (somme en centièmes), `isSelected(no)` ; actions `load()`, `loadCities()`, `setCity(city)` (page 1 + sélection vidée + chargement), `setPage(page, pageSize)`, `toggle(order)`, `togglePage(checked)`, `clearSelection()`. `SelectionBar` émet `add` ; la vue l'utilise pour ouvrir le dialogue (tâche 10).

La sélection est tenue par le store, **pas** par la sélection native du `DataTable` (qui ne survit pas aux pages chargées à la demande) : colonne de cases à cocher personnalisée, case d'en-tête = page courante. Bureau : `DataTable` `lazy` avec paginateur (`first`/`rows` convertis en `page`/`pageSize`) et colonnes N°, Client (+ n° client), Ville, Poids ; tablette : Ville sous le client ; mobile : `SalesOrderCards`. États : squelettes, vide (« Aucune commande à planifier à {city} » + « Toutes les villes »), erreur + « Réessayer ».

- [ ] **Étape 1 : écrire les tests du store** (module `api/salesOrders` mocké)

```ts
it('keeps the selection across pages', … toggle(SO-1008) ; await setPage(2, 10) ; expect(store.selection.map((o) => o.no)).toEqual(['SO-1008']));
it('resets page and selection when the city changes', … toggle(SO-1008) ; setPage(2, 10) ; await setCity('Kribi') → page 1, selection []);
it('sums the selected weight exactly', … 430 + 260 + 145.5 → selectedWeightKg 835.5);
```

- [ ] **Étape 2 : `npx vitest run src/stores`** → échec.
- [ ] **Étape 3 : implémenter store, cartes, barre et vue.**
- [ ] **Étape 4 : `npx vitest run && npm run type-check`** → PASS ; vérifier dans le navigateur à 375, 768 et 1280 px : filtre Douala → 11 commandes, sélection conservée entre les pages, barre « 3 commandes sélectionnées · 835,50 kg ».
- [ ] **Étape 5 : commit** `feat(web): add sales orders to plan screen with persistent multi-page selection`

---

## Tâche 10 : dialogue « Ajouter à un transport »

**Fichiers :**
- Créer : `web/src/components/planning/{AddToTransportDialog.vue,DraftOrderOption.vue,VehiclePicker.vue}`
- Modifier : `web/src/views/SalesOrdersView.vue` (ouverture du dialogue, lecture de `?target=`), `web/src/i18n/{fr,en}.ts`
- Tests : `web/src/components/planning/{DraftOrderOption.spec.ts,VehiclePicker.spec.ts,AddToTransportDialog.spec.ts}`

**Interfaces :**
- Consomme : `fetchTransportOrders`, `fetchVehicles`, `createTransportOrder`, `addLines`, `LoadBar`, `PlateChip`, `useSalesOrdersStore`, `toIsoDate`, `errorMessage`.
- Produit :
  - `DraftOrderOption { order: TransportOrderSummary; addKg: number; selected: boolean }`, émet `select` ; « tient » = centièmes(`totalWeightKg`) + centièmes(`addKg`) ≤ centièmes(`capacityKg`) ; sinon `aria-disabled="true"` et l'excédent est affiché.
  - `VehiclePicker { vehicles: Vehicle[]; booked: Record<string, string>; minCapacityKg: number; modelValue: string | null }`, émet `update:modelValue` ; véhicule désactivé avec sa raison s'il figure dans `booked` (« Déjà TO-0003 ce jour ») ou si `capacityKg < minCapacityKg`.
  - `AddToTransportDialog { visible: boolean; selection: SalesOrder[]; targetNo?: string }`, émet `update:visible` et `done(no: string)`. `booked` est construit à partir de `fetchTransportOrders({ deliveryDate, page: 1, pageSize: 100 })` (`vehicleCode` → `no`), rechargé à chaque changement de date.

Comportement (§9.2) : à l'ouverture, chargement des brouillons (`status: 'DRAFT'`, `pageSize: 100`) et des véhicules. Ajout à un brouillon : `addLines(no, version, nos)`. Nouvel ordre : date minimale aujourd'hui (locale), puis `createTransportOrder` et `addLines` avec la version reçue ; si l'ajout échoue après la création, le message le dit et l'ordre créé est nommé. Sur 412, rechargement des brouillons et message « TO-xxxx a été modifié entre-temps ; jauges mises à jour », sélection conservée. Bouton d'envoi désactivé pendant l'envoi. Succès : toast avec lien vers l'ordre, `done(no)`, sélection vidée et liste rechargée. Bureau : deux colonnes ; tablette : colonnes empilées, 90 % de largeur ; mobile : plein écran avec `SelectButton` « Ordre existant | Nouvel ordre » et bouton collé en bas.

- [ ] **Étape 1 : écrire les tests**

```ts
// DraftOrderOption.spec.ts
it('disables a draft the selection does not fit in and shows the excess', … TO-0003 (1360 / 1500), addKg 835.5 → aria-disabled 'true', text contains '695,50');
it('enables a draft with room', … TO-0004 (0 / 5000), addKg 835.5 → aria-disabled not 'true');
// VehiclePicker.spec.ts
it('disables a vehicle already booked that day with the order number', … booked { 'VH-01': 'TO-0003' } → VH-01 disabled, text contains 'TO-0003');
it('disables a vehicle too small for the selection', … VH-09 (1200) with minCapacityKg 1500 → disabled);
// AddToTransportDialog.spec.ts
it('disables the submit button while the request is pending', … addLines mocked with a never-resolving promise ; click submit → button has disabled attribute);   // vigilance 5
```

- [ ] **Étape 2 : `npx vitest run src/components/planning`** → échec.
- [ ] **Étape 3 : implémenter les trois composants et le câblage dans la vue.**
- [ ] **Étape 4 : `npx vitest run && npm run type-check`** → PASS ; dans le navigateur (API lancée) : sélection SO-1008 + SO-1011 + SO-1013 → TO-0003 grisé « dépasse de 695,50 kg », TO-0004 accepté ; nouvel ordre pour demain → VH-01 et VH-03 grisés.
- [ ] **Étape 5 : commit** `feat(web): add the add-to-transport dialog with projected load and vehicle availability`

---

## Tâche 11 : écran Ordres de transport

**Fichiers :**
- Créer : `web/src/stores/transportOrders.ts`, `web/src/components/planning/{TransportOrderCards.vue,NewOrderDialog.vue}`
- Modifier : `web/src/views/TransportOrdersView.vue`, `web/src/i18n/{fr,en}.ts`

**Interfaces :**
- Consomme : `fetchTransportOrders`, `createTransportOrder`, `VehiclePicker`, `LoadBar`, `StatusTag`, `PlateChip`, `AsyncState`, `useBreakpoint`.
- Produit : `useTransportOrdersStore()` : partie liste `status: TransportOrderStatus | null`, `deliveryDate: string | null`, `page`, `pageSize` (10), `result`, `loading`, `error`, actions `load()`, `setStatus(s)`, `setDeliveryDate(d)` (chacune revient à la page 1), `setPage(page, pageSize)`. `NewOrderDialog { visible }` émet `created(no)` puis la vue navigue vers `/transport-orders/<no>`.

Bureau : filtre statut (`SelectButton` Tous / Brouillon / Validé / Parti), `DatePicker` de date, tableau N°, Statut, Livraison, Véhicule (plaque + code), Cmd., Chargement (`LoadBar` `sm` + %), Créé par ; clic sur une ligne → détail. Tablette : sans « Créé par » ni « Cmd. ». Mobile : `TransportOrderCards`, statut en puces, date dans un panneau « Filtres ».

- [ ] **Étape 1 : implémenter store, cartes, dialogue de création et vue.**
- [ ] **Étape 2 : `npx vitest run && npm run type-check && npm run lint`** → PASS ; navigateur à 375 / 768 / 1280 px : 4 ordres dans l'ordre TO-0004, TO-0003, TO-0002, TO-0001, filtre Brouillon → 2, création d'un ordre vide → ouverture de son détail.
- [ ] **Étape 3 : commit** `feat(web): add transport orders list with filters and order creation`

---

## Tâche 12 : écran Détail d'un ordre

**Fichiers :**
- Créer : `web/src/components/planning/{OrderActions.vue,OrderLines.vue}`
- Modifier : `web/src/stores/transportOrders.ts` (partie détail), `web/src/views/TransportOrderDetailView.vue`, `web/src/i18n/{fr,en}.ts`
- Tests : `web/src/components/planning/OrderActions.spec.ts`

**Interfaces :**
- Consomme : `fetchTransportOrder`, `removeLine`, `validateOrder`, `departOrder`, `LoadBar`, `LifecycleStepper`, `PlateChip`, `StatusTag`, `AsyncState`, `useConfirm`, `errorMessage`.
- Produit : store, partie détail : `current: TransportOrderDetail | null`, `loadDetail(no)`, `removeLine(salesOrderNo)`, `validate()`, `depart()` (chacune envoie `current.version` en `If-Match` et remplace `current` par la réponse ; sur 412, recharge et expose `staleNotice`). `OrderActions { order: TransportOrderDetail; role: Role }` émet `addLines`, `validate`, `depart`. `OrderLines { lines: SalesOrder[]; canRemove: boolean }` émet `remove(no)`.

Boutons d'après `allowedActions` uniquement. Textes d'aide : Brouillon sans `VALIDATE` et rôle `DISPATCHER` → « La validation est réservée au responsable logistique » ; Brouillon, rôle `LOGISTICS_MANAGER`, 0 ligne → « Ajoutez au moins une commande pour valider ». Confirmation (`ConfirmDialog`) pour Retirer (« SO-1006 repassera À planifier »), Valider (« l'ordre ne sera plus modifiable ») et Marquer parti (« les N commandes passeront En livraison »). « + Ajouter des commandes » → `/sales-orders?target=<no>`. Jauge `lg` segmentée par commande, badge « 91 % · 140 kg libres ». Bureau : deux colonnes ; tablette : une colonne ; mobile : étapes en points, lignes en cartes, action principale collée en bas.

- [ ] **Étape 1 : écrire les tests**

```ts
it('hides Validate from a dispatcher and explains why', … diane, DRAFT, allowedActions ['ADD_LINES', 'REMOVE_LINES'] → no button 'Valider', text contains 'responsable logistique');
it('shows Validate to a manager on a draft with lines', … eric, allowedActions [..., 'VALIDATE'] → button 'Valider l'ordre');
it('explains that an empty order cannot be validated', … eric, DRAFT, lineCount 0, ['ADD_LINES'] → text contains 'au moins une commande');
it('offers Depart on a validated order', … ['DEPART'] → button 'Marquer parti');
```

- [ ] **Étape 2 : `npx vitest run src/components/planning/OrderActions.spec.ts`** → échec.
- [ ] **Étape 3 : implémenter.**
- [ ] **Étape 4 : `npx vitest run && npm run type-check && npm run lint && npm run build`** → PASS ; dans le navigateur : TO-0003 en diane (texte d'aide, Retirer avec confirmation) ; basculer sur eric → « Valider » apparaît sans rechargement manuel ; valider puis marquer parti ; ouvrir le même ordre dans deux onglets et agir dans le second → « Ordre modifié entre-temps · Recharger ».
- [ ] **Étape 5 : commit** `feat(web): add transport order detail with load gauge, guarded actions and confirmations`

---

## Tâche 13 : README, traçabilité et clôture

**Fichiers :**
- Modifier : `README.md`, `docs/time-log.md`

- [ ] **Étape 1 : compléter le README** : prérequis (Docker, Node 24) ; lancement (base, `api` : `cp .env.example .env && npm i && npm run start:dev`, `web` : idem + `npm run dev`) ; tests (`npm test`, `npm run test:e2e`, `npx vitest run`) ; choix techniques et pourquoi (liens vers les ADR) ; **table de traçabilité R1 à R10** (règle → fichier où elle est vérifiée → nom des tests unitaires et e2e qui la prouvent, repris des tâches 2 à 6) ; ajouts au sujet (`/to-plan/cities`, `allowedActions`, `If-Match` obligatoire) avec un exemple curl `GET` puis `POST …/validate` avec `If-Match` ; ce qui manque et comment on l'aurait fait (§8.4, pagination par curseur, types générés depuis Swagger, authentification) ; temps passé par phase d'après `time-log.md` et `git log`.
- [ ] **Étape 2 : vérification complète** depuis un clone propre : `docker compose up -d`, réinitialisation, `api` : `npm test && npm run test:e2e && npm run lint && npm run build`, `web` : `npx vitest run && npm run type-check && npm run lint && npm run build` → tout passe ; consigner les éventuels échecs dans « Ce qui manque » plutôt que de les taire.
- [ ] **Étape 3 : commit** `docs: complete README with run instructions, rule traceability and time spent`
