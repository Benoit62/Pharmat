// L'activité par jour (heure de Paris) : questions répondues et points, entraînements,
// examens et révisions confondus. Sert à l'accueil, aux statistiques et aux rappels.
import { requete } from './bdd.js';
import { jour } from './temps.js';

/**
 * Map idUtilisateur → Map « AAAA-MM-JJ » → { questions, points }.
 * `idUtilisateur` null : tous les comptes (tâches du soir).
 */
export async function activiteParJour(idUtilisateur = null, jours = 400) {
  const filtre = idUtilisateur ? 'AND x.id_user = ?' : '';
  const p = idUtilisateur ? [idUtilisateur] : [];
  const series = await requete(
    `SELECT x.id_user, x.date AS jour, SUM(x.size) AS questions, SUM(x.score) AS points
       FROM training_sessions x
      WHERE x.date >= CURDATE() - INTERVAL ${Number(jours)} DAY ${filtre}
      GROUP BY x.id_user, x.date`,
    p,
  );
  // Les réponses de révision sont horodatées en UTC : regroupées par heure, puis rangées au
  // jour de Paris (sans dépendre des tables de fuseaux de MariaDB)
  const revisions = await requete(
    `SELECT x.id_user, DATE_FORMAT(a.cree_le, '%Y-%m-%dT%H:00:00Z') AS heure, COUNT(*) AS questions, SUM(a.score) AS points
       FROM revision_session_answers a
       JOIN revision_sessions x ON x.id_revision = a.id_revision
      WHERE a.cree_le >= UTC_TIMESTAMP() - INTERVAL ${Number(jours)} DAY ${filtre}
      GROUP BY x.id_user, heure`,
    p,
  );

  const parCompte = new Map();
  const ajouter = (id, j, questions, points) => {
    if (!parCompte.has(id)) parCompte.set(id, new Map());
    const m = parCompte.get(id);
    const v = m.get(j) ?? { questions: 0, points: 0 };
    v.questions += Number(questions);
    v.points += Number(points);
    m.set(j, v);
  };
  for (const s of series) ajouter(s.id_user, s.jour, s.questions, s.points);
  for (const r of revisions) ajouter(r.id_user, jour(new Date(r.heure)), r.questions, r.points);
  return parCompte;
}

/** L'activité d'un seul compte : Map jour → { questions, points } (vide si rien). */
export async function activiteDe(idUtilisateur, jours) {
  return (await activiteParJour(idUtilisateur, jours)).get(idUtilisateur) ?? new Map();
}
