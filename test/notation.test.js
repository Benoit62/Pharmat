import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noter, lettres, taux, niveau, arrondi } from '../src/notation.js';

test('lettres : normalise, trie, dédoublonne, ignore le reste', () => {
  assert.deepEqual(lettres('c,a,A, e'), ['A', 'C', 'E']);
  assert.deepEqual(lettres(['b', 'Z', 'B']), ['B']);
  assert.deepEqual(lettres(''), []);
  assert.deepEqual(lettres(null), []);
});

test('QCS : tout ou rien', () => {
  assert.deepEqual(noter('QCS', 'D', 'D'), { erreurs: 0, points: 2 });
  assert.deepEqual(noter('QCS', 'D', 'A'), { erreurs: 1, points: 0 });
  assert.deepEqual(noter('QCS', 'D', 'A,D'), { erreurs: 1, points: 0 });
});

test('QCM : barème par nombre d’erreurs (2 / 1 / 0,4 / 0)', () => {
  assert.deepEqual(noter('QCM', 'A,B,E', 'A,B,E'), { erreurs: 0, points: 2 });
  assert.deepEqual(noter('QCM', 'A,B,E', 'A,B'), { erreurs: 1, points: 1 });
  assert.deepEqual(noter('QCM', 'A,B,E', 'A,B,C'), { erreurs: 2, points: 0.4 });
  assert.deepEqual(noter('QCM', 'A,B,E', 'C,D'), { erreurs: 5, points: 0 });
});

test('sans réponse : 0 point', () => {
  assert.equal(noter('QCM', 'A,B', '').points, 0);
  assert.equal(noter('QCS', 'A', []).points, 0);
});

test('taux, niveau, arrondi', () => {
  assert.equal(taux(15, 10), 75);
  assert.equal(taux(0, 0), null);
  assert.equal(niveau(80), 'bon');
  assert.equal(niveau(50), 'moyen');
  assert.equal(niveau(10), 'faible');
  assert.equal(arrondi(0.4 + 0.4 + 0.4), 1.2);
});
