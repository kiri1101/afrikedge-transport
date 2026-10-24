# Décisions d'architecture (ADR)

Une décision par fichier. Statuts fixés à l'approbation de la [spécification](../01-specification.md) ; une section « Tel que construit » est ajoutée si le code s'en écarte.

| N° | Décision | Statut |
|---|---|---|
| [0001](0001-sql-parametre-et-mapping-unique.md) | SQL paramétré sans ORM, noms ERP confinés aux repositories | Acceptée |
| [0002](0002-verrou-ligne-en-tete.md) | Verrouiller la ligne d'en-tête de l'ordre en tête de chaque modification | Acceptée |
| [0003](0003-if-match-obligatoire.md) | Exiger `If-Match` sur toute modification d'un ordre existant | Acceptée |
| [0004](0004-erreurs-problem-details.md) | Erreurs au format *problem details* avec un code stable | Acceptée |
| [0005](0005-domaine-pur-centiemes-kg.md) | Domaine pur, poids en centièmes de kg entiers | Acceptée |
| [0006](0006-dates-chaines-horloge-douala.md) | Dates en chaînes `YYYY-MM-DD`, « aujourd'hui » via une horloge à Douala | Acceptée |
| [0007](0007-allowed-actions-api.md) | L'API calcule `allowedActions` pour l'utilisateur courant | Acceptée |
| [0008](0008-class-validator.md) | Valider les entrées avec class-validator plutôt que Zod | Acceptée |
| [0009](0009-pagination-offset.md) | Pagination par décalage avec total | Acceptée |
| [0010](0010-primevue-tailwind-vite.md) | Front en SPA Vite avec PrimeVue et Tailwind | Acceptée |
