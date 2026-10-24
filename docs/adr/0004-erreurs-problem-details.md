# ADR-0004 : erreurs au format *problem details* avec un code stable

- **Statut :** Acceptée
- **Date :** 2026-10-24
- **Décideurs :** kiri1101

## Contexte
Le sujet exige que toute action interdite soit refusée « avec un code HTTP adapté et un message d'erreur clair », et l'interface doit exister en français et en anglais. Un message libre ne se traduit pas ; un statut HTTP seul ne dit pas quelle règle a été violée.

## Décision
Toutes les erreurs suivent la RFC 9457 (`application/problem+json`) avec un champ `code` stable (`CAPACITY_EXCEEDED`…) et des `params` chiffrés ; `title` et `detail` sont en français. Le domaine lève des `DomainError(code, params)` sans connaître HTTP ; un filtre global unique associe chaque code à son statut. Règle de choix : 422 quand la demande est fausse en soi, 409 quand elle heurte l'état actuel, 404 pour une ressource du chemin, 412/428 pour la version.

## Conséquences
- Le front traduit par `code` et `params` (FR/EN) sans analyser de texte.
- Le tableau code → statut vit à un seul endroit (`error-catalog.ts`) et dans la spécification §7.4.
- Les erreurs de validation (400) ajoutent `errors: [{ field, message }]`.
