# ADR-0005 : domaine pur, poids en centièmes de kg entiers

- **Statut :** Acceptée
- **Date :** 2026-10-24
- **Décideurs :** kiri1101

## Contexte
Les tests obligatoires portent sur la capacité, l'affectation et les changements de statut : ils doivent être rapides et ne pas dépendre de la base. Par ailleurs `mssql` renvoie `decimal(10,2)` en `number` flottant, et une somme de flottants peut dériver juste à la limite de la capacité.

## Décision
Les règles métier vivent dans `src/domain/`, en fonctions TypeScript pures sans NestJS ni SQL ; le service les appelle à l'intérieur de sa transaction avec l'état chargé sous verrou. Le domaine calcule en centièmes de kg entiers (`Math.round(kg * 100)`) et l'API reconvertit en kg à la sortie.

## Conséquences
- Les tests unitaires couvrent toutes les règles en millisecondes, y compris la limite exacte (1 500,00 kg acceptés, 1 500,01 refusés).
- Une seule fonction (`allowedActions`) sert à la fois à protéger les mutations et à dire au front quels boutons afficher (ADR-0007).
- Le front applique la même conversion pour ses jauges projetées.
