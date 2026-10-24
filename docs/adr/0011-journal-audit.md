# ADR-0011 : journal d'audit en JSON lines, corrélé par requête

- **Statut :** Acceptée
- **Date :** 2026-10-24
- **Décideurs :** kiri1101

## Contexte
Demande ajoutée pendant l'implémentation : tracer les requêtes de l'API, leurs réponses, leurs erreurs et l'activité de la base (lectures, écritures). Le schéma ERP ne doit pas être modifié, ce qui exclut une table d'audit dans `TransportPlanning`. Les réponses contiennent des données clients (noms, villes).

## Décision
Chaque requête reçoit un identifiant (`X-Request-Id` entrant s'il est sûr, `^[\w-]{1,64}$`, sinon un UUID), renvoyé dans la réponse et porté par `AsyncLocalStorage` jusqu'aux requêtes SQL. Un `AuditLog` écrit des entrées JSON (une par ligne) dans `logs/audit.log` et sur la sortie standard : `http.request` (méthode, chemin, utilisateur, corps des modifications), `http.response` (statut, durée), `http.error` (code, statut, détail), `db.read` / `db.write` / `db.session` (SQL compacté, paramètres, lignes, durée), `db.transaction` (début, validation, annulation avec la raison), `db.error`. Les corps de réponse ne sont jamais journalisés.

## Conséquences
- Une requête se relit de bout en bout : `grep '"demo-1"' logs/audit.log`.
- Les destinations sont des `AuditSink` interchangeables : les tests injectent un `MemorySink` ; une table d'audit ou un collecteur (ELK, Loki) s'ajouterait sans toucher au code appelant.
- Pas de rotation de fichier : en production, elle serait confiée à l'hébergement (logrotate, collecteur) ; noté dans le README.
- Les paramètres SQL sont journalisés en clair : acceptable ici (numéros de commandes, codes véhicules, utilisateurs), à filtrer si des données sensibles apparaissaient.
