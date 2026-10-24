# Planification des transports

Test technique **SEFS1026** (Afrikedge) : module fullstack de planification des transports, de la sélection des commandes de vente jusqu'au départ du véhicule.

> **État : conception en cours.** L'implémentation n'a pas commencé. Ce README est complété au fil du développement.

## Lancer le projet

### 1. Base de données (SQL Server)

```bash
docker compose up -d
docker compose ps    # attendre le statut "healthy" (environ 30 s)
docker compose exec sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Afk_Transport2026" -C -i /scripts/init.sql
```

Le script recrée la base `TransportPlanning` à chaque exécution.

### 2. API

_À venir._

### 3. Front

_À venir._

## Choix techniques

_À venir. L'analyse du sujet et les décisions sont dans [`docs/`](docs/)._

## Règles métier

_À venir : table de traçabilité règle → endroit où elle est vérifiée → test qui la prouve._

## Ce qui manque

_À venir._

## Temps passé

Le détail est tenu dans [`docs/time-log.md`](docs/time-log.md). La conception est comptée séparément de l'implémentation, et l'historique Git en fait foi.

## Documentation

- [Analyse du sujet](docs/00-analyse-du-sujet.md)
- [Spécification](docs/01-specification.md)
- Maquettes : [bureau](docs/wireframes/01-ecrans-bureau.html) · [tablette et mobile](docs/wireframes/02-responsive.html)
- [Journal de temps](docs/time-log.md)
