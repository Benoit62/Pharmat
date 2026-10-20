// Applique les migrations de migrations/ dans l'ordre, une seule fois chacune.
// Sur le serveur : lancé par la plateforme avant chaque bascule (runtime.migrate), après un
// export de la base. En local : npm run migrer.
import { readdir, readFile } from 'node:fs/promises';
import { pool, requete } from '../src/bdd.js';
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

async function migrer() {
  await requete(`CREATE TABLE IF NOT EXISTS migrations (
    nom VARCHAR(100) NOT NULL PRIMARY KEY,
    appliquee_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
  const faites = new Set((await requete('SELECT nom FROM migrations')).map((m) => m.nom));
  const fichiers = (await readdir(dossier)).filter((f) => f.endsWith('.sql')).sort();

  let n = 0;
  for (const fichier of fichiers) {
    if (faites.has(fichier)) continue;
    const sql = await readFile(new URL(fichier, dossier), 'utf8');
    for (const instruction of instructions(sql)) await requete(instruction);
    await requete('INSERT INTO migrations (nom) VALUES (?)', [fichier]);
    console.log(`migration appliquée : ${fichier}`);
    await evenement('info', `Migration appliquée : ${fichier}`, { migration: fichier });
    n++;
  }
  console.log(n ? `${n} migration(s) appliquée(s).` : 'Base à jour.');
}

try {
  await migrer();
} catch (erreur) {
  console.error('Migration en échec :', erreur.message);
  await evenement('error', 'Migration en échec', { erreur: erreur.message.slice(0, 400) });
  process.exitCode = 1;
} finally {
  await pool.end();
}
