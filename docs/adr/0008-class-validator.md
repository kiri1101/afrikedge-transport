# ADR-0008 : valider les entrées avec class-validator plutôt que Zod

- **Statut :** Acceptée
- **Date :** 2026-10-24
- **Décideurs :** kiri1101

## Contexte
Les entrées (corps, paramètres de requête, chemin) doivent être validées avant d'atteindre le domaine. Zod offre l'inférence de types et le partage de schémas avec le front ; class-validator est l'approche documentée de NestJS et alimente directement Swagger. Ce choix ne touche que la forme des entrées : les règles métier restent dans le domaine.

## Décision
DTO en classes avec `class-validator` et `class-transformer`, `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`), plugin Swagger qui lit ces mêmes classes.

## Conséquences
- Swagger (bonus) sans code de liaison supplémentaire.
- Pas de schéma partagé avec le front, cohérent avec l'absence de paquet commun (deux applications indépendantes).
- Les normalisations (`trim`, majuscules des numéros) se font par `@Transform`.
