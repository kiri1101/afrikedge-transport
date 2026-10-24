# ADR-0002 : verrouiller la ligne d'en-tête de l'ordre en tête de chaque modification

- **Statut :** Acceptée
- **Date :** 2026-10-24
- **Décideurs :** kiri1101

## Contexte
Les règles « le poids total ne dépasse jamais la capacité » et « une commande ne figure que dans un seul ordre » sont des invariants qui portent sur plusieurs lignes. Les vérifier puis écrire sans verrou laisse passer deux ajouts simultanés qui tiennent chacun seuls mais pas ensemble. Le schéma ERP n'a ni contrainte d'unicité ni clé étrangère pour nous protéger, et nous ne devons pas le modifier.

## Décision
Toute modification d'un ordre existant s'exécute dans une transaction dont la première instruction est `UPDATE [Transport Order] SET [Status] = [Status] WHERE [No_] = @no AND [timestamp] = @version`. Elle pose un verrou exclusif sur l'en-tête jusqu'au commit et incrémente la `rowversion`. Les commandes ajoutées sont ensuite lues `WITH (UPDLOCK)` et réservées par `UPDATE … SET [Status] = 1 WHERE [Status] = 0`, dont le nombre de lignes modifiées est contrôlé. La création verrouille la ligne du véhicule (`UPDLOCK`) puis le dernier numéro (`UPDLOCK, HOLDLOCK`), toujours dans cet ordre.

## Conséquences
- Les mutations d'un même ordre sont mises en file ; une même commande ne peut pas entrer dans deux ordres à la fois. Deux tests e2e de concurrence le démontrent.
- La `rowversion` devient la version de tout l'ordre (en-tête et lignes), ce qui sert l'ADR-0003.
- Un interblocage ou un délai de verrou dépassé (`SET LOCK_TIMEOUT 5000`) est traduit en 409 `CONCURRENT_UPDATE`.
- Avec le droit de modifier le schéma, on ajouterait des index uniques sur (`[Vehicle Code]`, `[Delivery Date]`) et sur `[Sales Order No_]` des lignes, une séquence pour les numéros et des clés étrangères : la base deviendrait le dernier rempart.
