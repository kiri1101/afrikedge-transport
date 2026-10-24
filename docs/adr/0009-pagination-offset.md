# ADR-0009 : pagination par décalage avec total

- **Statut :** Acceptée
- **Date :** 2026-10-24
- **Décideurs :** kiri1101

## Contexte
Les listes paginées alimentent un paginateur qui affiche des numéros de page et un total. Les volumes du test sont faibles ; ceux d'un ERP réel le sont moins.

## Décision
`page` / `pageSize` traduits en `OFFSET … FETCH NEXT`, réponse `{ items, page, pageSize, total }`. Le total vient d'une seconde requête au même `WHERE` plutôt que de `COUNT(*) OVER()`, qui ne renvoie aucun total quand la page demandée est vide. Chaque `ORDER BY` se termine par la clé primaire pour un ordre stable.

## Conséquences
- Accès direct à n'importe quelle page, total exact même au-delà de la dernière page.
- Coût linéaire du décalage sur les pages profondes : à volume ERP, on passerait à une pagination par curseur (noté dans le README).
