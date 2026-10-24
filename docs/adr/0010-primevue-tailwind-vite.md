# ADR-0010 : front en SPA Vite avec PrimeVue et Tailwind

- **Statut :** Acceptée
- **Date :** 2026-10-24
- **Décideurs :** kiri1101

## Contexte
Le sujet impose Vue 3, TypeScript et Pinia et laisse libre la librairie de composants. Les écrans ont besoin d'un tableau paginé côté serveur, de dialogues, de confirmations, de toasts et de sélecteurs de date ; il n'y a ni SEO ni rendu serveur à gérer.

## Décision
SPA Vite (pas de Nuxt) avec PrimeVue 4 (preset Aura, primaire teal), PrimeIcons et Tailwind CSS 4 via `tailwindcss-primeui`. L'ordre des couches CSS est déclaré pour que Tailwind puisse surcharger PrimeVue ; le mode sombre automatique est désactivé. Les polices IBM Plex sont auto-hébergées.

## Conséquences
- Les composants complexes (`DataTable` paginé, `Dialog`, `ConfirmDialog`, `DatePicker`) sont fournis ; l'effort va aux composants métier (jauge, plaque, étapes).
- PrimeVue 4 n'a plus de mode « pile » pour `DataTable` : sur mobile, des cartes dédiées remplacent le tableau, choisies par `useBreakpoint()`.
- La sélection multi-pages est tenue par le store, pas par la sélection native du tableau.
