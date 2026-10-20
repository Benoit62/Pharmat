# Plan d'évolution

Ce qui n'est pas indispensable aujourd'hui, classé par intérêt pour la révision. La version 2
a terminé et fiabilisé l'existant ; rien ici n'est commencé.

## À faire dès que possible

1. **Activer le courriel.** Quand le relais `smtp-relay` de la plateforme existera : décommenter
   `addons: { mail: true }` dans `.infra/deploy.yaml` et pousser. Rien d'autre à changer dans le
   code (confirmation d'adresse, mot de passe oublié, rappels et bilans s'activent seuls). Les
   comptes créés avant restent valides.
2. **Compléter les matières.** Un peu plus de la moitié des questions ont une matière (aucune
   pour 2012 à 2022). Les classer, depuis l'administration ou par un fichier importé, rend le
   filtre par matière et les statistiques par matière bien plus utiles.

## Pour mieux réviser

- **Correction commentée** : un champ « explication » par question, affiché dans la correction
  (une colonne de plus, un champ de plus dans le formulaire et dans l'import).
- **Correction immédiate** : en entraînement, une option pour voir la correction après chaque
  question plutôt qu'à la fin.
- **Refaire mes erreurs** : une série composée des questions ratées (moins de 2 points), les
  plus récentes ou les plus fréquentes d'abord. Toutes les données existent déjà.
- **Répétition espacée** : reproposer une question ratée à J+1, J+3, J+7… plutôt qu'au hasard.
- **Comparer deux passages d'une même année de révision** (ce que l'ancien bouton « Comparer »
  annonçait) : question par question, ce qui a progressé ou régressé.
- **Signaler une erreur dans une question** : un bouton dans la correction, une file à traiter
  dans l'administration.
- **Annales récentes** (2023 et suivantes) : à importer dès qu'elles sont disponibles, au
  format de l'export.

## Pour l'usage quotidien

- **Notifications sur le téléphone** à la place des SMS abandonnés : l'application est déjà
  installable (manifeste) ; ajouter un service worker et le Web Push (clés VAPID, abonnement
  dans « Mon compte »). Gratuit, sans numéro de téléphone.
- **Mode hors ligne** pour réviser dans les transports : mettre en cache une série avant de
  partir, envoyer les réponses au retour du réseau.
- **Objectif quotidien** (questions par jour) affiché à l'accueil et repris dans le bilan.

## Exploitation

- Vérifier la durée officielle des épreuves de QCM et l'appliquer à l'examen blanc (aujourd'hui
  90 s par question, réglable dans `src/partie.js`).
- Tests d'intégration contre une MariaDB jetable dans la CI (les parcours ont été éprouvés à la
  main pour la version 2).
- Purge des comptes jamais confirmés au bout de 30 jours, une fois le courriel actif.
