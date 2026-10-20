import { test } from 'node:test';
import assert from 'node:assert/strict';
import { choisirRappel } from '../src/taches.js';
import { ecartJours, jour, serieDeJours } from '../src/temps.js';

const u = { id_user: 1, name: 'Camille', cree_le: null };
const activite = (...jours) => new Map(jours.map((j) => [j, { questions: 10, points: 12 }]));

test('rien si une série a déjà été faite aujourd’hui', () => {
  assert.equal(choisirRappel(u, activite('2026-10-20'), '2026-10-20'), null);
});

test('le soir même quand on était actif la veille', () => {
  const r = choisirRappel(u, activite('2026-10-18', '2026-10-19'), '2026-10-20');
  assert.ok(r);
  assert.match(r.sujet, /série|aujourd’hui|affilée/);
});

test('absences : rappel à 2, 7, 14 et 30 jours seulement', () => {
  const envoyes = [];
  for (let n = 2; n <= 40; n++) {
    const d = new Date(Date.UTC(2026, 9, 1 + n));
    if (choisirRappel(u, activite('2026-10-01'), d.toISOString().slice(0, 10))) envoyes.push(n);
  }
  assert.deepEqual(envoyes, [2, 7, 14, 30]);
});

test('compte jamais actif : 1, 3 et 7 jours après l’inscription', () => {
  const nouveau = { ...u, cree_le: new Date('2026-10-01T10:00:00Z') };
  const envoyes = [];
  for (let n = 0; n <= 10; n++) {
    const d = new Date(Date.UTC(2026, 9, 1 + n));
    if (choisirRappel(nouveau, new Map(), d.toISOString().slice(0, 10))) envoyes.push(n);
  }
  assert.deepEqual(envoyes, [1, 3, 7]);
});

test('écart de jours et série de jours', () => {
  assert.equal(ecartJours('2026-10-01', '2026-10-31'), 30);
  assert.equal(ecartJours('2026-03-28', '2026-03-30'), 2); // passage à l'heure d'été
  const aujourdhui = jour();
  const hier = jour(new Date(Date.now() - 86400e3));
  const avantHier = jour(new Date(Date.now() - 2 * 86400e3));
  assert.equal(serieDeJours([aujourdhui, hier, avantHier]), 3);
  assert.equal(serieDeJours([hier, avantHier]), 2); // la série tient jusqu'au soir
  assert.equal(serieDeJours([avantHier]), 0);
});
