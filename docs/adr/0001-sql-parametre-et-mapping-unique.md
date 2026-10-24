# ADR-0001 : SQL paramétré sans ORM, noms ERP confinés aux repositories

- **Statut :** Acceptée
- **Date :** 2026-10-24
- **Décideurs :** kiri1101

## Contexte
Le sujet impose `mssql` avec des requêtes paramétrées, sans ORM. Les tables reprennent les conventions de l'ERP (`[Total Weight (kg)]`, `[No_]`) et ne doivent pas être renommées, alors que l'API doit répondre en camelCase. Sans règle, ces noms se répandraient dans les services et les contrôleurs, et chaque requête pourrait être tentée de concaténer des valeurs.

## Décision
Seuls les repositories écrivent du SQL et connaissent les noms ERP ; chaque requête aliase explicitement ses colonnes en camelCase (`[Total Weight (kg)] AS totalWeightKg`) et ne reçoit ses valeurs que par paramètres typés. Les listes de valeurs passent par un paramètre par élément (`@so0, @so1…`, helper `inList`).

## Conséquences
- Le reste du code manipule des objets camelCase et des statuts en chaînes (`DRAFT`, `TO_PLAN`) ; la conversion `tinyint` ↔ statut se fait dans le repository.
- Aucune injection SQL possible par construction ; un relecteur vérifie un seul dossier par module.
- Plus verbeux qu'un ORM, mais chaque requête est lisible et explicable telle quelle.
