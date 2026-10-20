// Point d'entrée : l'application web et les tâches du soir.
import { app } from './src/app.js';
import { pool } from './src/bdd.js';
import { config } from './src/config.js';
import { planifier } from './src/taches.js';
import { evenement } from './src/evenement.js';

const serveur = app.listen(config.port, () => {
  console.log(`Pharmat écoute sur le port ${config.port}`);
  evenement('info', 'Pharmat démarré', { courriel: config.courriel ? 'oui' : 'non' });
});
planifier();

// Arrêt propre (docker stop) : finir les requêtes en cours, fermer la base
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    serveur.close(() => pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 8000).unref();
  });
}
