// Applique les migrations de migrations/ dans l'ordre, une seule fois chacune.
// Sur le serveur : lancé par la plateforme avant chaque bascule (runtime.migrate), après un
// export de la base. En local : npm run migrer.
//
// Une migration peut commencer par « -- condition : <SELECT d'une valeur> » : si la valeur est
// fausse (0, NULL), elle est marquée faite sans rien exécuter (amorçage d'une base neuve).
// Chaque migration tourne dans une transaction : les écritures (INSERT, UPDATE) sont tout ou
// rien ; les changements de structure (ALTER) valident d'eux-mêmes et sont écrits pour être
// rejoués sans effet.
import { readdir, readFile } from 'node:fs/promises';
import { pool } from '../src/bdd.js';
import { evenement } from '../src/evenement.js';

const dossier = new URL('../migrations/', import.meta.url);

function instructions(sql) {
  return sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function migrer(c) {
  await c.query(`CREATE TABLE IF NOT EXISTS migrations (
    nom VARCHAR(100) NOT NULL PRIMARY KEY,
    appliquee_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
  const [lignes] = await c.query('SELECT nom FROM migrations');
  const faites = new Set(lignes.map((m) => m.nom));
  const fichiers = (await readdir(dossier)).filter((f) => f.endsWith('.sql')).sort();

  let n = 0;
  for (const fichier of fichiers) {
    if (faites.has(fichier)) continue;
    const sql = await readFile(new URL(fichier, dossier), 'utf8');
    const condition = sql.match(/^--\s*condition\s*:\s*(.+)$/m)?.[1];
    await c.query('START TRANSACTION');
    try {
      let utile = true;
      if (condition) {
        const [[valeur]] = await c.query(condition);
        utile = Boolean(Number(Object.values(valeur ?? {})[0]));
      }
      if (utile) for (const instruction of instructions(sql)) await c.query(instruction);
      await c.query('INSERT INTO migrations (nom) VALUES (?)', [fichier]);
      await c.query('COMMIT');
      console.log(`migration ${utile ? 'appliquée' : 'sans objet'} : ${fichier}`);
      if (utile) await evenement('info', `Migration appliquée : ${fichier}`, { migration: fichier });
      n++;
    } catch (erreur) {
      await c.query('ROLLBACK');
      throw new Error(`${fichier} : ${erreur.message}`);
    }
  }
  console.log(n ? `${n} migration(s) traitée(s).` : 'Base à jour.');
}

const connexion = await pool.getConnection();
try {
  await migrer(connexion);
} catch (erreur) {
  console.error('Migration en échec :', erreur.message);
  await evenement('error', 'Migration en échec', { erreur: erreur.message.slice(0, 400) });
  process.exitCode = 1;
} finally {
  connexion.release();
  await pool.end();
}
