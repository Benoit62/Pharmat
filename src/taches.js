// Les courriels du soir, envoyés par le processus lui-même (un seul réplica sur le serveur).
//  - 20 h 30, rappel : à qui n'a rien fait aujourd'hui. Espacés pour ne pas lasser : le soir
//    même si l'on était actif la veille (garder sa série de jours), puis après 2, 7, 14 et
//    30 jours d'absence, et plus rien ensuite. Un compte jamais actif : 1, 3 et 7 jours après
//    l'inscription.
//  - 22 h, bilan : à qui a répondu à des questions aujourd'hui.
// Chacun se règle ou se coupe dans « Mon compte », ou par le lien en pied de courriel.
import cron from 'node-cron';
import { requete } from './bdd.js';
import { actif, courriels } from './courriel.js';
import { activiteParJour } from './activite.js';
import { jour, ecartJours, serieDeJours } from './temps.js';
import { taux } from './notation.js';
import { evenement } from './evenement.js';
import { config } from './config.js';

const ABSENCES = [2, 7, 14, 30];
const NOUVEAUX = [1, 3, 7];

const comptes = (colonne) =>
  requete(`SELECT id_user, name, mail, cree_le FROM users WHERE confirm_id IS NULL AND ${colonne} = 1`);

/** Le rappel à envoyer à un compte ce soir, ou null. Exporté pour les tests. */
export function choisirRappel(u, jours, aujourdhui = jour()) {
  if (jours.has(aujourdhui)) return null;
  const actifs = [...jours.keys()].sort();
  const dernier = actifs.at(-1);
  if (!dernier) {
    const depuis = u.cree_le ? ecartJours(jour(u.cree_le), aujourdhui) : null;
    if (!NOUVEAUX.includes(depuis)) return null;
    return {
      sujet: 'Ta première série t’attend',
      titre: `Une première série, ${u.name} ?`,
      paragraphes: ['Dix questions suffisent pour découvrir Pharmat : choisis une année, réponds, et regarde la correction détaillée.'],
      bouton: 'Lancer une série',
    };
  }
  const absence = ecartJours(dernier, aujourdhui);
  if (absence === 1) {
    const serie = serieDeJours(actifs);
    return {
      sujet: serie > 1 ? `${serie} jours d’affilée : on continue ?` : 'Pas encore de série aujourd’hui',
      titre: serie > 1 ? `Ne casse pas ta série, ${u.name}` : `Pas encore de série aujourd’hui, ${u.name}`,
      paragraphes: [serie > 1 ? `Tu t’entraînes depuis ${serie} jours d’affilée. Quelques questions ce soir et la série continue.` : 'Hier tu étais là. Quelques questions ce soir pour garder le rythme ?'],
      bouton: 'Faire ma série',
    };
  }
  if (!ABSENCES.includes(absence)) return null;
  return {
    sujet: absence >= 14 ? 'Tu nous manques sur Pharmat' : 'On reprend ?',
    titre: `${absence} jours sans réviser, ${u.name}`,
    paragraphes: [
      absence >= 14 ? 'Le concours, lui, ne prend pas de vacances. Reviens à ton rythme : une série de dix questions pour reprendre la main.' : 'Ça fait quelques jours. Une petite série pour reprendre là où tu en étais ?',
    ],
    bouton: 'Reprendre',
  };
}

export async function envoyerRappels() {
  const [liste, activite] = await Promise.all([comptes('notif_rappel'), activiteParJour(null, 60)]);
  let n = 0;
  for (const u of liste) {
    const rappel = choisirRappel(u, activite.get(u.id_user) ?? new Map());
    if (rappel && (await courriels.rappel(u, rappel))) n++;
  }
  await evenement('info', 'Rappels du soir envoyés', { envoyes: n });
}

export async function envoyerBilans() {
  const [liste, activite] = await Promise.all([comptes('notif_bilan'), activiteParJour(null, 400)]);
  const aujourdhui = jour();
  let n = 0;
  for (const u of liste) {
    const jours = activite.get(u.id_user);
    const j = jours?.get(aujourdhui);
    if (!j?.questions) continue;
    const reussite = taux(j.points, j.questions);
    const serie = serieDeJours([...jours.keys()]);
    const appreciation = reussite >= 75 ? 'Très belle journée.' : reussite >= 50 ? 'Une bonne base : continue comme ça.' : reussite >= 25 ? 'Des points à reprendre : la correction détaillée est là pour ça.' : 'Journée difficile, et c’est en corrigeant qu’on progresse.';
    const ok = await courriels.rappel(u, {
      sujet: `Ton bilan du jour : ${reussite} %`,
      titre: `Ton bilan du jour, ${u.name}`,
      paragraphes: [
        `${j.questions} question${j.questions > 1 ? 's' : ''} aujourd’hui, ${reussite} % de réussite. ${appreciation}`,
        serie > 1 ? `Série en cours : ${serie} jours d’affilée.` : 'Reviens demain pour lancer une série de jours.',
      ],
      bouton: 'Voir mes statistiques',
      chemin: '/statistiques',
    });
    if (ok) n++;
  }
  await evenement('info', 'Bilans du soir envoyés', { envoyes: n });
}

export function planifier() {
  if (!actif) {
    console.log('Courriel non configuré : rappels et bilans désactivés.');
    return;
  }
  const options = { timezone: config.fuseau, noOverlap: true };
  cron.schedule('30 20 * * *', () => envoyerRappels().catch((e) => console.error('Rappels :', e)), options);
  cron.schedule('0 22 * * *', () => envoyerBilans().catch((e) => console.error('Bilans :', e)), options);
}
