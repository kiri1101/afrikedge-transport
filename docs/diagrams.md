# Diagrammes

Sources Mermaid, rendues directement par GitHub. Détails dans la [spécification](01-specification.md) et les [ADR](adr/README.md).

## 1. Cycle de vie d'un ordre de transport

```mermaid
stateDiagram-v2
    state "Brouillon (0)" as DRAFT
    state "Validé (1)" as VALIDATED
    state "Parti (2)" as DEPARTED

    [*] --> DRAFT : créer (DISPATCHER ou LOGISTICS_MANAGER)<br/>véhicule actif, date non passée,<br/>un seul ordre par véhicule et par date
    DRAFT --> VALIDATED : valider (LOGISTICS_MANAGER)<br/>au moins une commande
    VALIDATED --> DEPARTED : marquer parti<br/>(DISPATCHER ou LOGISTICS_MANAGER)
    DEPARTED --> [*]

    note right of DRAFT
        ajouter / retirer des commandes
        (À planifier ↔ Planifiée)
        poids total ≤ capacité du véhicule
    end note
    note right of VALIDATED : plus aucun ajout ni retrait
    note right of DEPARTED : commandes passées En livraison
```

## 2. Cycle de vie d'une commande de vente

```mermaid
stateDiagram-v2
    direction LR
    state "À planifier (0)" as TO_PLAN
    state "Planifiée (1)" as PLANNED
    state "En livraison (2)" as IN_DELIVERY

    [*] --> TO_PLAN
    TO_PLAN --> PLANNED : ajoutée à un ordre Brouillon
    PLANNED --> TO_PLAN : retirée de son ordre Brouillon
    PLANNED --> IN_DELIVERY : son ordre est marqué Parti
    IN_DELIVERY --> [*]
```

## 3. Ajout de commandes à un ordre, sous accès concurrent

Deux requêtes visent le même ordre avec la même version. Le verrou d'en-tête les met en file ; la seconde trouve une version changée et reçoit 412 (ADR-0002, ADR-0003).

```mermaid
sequenceDiagram
    autonumber
    actor A as diane (onglet A)
    actor B as eric (onglet B)
    participant API as API NestJS
    participant DOM as Domaine (pur)
    participant DB as SQL Server

    A->>API: POST /transport-orders/TO-0004/lines<br/>If-Match "V1", SO-1018
    B->>API: POST /transport-orders/TO-0004/lines<br/>If-Match "V1", SO-1036
    API->>DB: BEGIN TRAN (A)
    API->>DB: UPDATE en-tête WHERE No_ = TO-0004 AND timestamp = V1
    DB-->>API: 1 ligne : verrou exclusif, version V2
    API->>DB: BEGIN TRAN (B)
    API->>DB: UPDATE en-tête WHERE No_ = TO-0004 AND timestamp = V1
    Note over DB: B attend la fin de A
    API->>DB: charge, capacité, commandes WITH (UPDLOCK)
    API->>DOM: assertCanAddLines(ordre, demandées, trouvées)
    DOM-->>API: OK (4 600 kg sur 5 000)
    API->>DB: UPDATE Sales Order SET Status = 1 WHERE Status = 0
    API->>DB: INSERT Transport Order Line
    API->>DB: COMMIT (A)
    API-->>A: 200 détail, ETag "V2"
    DB-->>API: B débloquée : 0 ligne (version V1 périmée)
    API->>DB: ROLLBACK (B)
    API-->>B: 412 STALE_VERSION
```

## 4. Modèle de données

Relations logiques : la base n'a ni clé étrangère ni contrainte d'unicité ; l'API les garantit (ADR-0002). Le commentaire de chaque attribut donne le nom réel de la colonne.

```mermaid
erDiagram
    VEHICLE ||--o{ TRANSPORT_ORDER : "affecté à"
    TRANSPORT_ORDER ||--o{ TRANSPORT_ORDER_LINE : "contient"
    SALES_ORDER ||--o| TRANSPORT_ORDER_LINE : "transportée par au plus un"

    VEHICLE {
        nvarchar(20) Code PK "[Code]"
        nvarchar(20) Plate_No "[Plate No_]"
        decimal Capacity_kg "[Capacity (kg)] decimal(10,2)"
        bit Active "[Active] 1 utilisable, 0 hors service"
    }
    TRANSPORT_ORDER {
        nvarchar(20) No PK "[No_] TO-0001"
        nvarchar(20) Vehicle_Code "[Vehicle Code]"
        date Delivery_Date "[Delivery Date]"
        tinyint Status "[Status] 0 Brouillon, 1 Validé, 2 Parti"
        nvarchar(50) Created_By "[Created By]"
        nvarchar(50) Validated_By "[Validated By] nullable"
        rowversion timestamp "[timestamp] version de l'ordre"
    }
    TRANSPORT_ORDER_LINE {
        nvarchar(20) Transport_Order_No PK "[Transport Order No_]"
        nvarchar(20) Sales_Order_No PK "[Sales Order No_]"
    }
    SALES_ORDER {
        nvarchar(20) No PK "[No_] SO-1001"
        nvarchar(20) Customer_No "[Customer No_]"
        nvarchar(100) Customer_Name "[Customer Name]"
        nvarchar(50) Delivery_City "[Delivery City]"
        decimal Total_Weight_kg "[Total Weight (kg)] decimal(10,2)"
        tinyint Status "[Status] 0 À planifier, 1 Planifiée, 2 En livraison"
    }
```

## 5. Classes de l'API

```mermaid
classDiagram
    direction LR

    class TransportOrdersController {
        +list(query) Page
        +get(no) TransportOrderDetail
        +create(dto) TransportOrderDetail
        +addLines(no, version, dto) TransportOrderDetail
        +removeLine(no, version, salesOrderNo) TransportOrderDetail
        +validate(no, version) TransportOrderDetail
        +depart(no, version) TransportOrderDetail
    }
    class TransportOrdersService {
        +list(query) Page
        +getDetail(no, user) TransportOrderDetail
        +create(dto, user) TransportOrderDetail
        +addLines(no, version, nos, user) TransportOrderDetail
        +removeLine(no, version, salesOrderNo, user) TransportOrderDetail
        +validate(no, version, user) TransportOrderDetail
        +depart(no, version, user) TransportOrderDetail
        -lockOrFail(tx, no, version)
    }
    class TransportOrdersRepository {
        +list(runner, query) Page
        +findSummary(runner, no) Summary
        +findLines(runner, no) SalesOrder[]
        +lockVehicle(tx, code)
        +lastOrderNo(tx) string
        +insert(tx, order)
        +lockHeader(tx, no, version) boolean
        +loadState(tx, no) OrderState
        +insertLines(tx, no, nos)
        +deleteLine(tx, no, salesOrderNo)
        +markValidated(tx, no, userId)
        +markDeparted(tx, no)
    }
    class SalesOrdersRepository {
        +findToPlan(query) Page
        +findToPlanCities() string[]
        +findCandidates(tx, nos) Candidate[]
        +setStatus(tx, nos, to, from) number
    }
    class SqlService {
        +query(text, params) SqlResult
        +transaction(work) T
    }
    class rules {
        <<module domaine>>
        +assertDeliveryDateNotPast(date, today)
        +assertVehicleUsable(vehicle, code)
        +assertVehicleFree(bookedNo, code, date)
        +assertCanAddLines(order, requested, found)
        +assertCanRemoveLine(order, exists, no)
        +assertCanValidate(order)
        +assertCanDepart(order)
        +allowedActions(order, role) Action[]
    }
    class permissions {
        <<module domaine>>
        +can(role, action) boolean
    }
    class DomainError {
        +code ErrorCode
        +params
    }
    class Clock {
        <<abstract>>
        +today() string
    }
    class ZonedClock
    class ProblemDetailsFilter
    class UserGuard
    class ActionGuard

    TransportOrdersController --> TransportOrdersService
    TransportOrdersController ..> ActionGuard : @RequireAction
    TransportOrdersService --> TransportOrdersRepository
    TransportOrdersService --> SalesOrdersRepository
    TransportOrdersService --> SqlService : transaction
    TransportOrdersService --> rules
    TransportOrdersService --> Clock
    TransportOrdersRepository --> SqlService
    SalesOrdersRepository --> SqlService
    ActionGuard --> permissions
    rules --> permissions
    rules ..> DomainError : lève
    ProblemDetailsFilter ..> DomainError : traduit en HTTP
    ZonedClock --|> Clock
    UserGuard ..> ProblemDetailsFilter : 401 via DomainError
```
