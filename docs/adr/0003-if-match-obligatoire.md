# ADR-0003 : exiger `If-Match` sur toute modification d'un ordre existant

- **Statut :** Acceptée
- **Date :** 2026-10-24
- **Décideurs :** kiri1101

## Contexte
Le verrou de l'ADR-0002 protège les données, pas la décision de l'utilisateur. Exemple : eric ouvre TO-0003 avec deux commandes ; diane en retire une ; eric valide un contenu qu'il n'a jamais vu. Toutes les règles restent respectées, mais la validation n'a plus de sens. Un contrôle de version facultatif échoue en silence pour le client qui oublie l'en-tête.

## Décision
Ajout et retrait de lignes, validation et départ exigent `If-Match: "<version>"`, version hexadécimale de la `rowversion` exposée dans les listes, le détail et l'en-tête `ETag`. Absent → 428 `VERSION_REQUIRED` ; périmé → 412 `STALE_VERSION`. La création n'en demande pas (rien n'existe encore).

## Conséquences
- Une règle simple à énoncer : toute modification d'un ordre doit prouver la version vue.
- Le front envoie toujours la version qu'il affiche ; sur 412, il recharge et prévient l'utilisateur (« Ordre modifié entre-temps »).
- Tester l'API à la main demande une lecture préalable ; le README et Swagger montrent l'exemple.
- CORS doit exposer `ETag` (`exposedHeaders`), sinon le navigateur ne peut pas le lire.
