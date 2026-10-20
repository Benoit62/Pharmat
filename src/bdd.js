// Accès à MariaDB : un pool (l'ancienne connexion unique tombait après une coupure), heures
// en UTC dans la base, dates (DATE) rendues telles quelles en « AAAA-MM-JJ ».
import mysql from 'mysql2/promise';
import { config } from './config.js';

export const pool = mysql.createPool({
  ...config.bdd,
  connectionLimit: 5,
  charset: 'utf8mb4_unicode_ci',
  timezone: 'Z',
  dateStrings: ['DATE'],
  multipleStatements: false,
  enableKeepAlive: true,
});

pool.on('connection', (connexion) => {
  connexion.query("SET time_zone = '+00:00'");
});

/** Lignes d'une requête (SELECT) ou résultat d'une écriture (insertId, affectedRows). */
export async function requete(sql, parametres = []) {
  const [resultat] = await pool.query(sql, parametres);
  return resultat;
}

/** Première ligne, ou null. */
export async function ligne(sql, parametres = []) {
  const lignes = await requete(sql, parametres);
  return lignes[0] ?? null;
}

/** Exécute fn(connexion) dans une transaction : tout ou rien. */
export async function transaction(fn) {
  const connexion = await pool.getConnection();
  try {
    await connexion.beginTransaction();
    const resultat = await fn({
      requete: async (sql, p = []) => (await connexion.query(sql, p))[0],
    });
    await connexion.commit();
    return resultat;
  } catch (erreur) {
    await connexion.rollback();
    throw erreur;
  } finally {
    connexion.release();
  }
}
