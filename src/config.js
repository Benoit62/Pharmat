// Réglages lus dans l'environnement. Sur le serveur, la plateforme injecte DB_* et EVENTS_URL,
// et SESSION_SECRET est déposé par l'administrateur. En local : fichier .env (voir .env.exemple).
const env = process.env;

const production = env.NODE_ENV === 'production';

if (production && !env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET manquant : refus de démarrer sans secret de session.');
}

export const config = {
  production,
  port: Number(env.PORT) || 3000,
  // Adresse publique, pour les liens des courriels
  urlPublique: (env.URL_PUBLIQUE || 'http://localhost:3000').replace(/\/$/, ''),
  secretSession: env.SESSION_SECRET || 'secret-de-developpement-a-ne-pas-utiliser',
  bdd: {
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT) || 3306,
    database: env.DB_NAME || 'pharmat',
    user: env.DB_USER || 'pharmat',
    password: env.DB_PASSWORD || '',
  },
  // Courriel : facultatif. Sans SMTP_HOST, l'application tourne sans envoi (inscriptions
  // confirmées d'office, rappels coupés, « mot de passe oublié » masqué).
  courriel: env.SMTP_HOST
    ? {
        host: env.SMTP_HOST,
        port: Number(env.SMTP_PORT) || 25,
        user: env.SMTP_USER || null,
        motDePasse: env.SMTP_PASSWORD || null,
        expediteur: env.MAIL_FROM || 'pharmat@benoitwattinne.fr',
      }
    : null,
  urlEvenements: env.EVENTS_URL || null,
  fuseau: 'Europe/Paris',
};
