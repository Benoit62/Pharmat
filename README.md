# Pharmat
Application pour la révision des QCMs de l'internat de pharmacie 

## Utilisation

Clonez le dépôt

Installez toutes les dépendances avec 
```bash
npm install
```

Lancez le service avec
```bash
node index.js
```

## Base de donnée
Assurez-vous d'avoir une base de donnée MySQL sur le service de votre choix.

Importez les bases de donnée `pharmat_db.sql` et `pharmat_session.sql`.

Dans le fichier `.env`, modifiez les variable pour la connexion à la base de donnée.

## Server email

Assurez-vous d'avoir un serveur mail.

Modifierz le fichier `.env` avec les identifiants du service mail.
