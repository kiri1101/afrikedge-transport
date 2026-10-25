# ADR-0006 : dates en chaînes `YYYY-MM-DD`, « aujourd'hui » via une horloge à Douala

- **Statut :** Acceptée
- **Date :** 2026-10-24
- **Décideurs :** kiri1101

## Contexte
La colonne `[Delivery Date]` est de type `date`, sans heure. `mssql` la renvoie en `Date` JS à minuit UTC et `toISOString()` côté navigateur convertit l'heure locale en UTC : chacun peut décaler une date d'un jour. La règle « date non passée » dépend en plus de ce qu'est « aujourd'hui » : le conteneur SQL tourne en UTC, les utilisateurs sont à UTC+1.

## Décision
Les dates circulent partout en chaînes `YYYY-MM-DD` : `CONVERT(char(10), [Delivery Date], 23)` à la lecture, chaîne en paramètre `sql.Date` à l'écriture, `toIsoDate()` local côté front (jamais `toISOString`). « Aujourd'hui » vient d'une horloge injectable `Clock`, réglée sur `Africa/Douala` par configuration.

## Conséquences
- La règle R1 se teste avec une horloge figée (cas de 23 h 30 UTC, déjà le lendemain à Douala).
- La comparaison de dates est une comparaison de chaînes.
- Les dates du jeu d'essai étant calculées par SQL Server en UTC, un test lancé entre minuit et 1 h à Douala peut voir « demain » décalé ; c'est documenté.

## Tel que construit
À l'écriture, la date n'est pas passée en `sql.Date` (qui repasserait par un `Date` JS) mais en `NVarChar(10)` converti côté SQL : `CONVERT(date, @deliveryDate, 23)`. Aucune date ne transite donc jamais par un `Date` JS côté API, ce qui va dans le sens de la décision. Le décalage de minuit décrit ci-dessus a été observé pendant le développement (base réinitialisée à 00 h 38, heure de Douala).
