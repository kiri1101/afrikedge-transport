# ADR-0007 : l'API calcule `allowedActions` pour l'utilisateur courant

- **Statut :** Acceptée
- **Date :** 2026-10-24
- **Décideurs :** kiri1101

## Contexte
L'écran de détail doit afficher les boutons selon le statut de l'ordre et le rôle de l'utilisateur. Recoder ces règles dans le front crée deux sources de vérité qui finissent par diverger.

## Décision
Le détail (et la réponse de chaque mutation) contient `allowedActions` (`ADD_LINES`, `REMOVE_LINES`, `VALIDATE`, `DEPART`), calculé par la fonction de domaine qui protège aussi les mutations. Le front n'affiche que ces actions et explique celles qui manquent (validation réservée au responsable, ordre vide).

## Conséquences
- Un seul endroit décide qui peut faire quoi ; l'API reste l'arbitre si on contourne l'interface.
- Changer d'utilisateur dans l'en-tête remonte la vue pour recharger `allowedActions`.
- C'est un ajout au contrat du sujet, signalé dans le README.
