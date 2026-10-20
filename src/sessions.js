// Magasin express-session dans MariaDB (table sessions_web). Remplace express-mysql-session,
// qui n'est plus maintenu et embarquait un pilote vulnérable. La partie en cours y est gardée :
// elle survit à un redéploiement.
import session from 'express-session';
import { requete, ligne } from './bdd.js';

const maintenant = () => Math.floor(Date.now() / 1000);
const expiration = (s) =>
  Math.floor((s.cookie?.expires ? new Date(s.cookie.expires).getTime() : Date.now() + 86400e3) / 1000);

export class MagasinMariaDB extends session.Store {
  constructor() {
    super();
    // Ménage des sessions expirées, toutes les heures
    setInterval(() => this.purger().catch(() => {}), 3600e3).unref();
  }

  get(id, cb) {
    ligne('SELECT donnees FROM sessions_web WHERE id = ? AND expire > ?', [id, maintenant()])
      .then((l) => cb(null, l ? JSON.parse(l.donnees) : null))
      .catch(cb);
  }

  set(id, s, cb) {
    requete(
      'INSERT INTO sessions_web (id, expire, donnees) VALUES (?, ?, ?) ' +
        'ON DUPLICATE KEY UPDATE expire = VALUES(expire), donnees = VALUES(donnees)',
      [id, expiration(s), JSON.stringify(s)],
    )
      .then(() => cb?.(null))
      .catch((e) => cb?.(e));
  }

  touch(id, s, cb) {
    requete('UPDATE sessions_web SET expire = ? WHERE id = ?', [expiration(s), id])
      .then(() => cb?.(null))
      .catch((e) => cb?.(e));
  }

  destroy(id, cb) {
    requete('DELETE FROM sessions_web WHERE id = ?', [id])
      .then(() => cb?.(null))
      .catch((e) => cb?.(e));
  }

  /** Ferme toutes les sessions d'un compte (mot de passe changé, compte supprimé). */
  async fermerPourUtilisateur(idUtilisateur, saufId = null) {
    await requete(
      `DELETE FROM sessions_web WHERE JSON_VALUE(donnees, '$.idUtilisateur') = ? AND id <> ?`,
      [idUtilisateur, saufId ?? ''],
    );
  }

  purger() {
    return requete('DELETE FROM sessions_web WHERE expire <= ?', [maintenant()]);
  }
}

export const magasin = new MagasinMariaDB();
